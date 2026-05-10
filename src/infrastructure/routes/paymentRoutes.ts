import { Router } from 'express';
import container from '../ioc/registry';
import PaymentController from '../../controllers/PaymentController';

const router = Router();

const paymentController = container.resolve<PaymentController>('PaymentController');

router.post('/', (req, res, next) => paymentController.create(req, res, next));
router.get('/:id', (req, res, next) => paymentController.getStatus(req, res, next));

export default router;
