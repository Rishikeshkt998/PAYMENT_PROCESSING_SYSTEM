import mongoose, { Schema, Document } from 'mongoose';
import { IPayment, PaymentStatus } from '../../domain/PaymentEntity';

export interface IPaymentDocument extends Omit<IPayment, '_id'>, Document {}

const PaymentSchema = new Schema<IPaymentDocument>(
  {
    amount: { type: Number, required: true },
    currency: { type: String, required: true, uppercase: true },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
    },
    idempotencyKey: { type: String, required: true, unique: true, index: true },
    externalId: { type: String, default: null },
    retryCount: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  }
);

export const paymentModel = mongoose.model<IPaymentDocument>('Payment', PaymentSchema);
