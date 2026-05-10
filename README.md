# 💳 Production-Grade Payment Processing System

A robust, enterprise-ready payment processing backend built with **Clean Architecture** principles. This system is designed to handle distributed concurrency, guarantee idempotency, and provide resilient failure recovery.

---

## 🏗️ Architecture & Design Patterns

This project follows **Clean Architecture** (Dependency Inversion), ensuring that the business logic (Use Cases) is completely decoupled from the infrastructure (Databases, Gateways, Frameworks).

-   **Presentation Layer**: Express.js Controllers handling HTTP requests/responses.
-   **Application Layer**: Use Cases containing the core business logic.
-   **Domain Layer**: Entities and Repository Interfaces.
-   **Infrastructure Layer**: Mongoose Models, Redis Cache, BullMQ Workers, and Gateway Simulators.

### Key Resilience Patterns
-   **Idempotency**: Every payment request is guarded by an `idempotencyKey`. This ensures that even if a network retry or a double-click occurs, the customer is only charged once.
-   **Distributed Locking**: Uses **Redis** to implement mutex locks. This prevents "Race Conditions" where multiple workers might try to process the same payment status update simultaneously.
-   **State Machine Protection**: Strict transitions (e.g., a payment cannot move from `SUCCESS` to `FAILED`) are enforced at the Use Case level.
-   **Asynchronous Processing**: High-latency gateway calls are handled in the background, allowing the API to remain highly responsive.

---

## 🚀 Features

-   ✅ **Distributed Rate Limiting**: Shared across multiple server instances using Redis.
-   ✅ **Excluded Paths**: Support for bypassing rate limits on specific routes (e.g., `/health`, `/docs`).
-   ✅ **Automatic Retries**: Exponential backoff strategy using **BullMQ** for failed gateway transactions.
-   ✅ **Webhook Security**: Handles asynchronous updates from external providers with concurrency protection.
-   ✅ **Structured Logging**: Production-ready logging using **Winston**.

---

## 🛠️ Tech Stack

-   **Runtime**: Node.js with TypeScript
-   **Framework**: Express.js
-   **Database**: MongoDB (Mongoose)
-   **Cache/Message Broker**: Redis (ioredis)
-   **Task Queue**: BullMQ
-   **Validation**: Zod (Schema validation)
-   **Testing**: Jest & Supertest

---

## 📂 Project Structure

```text
src/
├── controllers/            # HTTP Entry points
├── domain/
│   ├── dtos/               # Data Transfer Objects (Strict typing)
│   ├── entities/           # Business models
│   └── repositories/       # Interface definitions
├── infrastructure/
│   ├── cache/              # Redis & Locking services
│   ├── config/             # App configuration (Excluded paths, etc.)
│   ├── database/           # MongoDB Connection & Models
│   ├── ioc/                # Awilix Dependency Injection Registry
│   ├── logging/            # Winston Logger setup
│   ├── routes/             # Express Route definitions
│   └── webServer/          # Express App & Middlewares
├── repositories/           # Concrete Repository implementations
└── useCases/               # Core business logic (Process, Retry, etc.)
tests/                      # Mirror of src/ for Unit & Integration tests
```

---

## ⚙️ Getting Started

### 1. Prerequisites
-   Node.js (v18+)
-   MongoDB
-   Redis

### 2. Installation
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root:
```env
PORT=3000
MONGO_URI=mongodb://localhost:27017/payment_processing
REDIS_URL=redis://localhost:6379
RATE_LIMIT_EXCLUDED_PATHS=/health,/api/docs
```

### 4. Running the App
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

---

## 📡 API Documentation

### 1. Initiate Payment
`POST /payments`
**Request Body:**
```json
{
  "amount": 2500,
  "currency": "USD",
  "idempotencyKey": "order_unique_999"
}
```
**Response:** `201 Created`

### 2. Check Status
`GET /payments/:id`

### 3. Handle External Webhook
`POST /webhooks/gateway`
**Request Body:**
```json
{
  "externalId": "txn_83742",
  "status": "SUCCESS",
  "message": "Payment verified by bank"
}
```

---

## 🧪 Testing

### Automated Tests
Run the full suite of logic and concurrency tests:
```bash
npm test
```

### Manual Rate Limit Test
1. Set `limit: 5` in `src/infrastructure/webServer/middlewares/rateLimiter.ts`.
2. Spam `GET /payments`.
3. You will be blocked with a `429` error.
4. Visit `GET /health` — it will still work because it is in the `EXCLUDED_PATHS`.
