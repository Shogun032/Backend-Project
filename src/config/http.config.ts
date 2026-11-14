import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { parseTrustProxy } from './environment';

export function configureHttp(
  app: NestExpressApplication,
  config: ConfigService,
): void {
  app.set(
    'trust proxy',
    parseTrustProxy(config.get<unknown>('TRUST_PROXY', 'false')),
  );
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });
}
