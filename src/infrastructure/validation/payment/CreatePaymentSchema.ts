import * as Yup from 'yup';

export const CreatePaymentSchema = Yup.object().shape({
  amount: Yup.number().positive().required('amount is required'),
  currency: Yup.string()
    .length(3, 'currency must be exactly 3 characters')
    .required('currency is required'),
  idempotencyKey: Yup.string().required('idempotencyKey is required'),
  metadata: Yup.object().optional(),
});
