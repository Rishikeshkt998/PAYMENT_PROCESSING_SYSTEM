import { Queue, Worker, Job } from 'bullmq';
import redis from '../../infrastructure/cache/RedisService';
import { IProcessPaymentUseCase } from '../processPayment/IProcessPaymentUseCase';
import logger from '../../infrastructure/logging/AppLogger';
import { IRetryPaymentUseCase } from './IRetryPaymentUseCase';

type RetryPaymentUseCaseConstructorParams = {
  ProcessPaymentUseCase: IProcessPaymentUseCase;
};

export default class RetryPaymentUseCase implements IRetryPaymentUseCase {
  private processPaymentUseCase: IProcessPaymentUseCase;
  private retryQueue: Queue;
  private worker: Worker;

  constructor({ ProcessPaymentUseCase: useCase }: RetryPaymentUseCaseConstructorParams) {
    this.processPaymentUseCase = useCase;

    this.retryQueue = new Queue('payment-retries', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.worker = new Worker(
      'payment-retries',
      async (job: Job) => {
        const { paymentId } = job.data;
        logger.info(`[RETRY_USE_CASE] Retrying payment ${paymentId}, attempt ${job.attemptsMade + 1}`);
        await this.processPaymentUseCase.processPayment(paymentId);
      },
      { connection: redis }
    );

    this.worker.on('completed', (job) => {
      logger.info(`[RETRY_USE_CASE] Job ${job.id} completed for payment ${job.data.paymentId}`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`[RETRY_USE_CASE] Job ${job?.id} failed: ${err.message}`);
    });
  }

  async scheduleRetry(paymentId: string): Promise<void> {
    logger.info(`[RETRY_USE_CASE] Scheduling retry for payment: ${paymentId}`);
    await this.retryQueue.add('retry-payment', { paymentId });
  }

  getQueue(): Queue {
    return this.retryQueue;
  }
}
