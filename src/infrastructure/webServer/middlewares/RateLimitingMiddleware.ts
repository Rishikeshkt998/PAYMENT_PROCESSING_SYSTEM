import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import RedisStore from 'rate-limit-redis';
import redisClient from '../../cache/RedisService';

export class RateLimitingMiddleware {
  /**
   * Generates a unique signature for the request based on method, path, query, and body.
   */
  private static generateRequestSignature(req: Request): string {
    const method = req.method;
    const path = req.path;
    const query = JSON.stringify(req.query || {});
    const body = JSON.stringify(req.body || {});

    const signatureString = `${method}:${path}:${query}:${body}`;
    return crypto.createHash('sha256').update(signatureString).digest('hex');
  }

  /**
   * Generates a rate-limit key combining IP, User-Agent, and Request Signature.
   * This prevents simple automated script attacks.
   */
  private static keyGenerator = (req: Request): string => {
    const ip = ipKeyGenerator(req.ip as string);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const userAgentHash = crypto
      .createHash('sha256')
      .update(userAgent)
      .digest('hex')
      .slice(0, 10);
    const requestSignature = RateLimitingMiddleware.generateRequestSignature(req);

    return `${ip}:${userAgentHash}:${requestSignature}`;
  };

  private static getWindowMs(envVar: string, defaultMinutes: number): number {
    const minutes = parseInt(process.env[envVar] || defaultMinutes.toString());
    return minutes * 60 * 1000;
  }

  private static getMaxRequests(envVar: string, defaultMax: number): number {
    return parseInt(process.env[envVar] || defaultMax.toString());
  }

  /**
   * Global Rate Limiter using Redis for distributed support.
   */
  static generalRateLimit = rateLimit({
    windowMs: RateLimitingMiddleware.getWindowMs('RATE_LIMIT_WINDOW_MINUTES', 15),
    limit: RateLimitingMiddleware.getMaxRequests('RATE_LIMIT_MAX_REQUESTS', 100),
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: RateLimitingMiddleware.keyGenerator,
    validate: { ip: false },
    skip: () => redisClient.status !== 'ready',
    store: new RedisStore({
      // @ts-expect-error - type mismatch with ioredis
      sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    handler: (req: Request, res: Response, next: NextFunction) => {
      res.status(429).json({
        status: 'error',
        message: 'Too many requests. Please try again later.',
        timestamp: new Date().toISOString(),
      });
    },
  });

  /**
   * Helper to create custom rate limits for specific routes if needed.
   */
  static createCustomRateLimit(options: {
    windowMs?: number;
    limit?: number;
    message?: string;
  }) {
    return rateLimit({
      windowMs: options.windowMs || 15 * 60 * 1000,
      limit: options.limit || 100,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: RateLimitingMiddleware.keyGenerator,
      validate: { ip: false },
      skip: () => redisClient.status !== 'ready',
      store: new RedisStore({
        // @ts-expect-error - type mismatch
        sendCommand: (...args: string[]) => redisClient.call(...args),
      }),
      handler: (req: Request, res: Response, next: NextFunction) => {
        res.status(429).json({
          status: 'error',
          message: options.message || 'Too many attempts. Please slow down.',
          timestamp: new Date().toISOString(),
        });
      },
    });
  }
}
