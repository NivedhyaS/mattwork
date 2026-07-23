import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { apiLimiter, publicLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import v1Routes from './routes';

const app: Express = express();

// Trust the first proxy (ngrok / reverse proxy) so req.protocol resolves to "https"
// and X-Forwarded-For is handled correctly.
app.set('trust proxy', 1);

// Build allowed origins list from the comma-separated CORS_ORIGIN env var.
// This lets us allow both http://localhost:3000 AND the ngrok HTTPS URL simultaneously.
const allowedOrigins = env.CORS_ORIGIN
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

// Apply Helmet security headers.
// In development the Express server proxies Next.js, which injects inline scripts
// (self.__next_f RSC chunks, HMR, beforeInteractive scripts). Helmet's default
// Content-Security-Policy blocks 'unsafe-inline' and causes:
//   - CSP inline script violations in the browser console
//   - InvariantError: Expected a request ID (self.__next_f was never initialised)
//   - "Checking credentials..." spinner that never resolves
// Disabling CSP in dev is safe because this is a local development proxy only.
// In production Next.js is served from its own built output and Helmet's CSP is fine.
app.use(
  helmet({
    contentSecurityPolicy: env.NODE_ENV === 'development' ? false : undefined,
    crossOriginEmbedderPolicy: env.NODE_ENV === 'development' ? false : undefined,
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, Pub/Sub)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);
// Transparent Next.js development proxy for local/external unified ngrok demo
app.use((req, res, next) => {
  // Bypass API, health, static uploads, or common system requests
  if (
    req.url.startsWith('/api') ||
    req.url.startsWith('/health') ||
    req.url.startsWith('/uploads')
  ) {
    return next();
  }

  // Gracefully end WebSocket upgrade requests
  if (
    req.headers.upgrade === 'websocket' ||
    req.headers.connection?.toLowerCase().includes('upgrade')
  ) {
    res.status(200).end();
    return;
  }

  const http = require('http');
  const headers = { ...req.headers };
  delete headers.host;

  // Keep streaming SSE open for Next.js HMR
  const isHmr = req.url.includes('webpack-hmr');
  if (!isHmr) {
    headers.connection = 'close';
  }

  const proxyReq = http.request(
    {
      host: '127.0.0.1',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: headers,
    },
    (proxyRes: any) => {
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', () => {
    if (!res.headersSent) {
      res.status(502).send('Next.js dev server on port 3000 is loading or offline');
    }
  });

  if (['GET', 'HEAD'].includes(req.method)) {
    proxyReq.end();
  } else {
    req.pipe(proxyReq);
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Temporary request logging
app.use((req, res, next) => {
  console.log(`[DEBUG] Incoming Request: ${req.method} ${req.url}`);
  if (req.url.includes('google-form')) {
    console.log('[DEBUG] Webhook Body:', req.body);
  }
  next();
});

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
