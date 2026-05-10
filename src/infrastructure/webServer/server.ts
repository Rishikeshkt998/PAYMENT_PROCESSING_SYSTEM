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
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from '../../../swagger.json';
import { MongoConnection } from '../database/MongoConnection';
import redisClient from '../cache/RedisService';

const createServer = async (): Promise<Application> => {
  const app: Application = express();
  const server: http.Server = http.createServer(app);

  // Trust proxy for correct rate limiting IP detection (matching brocamp-tool-v2)
  app.set('trust proxy', 1);

  try {
    // 1. Connect databases
    await MongoConnection.connect();
    // Redis automatically connects, but we log it
    logger.info('[REDIS] Initializing Redis connection...');

    // Add graceful shutdown for services
    process.on('SIGTERM', async () => {
      logger.info('Gracefully shutting down services...');
      await MongoConnection.disconnect();
      redisClient.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Gracefully shutting down services...');
      await MongoConnection.disconnect();
      redisClient.disconnect();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to setup databases:', error);
  }

  // 2. Apply Middlewares
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isRateLimitExcluded(req.path)) {
      return next();
    }
    return RateLimitingMiddleware.generalRateLimit(req, res, next);
  });

  // Global Auth Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (isAuthExcluded(req.path)) {
      return next();
    }
    return AuthMiddleware.verifyToken(req, res, next);
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging middleware
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info(`[${req.method}] ${req.url}`);
    next();
  });

  // 3. Apply Routes
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  app.use('/payments', paymentRoutes);
  app.use('/webhooks', webhookRoutes);
  app.use('/auth', authRoutes);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // 404 fallback
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Error Handler
  app.use(handleErrors);

  // 4. Start listening
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    logger.info(
      `[Server] ⚡️: Server is running on port http://localhost:${PORT}`,
    );
  });

  return app;
};

export default createServer;
