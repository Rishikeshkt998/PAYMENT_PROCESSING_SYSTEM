import { NextFunction, Request, Response } from 'express';
import { IProcessPaymentUseCase } from '../useCases/processPayment/IProcessPaymentUseCase';
import logger from '../infrastructure/logging/AppLogger';

type PaymentControllerConstructorParams = {
  ProcessPaymentUseCase: IProcessPaymentUseCase;
};

/**
 * Handles incoming HTTP requests related to payment operations.
 * Decouples the web framework (Express) from the business logic (Use Cases).
 */
export default class PaymentController {
  private processPaymentUseCase: IProcessPaymentUseCase;

  constructor({ ProcessPaymentUseCase: useCase }: PaymentControllerConstructorParams) {
    this.processPaymentUseCase = useCase;
  }

  /**
   * Initiates a new payment transaction.
   * Validation is handled within the use case using Yup.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { payment, isIdempotent } = await this.processPaymentUseCase.initiatePayment(req.body);

      if (isIdempotent) {
        res.status(200).json({ message: 'Idempotent response', payment });
        return;
      }

      res.status(201).json({ message: 'Payment initiated', payment });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Retrieves the current status of a payment by its unique database ID.
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Payment ID is required' });
      return;
    }

    try {
      const payment = await this.processPaymentUseCase.getPaymentStatus(id as string);
      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      res.status(200).json({ payment });
    } catch (error: any) {
      next(error);
    }
  }

  /**
   * Processes incoming webhooks from external payment providers.
   */
  async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { externalId, status, message } = req.body;

    if (!externalId || !status) {
      res.status(400).json({ error: 'externalId and status are required' });
      return;
    }

    logger.info(`[PAYMENT_CONTROLLER] Webhook — externalId: ${externalId}, status: ${status}`);

    try {
      await this.processPaymentUseCase.handleWebhook({ externalId, status, message });

      res.status(200).json({
        message: 'Webhook received and processed',
        received: { externalId, status, message },
      });
    } catch (error: any) {
      next(error);
    }
  }
}
