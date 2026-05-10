import Redis from 'ioredis';
import logger from '../logging/AppLogger';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

redis.once('connect', () => logger.info('[REDIS] Connected'));
redis.on('error', (err: any) => {
  if (err.code === 'ECONNRESET') return; // Ignore idle timeouts from Cloud providers
  logger.error('[REDIS] Connection error:', err);
});

export class LockService {
  private static LOCK_PREFIX = 'lock:payment:';

  static async acquireLock(paymentId: string, ttlSeconds = 30): Promise<boolean> {
    const key = `${this.LOCK_PREFIX}${paymentId}`;
    const result = await redis.set(key, 'locked', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  static async releaseLock(paymentId: string): Promise<void> {
    const key = `${this.LOCK_PREFIX}${paymentId}`;
    await redis.del(key);
  }
}

export default redis;
