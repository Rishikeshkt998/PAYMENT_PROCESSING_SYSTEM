import 'dotenv/config';
import logger from './infrastructure/logging/AppLogger';
import createServer from './infrastructure/webServer/server';

// Bootstrap IOC container
import './infrastructure/ioc/registry';

// Start the server
const start = async (): Promise<void> => {
  try {
    const server = await createServer();
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
};

start();
