export interface InitiatePaymentDTO {
  amount: number;
  currency: string;
  idempotencyKey: string;
  metadata?: Record<string, any>;
}

export interface WebhookPayloadDTO {
  externalId: string;
  status: string;
  message?: string;
}
