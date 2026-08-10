import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

export function configureHttpSecurity(
  app: NestExpressApplication,
  config: ConfigService,
): void {
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  const trustProxyHops = Number(config.get<string>('TRUST_PROXY_HOPS') ?? '0');
  const frontendOrigin = config.getOrThrow<string>('FRONTEND_ORIGIN');

  if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0) {
    throw new Error('TRUST_PROXY_HOPS 必须是大于或等于 0 的整数');
  }

  // 只信任部署人员明确配置的反向代理层数，避免伪造 X-Forwarded-For。
  app.set('trust proxy', trustProxyHops);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // API 与前端分开部署时，CORS 已负责控制读取权限。
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      strictTransportSecurity:
        nodeEnv === 'production'
          ? { maxAge: 31_536_000, includeSubDomains: true }
          : false,
    }),
  );

  app.enableCors({
    // Requests without Origin (curl, server-to-server) are allowed. Browser
    // requests must match the configured frontend exactly.
    origin: (origin, callback) => {
      callback(null, !origin || origin === frontendOrigin);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  });
}
