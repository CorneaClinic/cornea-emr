import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './core/logger.js';
import { requestIdMiddleware } from './core/middleware/requestId.js';
import { notFoundHandler } from './core/middleware/notFound.js';
import { errorHandler } from './core/middleware/errorHandler.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import v1Router from './routes/v1.js';
import { createRateLimiter, clientIpKey } from './core/middleware/rateLimit.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestIdMiddleware);
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  const corsOrigins = env.corsOrigin === '*'
    ? true
    : env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    const limit = req.path.startsWith('/api/v1/admin/migration') ? '50mb' : '1mb';
    return express.json({ limit })(req, res, next);
  });
  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    }
  }));

  app.get('/', (_req, res) => {
    res.json({
      service: 'cornea-emr-api',
      version: env.apiVersion,
      docs: '/health'
    });
  });

  app.use('/health', healthRouter);
  app.use('/api/v1/auth', authRouter);
  if (env.nodeEnv === 'test') {
    app.use('/api/v1', v1Router);
  } else {
    app.use(
      '/api/v1',
      createRateLimiter({
        windowMs: env.rateLimit.apiWindowMs,
        max: env.rateLimit.apiMaxPerIp,
        keyGenerator: clientIpKey,
        namespace: 'api-v1'
      }),
      v1Router
    );
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
