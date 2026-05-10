import { IPayment } from '../../domain/PaymentEntity';
import { InitiatePaymentDTO, WebhookPayloadDTO } from '../../domain/dtos/PaymentDTO';

export interface IProcessPaymentUseCase {
  initiatePayment(data: InitiatePaymentDTO): Promise<{ payment: IPayment; isIdempotent: boolean }>;
  processPayment(paymentId: string): Promise<IPayment | null>;
  getPaymentStatus(id: string): Promise<IPayment | null>;
  handleWebhook(data: WebhookPayloadDTO): Promise<void>;
}
