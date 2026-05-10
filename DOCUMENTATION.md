This document provides the full implementation details for the three core layers of the application: **Controllers**, **Use Cases**, and **Repositories**.

---

## 🌍 Real-World Business Scenarios

The patterns in this codebase are designed to solve critical financial problems encountered by platforms like **Stripe** or **PayPal**.

### 1. The "Double-Click" Problem (Idempotency)
**Scenario**: A customer with a slow internet connection clicks "Pay Now" three times.
**The Fix**: Our `idempotencyKey` logic ensures the customer is only charged **once**. Subsequent clicks simply return the first successful result from the database without talking to the bank again.

### 2. The "Slow Bank" Problem (Asynchronous Processing)
**Scenario**: A bank takes 15 seconds to authorize a high-value card transaction.
**The Fix**: We return a `201 Initiated` response to the user immediately and process the payment in the **background**. This keeps the website fast and prevents "Loading..." timeouts.

### 3. The "Delayed Confirmation" Problem (Webhooks)
**Scenario**: A user pays via Bank Transfer. The money arrives 2 hours after the user has closed their browser.
**The Fix**: Our **Webhook API** allows the bank to "call back" our server hours later. We find the original payment using the `externalId` and mark it as `SUCCESS`, even if the user is offline.

### 4. The "Race Condition" Problem (Redis Locking)
**Scenario**: A background process and a webhook notification try to update the same payment at the exact same millisecond.
**The Fix**: We use **Redis Distributed Locking**. Only one process can "hold the key" to a payment at a time. This prevents data corruption or double-accounting.

---

## 1. Presentation Layer (Controllers)
Controllers are responsible for parsing incoming HTTP requests, validating inputs, and delegating work to the Use Cases.

### PaymentController (`src/controllers/PaymentController.ts`)
Handles all payment-related HTTP traffic.

```typescript
import { Request, Response, NextFunction } from 'express';
import ProcessPaymentUseCase from '../useCases/processPayment/ProcessPaymentUseCase';
import { IPaymentRepository } from '../domain/repositories/IPaymentRepository';

export default class PaymentController {
  private processPaymentUseCase: ProcessPaymentUseCase;
  private paymentRepository: IPaymentRepository;

  constructor({ ProcessPaymentUseCase, PaymentRepository }: any) {
    this.processPaymentUseCase = ProcessPaymentUseCase;
    this.paymentRepository = PaymentRepository;
  }

  /**
   * POST /payments
   * Initiates a new payment transaction.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { amount, currency, idempotencyKey, metadata } = req.body;
      
      const result = await this.processPaymentUseCase.initiatePayment({
        amount,
        currency,
        idempotencyKey,
        metadata,
      });

      res.status(result.isIdempotent ? 200 : 201).json({
        status: 'success',
        message: result.isIdempotent ? 'Idempotent response' : 'Payment initiated',
        payment: result.payment,
      });
    } catch (error) {
      next(error); // Delegate to Global Error Handler
    }
  }

  /**
   * GET /payments/:id
   * Retrieves the current status of a payment.
   */
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await this.paymentRepository.findById(id);

      if (!payment) {
        res.status(404).json({ status: 'error', message: 'Payment not found' });
        return;
      }

      res.status(200).json({ status: 'success', payment });
    } catch (error) {
      next(error);
    }
  }
}
```

### AuthController (`src/controllers/AuthController.ts`)
Handles security and token generation.

```typescript
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export default class AuthController {
  private secret = process.env.JWT_SECRET || 'fallback-secret';

  async generateToken(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body;

    // Simple validation for testing
    if (email === 'admin@example.com' && password === 'admin123') {
      const token = jwt.sign(
        { id: 'admin_user_1', email, role: 'ADMIN' },
        this.secret,
        { expiresIn: '1h' }
      );

      res.status(200).json({ status: 'success', token });
    } else {
      res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }
  }
}
```

---

## 2. Application Layer (Use Cases)
Use Cases contain the pure business logic and are independent of the web framework.

### ProcessPaymentUseCase (`src/useCases/processPayment/ProcessPaymentUseCase.ts`)
This is the "Engine" of the system.

```typescript
import { IPaymentRepository } from '../../domain/repositories/IPaymentRepository';
import { IPaymentGateway } from '../../domain/services/IPaymentGateway';
import { LockService } from '../../infrastructure/cache/RedisService';
import { PaymentStatus } from '../../domain/PaymentEntity';
import * as yup from 'yup';

export default class ProcessPaymentUseCase {
  constructor(private PaymentRepository: IPaymentRepository, private GatewaySimulator: IPaymentGateway) {}

  // Validation Schema
  private schema = yup.object().shape({
    amount: yup.number().positive().required(),
    currency: yup.string().length(3).required(),
    idempotencyKey: yup.string().required(),
  });

  async initiatePayment(data: any) {
    // 1. Validation
    await this.schema.validate(data);

    // 2. Idempotency Check
    const existing = await this.PaymentRepository.findByIdempotencyKey(data.idempotencyKey);
    if (existing) return { payment: existing, isIdempotent: true };

    // 3. Create Pending Record
    const payment = await this.PaymentRepository.create({
      ...data,
      status: PaymentStatus.PENDING,
      externalId: `ext_${Math.random().toString(36).substr(2, 9)}`
    });

    // 4. Background Processing (Fire-and-Forget)
    this.processPayment(payment._id as string).catch(err => console.error(err));

    return { payment, isIdempotent: false };
  }

  async processPayment(paymentId: string) {
    const lock = await LockService.acquireLock(paymentId);
    if (!lock) return;

    try {
      await this.PaymentRepository.updateStatus(paymentId, PaymentStatus.PROCESSING);
      const res = await this.GatewaySimulator.process(100, 'USD');
      
      const status = res.success ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
      await this.PaymentRepository.updateStatus(paymentId, status);
    } finally {
      // Lock will expire automatically in Redis
    }
  }
}
```

---

## 3. Data Layer (Repositories)
Repositories handle the communication with MongoDB using Mongoose.

### PaymentRepository (`src/repositories/paymentRepository/PaymentRepository.ts`)
Encapsulates all database operations.

```typescript
import { IPaymentRepository } from '../../domain/repositories/IPaymentRepository';
import { PaymentModel } from '../../infrastructure/database/PaymentModel';
import { IPayment, PaymentStatus } from '../../domain/PaymentEntity';

export default class PaymentRepository implements IPaymentRepository {
  async create(data: Partial<IPayment>): Promise<IPayment> {
    const payment = new PaymentModel(data);
    return await payment.save();
  }

  async findById(id: string): Promise<IPayment | null> {
    return await PaymentModel.findById(id);
  }

  async findByIdempotencyKey(key: string): Promise<IPayment | null> {
    return await PaymentModel.findOne({ idempotencyKey: key });
  }

  async findByExternalId(externalId: string): Promise<IPayment | null> {
    return await PaymentModel.findOne({ externalId });
  }

  async updateStatus(id: string, status: PaymentStatus): Promise<void> {
    await PaymentModel.findByIdAndUpdate(id, { status });
  }
}
```

---

## 4. Interaction Summary
1.  **Request** enters via `server.ts`.
2.  **AuthMiddleware** verifies the token.
3.  **PaymentController** receives the request and resolves **ProcessPaymentUseCase**.
4.  **ProcessPaymentUseCase** validates data and checks **PaymentRepository** for idempotency.
5.  **PaymentRepository** queries **MongoDB**.
6.  **Redis** handles the concurrency lock during processing.
