export interface PaymentGatewayResponse {
  externalId: string;
  success: boolean;
  message: string;
}

export interface IPaymentGateway {
  process(amount: number, currency: string): Promise<PaymentGatewayResponse>;
}
