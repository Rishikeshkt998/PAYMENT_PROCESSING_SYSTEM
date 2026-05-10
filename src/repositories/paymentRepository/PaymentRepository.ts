import { IPaymentRepository } from '../../domain/repositories/IPaymentRepository';
import { IPayment } from '../../domain/PaymentEntity';
import { paymentModel } from '../../infrastructure/database/PaymentModel';
import logger from '../../infrastructure/logging/AppLogger';

export default class PaymentRepository implements IPaymentRepository {
  async findById(id: string): Promise<IPayment | null> {
    try {
      const payment = await paymentModel.findById(id).lean();
      return payment as unknown as IPayment | null;
    } catch (error) {
      logger.error('[PAYMENT_REPOSITORY] findById error:', error);
      throw error;
    }
  }

  async findByIdempotencyKey(key: string): Promise<IPayment | null> {
    try {
      const payment = await paymentModel.findOne({ idempotencyKey: key }).lean();
      return payment as unknown as IPayment | null;
    } catch (error) {
      logger.error('[PAYMENT_REPOSITORY] findByIdempotencyKey error:', error);
      throw error;
    }
  }

  async findByExternalId(externalId: string): Promise<IPayment | null> {
    try {
      const payment = await paymentModel.findOne({ externalId }).lean();
      return payment as unknown as IPayment | null;
    } catch (error) {
      logger.error('[PAYMENT_REPOSITORY] findByExternalId error:', error);
      throw error;
    }
  }

  async save(payment: Partial<IPayment>): Promise<IPayment> {
    try {
      if (payment._id) {
        const updated = await paymentModel
          .findByIdAndUpdate(payment._id, { $set: payment }, { new: true })
          .lean();
        return updated as unknown as IPayment;
      }
      const created = await paymentModel.create(payment);
      return created.toObject() as unknown as IPayment;
    } catch (error) {
      logger.error('[PAYMENT_REPOSITORY] save error:', error);
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: string,
    externalId?: string,
    error?: string
  ): Promise<IPayment | null> {
    try {
      const update: Partial<IPayment> & { [key: string]: any } = { status } as any;
      if (externalId) update.externalId = externalId;
      if (error) update.lastError = error;

      const updated = await paymentModel
        .findByIdAndUpdate(id, { $set: update }, { new: true })
        .lean();
      return updated as unknown as IPayment | null;
    } catch (err) {
      logger.error('[PAYMENT_REPOSITORY] updateStatus error:', err);
      throw err;
    }
  }
}
