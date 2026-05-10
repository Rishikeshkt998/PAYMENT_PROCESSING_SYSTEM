import { IPayment } from '../PaymentEntity';

export interface IPaymentRepository {
  findById(id: string): Promise<IPayment | null>;
  findByIdempotencyKey(key: string): Promise<IPayment | null>;
  findByExternalId(externalId: string): Promise<IPayment | null>;
  save(payment: Partial<IPayment>): Promise<IPayment>;
  updateStatus(id: string, status: string, externalId?: string, error?: string): Promise<IPayment | null>;
}
