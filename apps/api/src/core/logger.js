import pino from 'pino';
import { env } from '../config/env.js';

const transport = env.isProduction
  ? undefined
  : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    };

export const logger = pino({
  level: env.logLevel,
  base: { service: 'cornea-emr-api' },
  ...(transport ? { transport } : {})
});
