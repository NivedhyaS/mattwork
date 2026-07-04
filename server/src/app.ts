import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { apiLimiter, publicLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import v1Routes from './routes';

const app: Express = express();

// Security Middleware
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting (apply globally for basic protection)
app.use(publicLimiter);

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1', apiLimiter, v1Routes);

// Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
