import { IPayment, PaymentStatus } from '../../domain/PaymentEntity';
import { InitiatePaymentDTO, WebhookPayloadDTO } from '../../domain/dtos/PaymentDTO';
import { IPaymentRepository } from '../../domain/repositories/IPaymentRepository';
import { IPaymentGateway } from '../../domain/services/IPaymentGateway';
import { LockService } from '../../infrastructure/cache/RedisService';
import logger from '../../infrastructure/logging/AppLogger';
import { IProcessPaymentUseCase } from './IProcessPaymentUseCase';
import { CreatePaymentSchema } from '../../infrastructure/validation/payment/CreatePaymentSchema';

type ProcessPaymentUseCaseConstructorParams = {
  PaymentRepository: IPaymentRepository;
  GatewaySimulator: IPaymentGateway;
};

export default class ProcessPaymentUseCase implements IProcessPaymentUseCase {
  private paymentRepository: IPaymentRepository;
  private paymentGateway: IPaymentGateway;

  constructor({ PaymentRepository, GatewaySimulator }: ProcessPaymentUseCaseConstructorParams) {
    this.paymentRepository = PaymentRepository;
    this.paymentGateway = GatewaySimulator;
  }

  /**
   * Initiates a payment — handles idempotency, creates the record,
   * then fires async processing.
   */
  async initiatePayment(
    data: InitiatePaymentDTO
  ): Promise<{ payment: IPayment; isIdempotent: boolean }> {
    // Validate input using Yup (matching brocamp-tool-v2 pattern)
    await CreatePaymentSchema.validate(data, { abortEarly: false });

    const existing = await this.paymentRepository.findByIdempotencyKey(data.idempotencyKey);
    if (existing) {
      logger.info(`[PROCESS_USE_CASE] Idempotent request for key: ${data.idempotencyKey}`);
      return { payment: existing, isIdempotent: true };
    }

    const payment = await this.paymentRepository.save({
      ...data,
      status: PaymentStatus.PENDING,
      retryCount: 0,
    });

    logger.info(`[PROCESS_USE_CASE] Created payment: ${payment._id}`);

    // Fire-and-forget — process asynchronously
    this.processPayment(payment._id as string).catch((err) => {
      logger.error(`[PROCESS_USE_CASE] Async processing error for ${payment._id}: ${err.message}`);
    });

    return { payment, isIdempotent: false };
  }

  /**
   * Core processing logic with Redis lock for concurrency control.
   */
  async processPayment(paymentId: string): Promise<IPayment | null> {
    const lockAcquired = await LockService.acquireLock(paymentId);

    if (!lockAcquired) {
      logger.warn(`[PROCESS_USE_CASE] Concurrent processing blocked for: ${paymentId}`);
      throw new Error('Payment is already being processed');
    }

    try {
      const payment = await this.paymentRepository.findById(paymentId);
      if (!payment) throw new Error(`Payment not found: ${paymentId}`);

      if (payment.status === PaymentStatus.SUCCESS) {
        logger.info(`[PROCESS_USE_CASE] Payment already succeeded: ${paymentId}`);
        return payment;
      }

      await this.paymentRepository.updateStatus(paymentId, PaymentStatus.PROCESSING);
      logger.info(`[PROCESS_USE_CASE] Processing payment: ${paymentId}`);

      try {
        const response = await this.paymentGateway.process(payment.amount, payment.currency);

        if (response.success) {
          return await this.paymentRepository.updateStatus(
            paymentId,
            PaymentStatus.SUCCESS,
            response.externalId
          );
        } else {
          return await this.paymentRepository.updateStatus(
            paymentId,
            PaymentStatus.FAILED,
            undefined,
            response.message
          );
        }
      } catch (gatewayError: any) {
        logger.error(`[PROCESS_USE_CASE] Gateway error for ${paymentId}: ${gatewayError.message}`);
        return await this.paymentRepository.updateStatus(
          paymentId,
          PaymentStatus.FAILED,
          undefined,
          gatewayError.message || 'Unknown gateway error'
        );
      }
    } finally {
      await LockService.releaseLock(paymentId);
    }
  }

  async getPaymentStatus(id: string): Promise<IPayment | null> {
    const payment = await this.paymentRepository.findById(id);
    if (!payment) return null;
    return payment;
  }

  /**
   * Securely handles webhooks, preventing race conditions and invalid state transitions
   * e.g., don't mark as FAILED if already SUCCESS.
   */
  async handleWebhook({ externalId, status, message }: WebhookPayloadDTO): Promise<void> {
    const payment = await this.paymentRepository.findByExternalId(externalId);
    
    if (!payment) {
      logger.warn(`[PROCESS_USE_CASE] Webhook received for unknown externalId: ${externalId}`);
      return;
    }

    const paymentId = payment._id as string;
    const lockAcquired = await LockService.acquireLock(`webhook:${paymentId}`);

    if (!lockAcquired) {
      logger.warn(`[PROCESS_USE_CASE] Concurrent webhook processing blocked for: ${paymentId}`);
      return;
    }

    try {
      // Re-fetch to get latest state inside lock
      const latestPayment = await this.paymentRepository.findById(paymentId);
      if (!latestPayment) return;

      // Prevent transitioning backwards or overriding a final SUCCESS state
      if (latestPayment.status === PaymentStatus.SUCCESS) {
        logger.info(`[PROCESS_USE_CASE] Ignoring webhook, payment already SUCCESS: ${paymentId}`);
        return;
      }

      // If the webhook status is SUCCESS, update it safely.
      if (status === 'SUCCESS') {
        await this.paymentRepository.updateStatus(paymentId, PaymentStatus.SUCCESS, undefined, message);
        logger.info(`[PROCESS_USE_CASE] Payment marked SUCCESS via webhook: ${paymentId}`);
      } 
      else if (status === 'FAILED') {
        await this.paymentRepository.updateStatus(paymentId, PaymentStatus.FAILED, undefined, message);
        logger.info(`[PROCESS_USE_CASE] Payment marked FAILED via webhook: ${paymentId}`);
      }
      else {
        logger.info(`[PROCESS_USE_CASE] Unhandled webhook status: ${status} for payment: ${paymentId}`);
      }
    } finally {
      await LockService.releaseLock(`webhook:${paymentId}`);
    }
  }
}
