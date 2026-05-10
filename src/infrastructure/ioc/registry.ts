import { asClass, createContainer, InjectionMode } from 'awilix';

// Infrastructure — Data Layer
import PaymentRepository from '../../repositories/paymentRepository/PaymentRepository';
import ExternalGatewaySimulator from '../gateway/GatewaySimulator';

// Use Cases — Application Layer
import RetryPaymentUseCase from '../../useCases/retryPayment/RetryPaymentUseCase';
import ProcessPaymentUseCase from '../../useCases/processPayment/ProcessPaymentUseCase';

// Controllers — Presentation Layer
import PaymentController from '../../controllers/PaymentController';
import AuthController from '../../controllers/AuthController';

const container = createContainer({
  injectionMode: InjectionMode.PROXY,
});

container.register({
  // --- Data Layer ---
  PaymentRepository: asClass(PaymentRepository).singleton(),
  GatewaySimulator: asClass(ExternalGatewaySimulator).singleton(),

  // --- Application Layer ---
  RetryPaymentUseCase: asClass(RetryPaymentUseCase).singleton(),
  ProcessPaymentUseCase: asClass(ProcessPaymentUseCase).singleton(),

  // --- Presentation Layer ---
  PaymentController: asClass(PaymentController).singleton(),
  AuthController: asClass(AuthController).singleton(),
});

export default container;
