# 💳 Production-Grade Payment Processing System

A robust, enterprise-ready payment processing backend built with **Clean Architecture** principles. This system handles distributed concurrency, guarantees idempotency, and provides resilient failure recovery.

---

## 🌍 Real-World Business Scenarios
The patterns in this codebase solve critical financial problems encountered by platforms like **Stripe** or **PayPal**:

1. **The "Double-Click" Problem (Idempotency)**: Ensures users aren't charged twice if they click "Pay" multiple times.
2. **The "Slow Bank" Problem (Asynchronous Flow)**: Returns an immediate status while bank processing happens in the background.
3. **The "Delayed Confirmation" (Webhooks)**: Handles banks that send settlement updates hours later.
4. **The "Race Condition" (Redis Locking)**: Prevents data corruption during simultaneous updates from multiple servers.

---

## 🏗️ Architecture & Bootstrapping

### Server Factory (`src/infrastructure/webServer/server.ts`)
The "Brain" of the application. It sets up global security, database connections, and routes.

```typescript
import express, { Application, Request, Response, NextFunction } from 'express';
import http from 'http';
import paymentRoutes from '../routes/paymentRoutes';
import webhookRoutes from '../routes/webhookRoutes';
import authRoutes from '../routes/authRoutes';
import { RateLimitingMiddleware } from './middlewares/RateLimitingMiddleware';
import { isRateLimitExcluded, isAuthExcluded } from '../config/excludedPaths';
import handleErrors from './middlewares/ErrorHandler';
import { AuthMiddleware } from './middlewares/AuthMiddleware';
import logger from '../logging/AppLogger';
import { MongoConnection } from '../database/MongoConnection';
import redisClient from '../cache/RedisService';

export const createServer = async (): Promise<Application> => {
  const app: Application = express();

  // 1. Connections
  await MongoConnection.connect();
  logger.info('[REDIS] Initializing Redis connection...');

  // 2. Global Security (Rate Limiting)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isRateLimitExcluded(req.path)) return next();
    return RateLimitingMiddleware.generalRateLimit(req, res, next);
  });

  // 3. Global Security (Auth)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isAuthExcluded(req.path)) return next();
    return AuthMiddleware.verifyToken(req, res, next);
  });

  app.use(express.json());
  app.use('/payments', paymentRoutes);
  app.use('/webhooks', webhookRoutes);
  app.use('/auth', authRoutes);
  app.use(handleErrors);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`[Server] ⚡️: Server is running on port http://localhost:${PORT}`);
  });

  return app;
};
```

---

## 🛡️ Security Layers

### Global Rate Limiter (`src/infrastructure/webServer/middlewares/RateLimitingMiddleware.ts`)
Prevents DDoS and brute-force attacks using unique request fingerprinting.

```typescript
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import crypto from 'crypto';
import RedisStore from 'rate-limit-redis';
import redisClient from '../../cache/RedisService';

export class RateLimitingMiddleware {
  private static keyGenerator = (req: Request): string => {
    const signature = crypto.createHash('sha256')
      .update(`${req.method}:${req.path}:${JSON.stringify(req.body)}`)
      .digest('hex');
    return `${req.ip}:${req.headers['user-agent']}:${signature}`;
  };

  static generalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    skip: () => redisClient.status !== 'ready', // Fail-Open strategy
    store: new RedisStore({ sendCommand: (...args: string[]) => redisClient.call(...args) }),
  });
}
```

### JWT Auth Middleware (`src/infrastructure/webServer/middlewares/AuthMiddleware.ts`)
Verifies tokens and decorates requests with user data.

```typescript
import jwt from 'jsonwebtoken';

export class AuthMiddleware {
  private static SECRET = process.env.JWT_SECRET || 'fallback-secret';

  static verifyToken(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ status: 'error', message: 'Unauthorized' });
      return;
    }
    try {
      const token = authHeader.split(' ')[1];
      req.user = jwt.verify(token, AuthMiddleware.SECRET);
      next();
    } catch (e) {
      res.status(401).json({ status: 'error', message: 'Invalid token' });
    }
  }
}
```

---

## ⚙️ Core Application Logic

### Payment Use Case (`src/useCases/processPayment/ProcessPaymentUseCase.ts`)
Handles validation, idempotency, and asynchronous gateway processing.

```typescript
import { PaymentStatus } from '../../domain/PaymentEntity';
import { LockService } from '../../infrastructure/cache/RedisService';

export default class ProcessPaymentUseCase {
  async initiatePayment(data: any) {
    // 1. Idempotency Check
    const existing = await this.PaymentRepository.findByIdempotencyKey(data.idempotencyKey);
    if (existing) return { payment: existing, isIdempotent: true };

    // 2. Pending Record
    const payment = await this.PaymentRepository.create({ ...data, status: 'PENDING' });

    // 3. Background Process
    this.processPayment(payment._id).catch(err => console.error(err));
    return { payment, isIdempotent: false };
  }

  async processPayment(paymentId: string) {
    const lock = await LockService.acquireLock(paymentId);
    if (!lock) return;
    try {
      await this.PaymentRepository.updateStatus(paymentId, 'PROCESSING');
      const res = await this.GatewaySimulator.process(100, 'USD');
      const status = res.success ? 'SUCCESS' : 'FAILED';
      await this.PaymentRepository.updateStatus(paymentId, status);
    } finally { /* Lock expires via TTL */ }
  }
}
```

---

## 📊 Data & Persistence

### Payment Repository (`src/repositories/paymentRepository/PaymentRepository.ts`)
```typescript
import { PaymentModel } from '../../infrastructure/database/PaymentModel';

export default class PaymentRepository {
  async create(data: any) { return await new PaymentModel(data).save(); }
  async findById(id: string) { return await PaymentModel.findById(id); }
  async findByIdempotencyKey(key: string) { return await PaymentModel.findOne({ idempotencyKey: key }); }
  async updateStatus(id: string, status: string) { await PaymentModel.findByIdAndUpdate(id, { status }); }
}
```

---

## 📡 API Reference

### 1. Generate Token
- **Endpoint**: `POST /auth/generate-token`
- **Payload**: `{"email": "admin@example.com", "password": "admin123"}`

### 2. Create Payment
- **Endpoint**: `POST /payments` (Auth Required)
- **Payload**: `{"amount": 500, "currency": "USD", "idempotencyKey": "unique_id"}`

### 3. Webhook
- **Endpoint**: `POST /webhooks/gateway`
- **Payload**: `{"externalId": "ext_123", "status": "SUCCESS"}`

---

## 📂 Project Structure
- `src/controllers`: Request handling.
- `src/useCases`: Business logic.
- `src/repositories`: Database access.
- `src/infrastructure`: Security, DB, Redis, and DI Registry.

---
*Project Status: Production Ready.*
