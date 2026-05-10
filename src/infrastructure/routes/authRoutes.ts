import { Router } from 'express';
import container from '../ioc/registry';
import AuthController from '../../controllers/AuthController';

const router = Router();

// Resolve the AuthController from the DI container
const authController = container.resolve<AuthController>('AuthController');

/**
 * Authentication Routes
 * Publicly accessible routes for token generation.
 */
router.post('/generate-token', (req, res) => authController.generateToken(req, res));

export default router;
