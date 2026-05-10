# 💳 Production-Grade Payment Processing System

A robust, enterprise-ready payment processing backend built with **Clean Architecture** principles. This system is designed to handle distributed concurrency, guarantee idempotency, and provide resilient failure recovery.

---

## 🌍 Real-World Business Scenarios
This system is designed to solve critical financial problems:
- **Idempotency**: Prevents double-charging users if they double-click the pay button.
- **Asynchronous Flow**: Keeps the user experience fast while bank processing happens in the background.
- **Webhooks**: Handles delayed payment confirmations from banks.
- **Distributed Locking**: Prevents race conditions during simultaneous status updates.

---

## 🚀 Key Features
- ✅ **Global JWT Authentication**: Secure APIs using standardized Bearer tokens.
- ✅ **Distributed Rate Limiting**: Shared across multiple server instances using Redis with unique fingerprinting.
- ✅ **Centralized Security**: Handled at the infrastructure level with path-based exclusions.
- ✅ **Idempotency Control**: Guarantees that a transaction is only processed once.
- ✅ **Fail-Open Strategy**: High availability for Rate Limiting even if Redis is unreachable.
- ✅ **Structured Logging**: Production-ready logging using **Winston**.

---

## 🛠️ Tech Stack
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Cache/Locking**: Redis (ioredis)
- **Validation**: Yup
- **DI Container**: Awilix (Registry Pattern)
- **Authentication**: JsonWebToken (JWT)

---

## ⚙️ Quick Start

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
Create a `.env` file:
```env
PORT=3000
MONGO_URI=your_mongo_uri
REDIS_URL=your_redis_url
JWT_SECRET=your_secret_key
RATE_LIMIT_EXCLUDED_PATHS=/health,/api/docs
```

### 3. Running the App
```bash
# Development mode
npm run dev
```

---

## 📡 API Reference (Simplified)

### 1. Generate Token
`POST /auth/generate-token`
- Payload: `{"email": "admin@example.com", "password": "admin123"}`

### 2. Initiate Payment
`POST /payments` (Auth Required)
- Payload: `{"amount": 500, "currency": "USD", "idempotencyKey": "unique_1"}`

### 3. Check Status
`GET /payments/:id` (Auth Required)

### 4. Handle External Webhook
`POST /webhooks/gateway` (Public)

---

## 📖 Detailed Documentation
For a complete, line-by-line technical walkthrough of every file and implementation detail, please refer to:
### 👉 [DOCUMENTATION.md](./DOCUMENTATION.md)

---
*Status: Production Ready & Documented.*
