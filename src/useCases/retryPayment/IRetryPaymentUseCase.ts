import { Queue } from 'bullmq';

export interface IRetryPaymentUseCase {
  scheduleRetry(paymentId: string): Promise<void>;
  getQueue(): Queue;
}
