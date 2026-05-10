export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

export interface IPayment {
  _id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  idempotencyKey: string;
  externalId?: string;
  retryCount: number;
  lastError?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
