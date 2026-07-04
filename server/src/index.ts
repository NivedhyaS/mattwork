import app from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import prisma from './config/database';

const startServer = async () => {
  try {
    // Test DB connection
    await prisma.$connect();
    logger.info('📦 Database connected successfully');

    const server = app.listen(env.PORT, () => {
      logger.info(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Closed out remaining connections.');
        process.exit(0);
      });

      // Force close if taking too long
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
