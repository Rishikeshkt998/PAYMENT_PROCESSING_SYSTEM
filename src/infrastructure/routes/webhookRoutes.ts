import { Router } from 'express';
import container from '../ioc/registry';
import PaymentController from '../../controllers/PaymentController';

const router = Router();

const paymentController = container.resolve<PaymentController>('PaymentController');

router.post('/gateway', (req, res, next) => paymentController.handleWebhook(req, res, next));

export default router;
