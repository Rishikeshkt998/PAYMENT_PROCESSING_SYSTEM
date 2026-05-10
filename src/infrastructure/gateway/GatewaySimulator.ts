import { IPaymentGateway, PaymentGatewayResponse } from '../../domain/services/IPaymentGateway';
import logger from '../logging/AppLogger';

export default class ExternalGatewaySimulator implements IPaymentGateway {
  /**
   * Simulates a real external payment gateway with randomised outcomes.
   * Failure rate: 10% timeout, 20% decline — 70% success.
   */
  async process(amount: number, currency: string): Promise<PaymentGatewayResponse> {
    const random = Math.random();
    const delay = Math.floor(Math.random() * 2000) + 500;

    logger.info(`[GATEWAY] Simulating external payment: ${amount} ${currency}`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (random < 0.1) {
      logger.warn('[GATEWAY] Timeout simulated');
      throw new Error('Gateway Timeout');
    }

    if (random < 0.3) {
      logger.error('[GATEWAY] Payment declined');
      return {
        externalId: `failed_${Date.now()}`,
        success: false,
        message: 'Insufficient funds or card declined',
      };
    }

    logger.info('[GATEWAY] Payment successful');
    return {
      externalId: `ext_${Math.random().toString(36).substr(2, 9)}`,
      success: true,
      message: 'Payment processed successfully',
    };
  }
}
