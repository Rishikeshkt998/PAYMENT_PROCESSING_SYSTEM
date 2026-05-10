import mongoose from 'mongoose';
import logger from '../logging/AppLogger';

export class MongoConnection {
  static async connect(): Promise<void> {
    try {
      const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/payment_system';
      await mongoose.connect(uri);
      logger.info('[MONGO] Connected to MongoDB');
    } catch (error) {
      logger.error('Error connecting to MongoDB:', error);
      process.exit(1);
    }
  }

  static async disconnect(): Promise<void> {
    try {
      await mongoose.disconnect();
      logger.info('[MONGO] Database disconnected successfully');
    } catch (error) {
      logger.error('[MONGO] Database disconnect error:', error);
      throw error;
    }
  }
}
