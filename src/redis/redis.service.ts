import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: ReturnType<typeof createClient>;

  constructor(config: ConfigService) {
    this.client = createClient({
      url: config.getOrThrow<string>('REDIS_URL'),
      disableOfflineQueue: true,
      socket: {
        connectTimeout: 3000,
      },
    });

    this.client.on('error', () => {
      this.logger.error('Redis connection error');
    });
  }

  async revokeToken(jti: string, expiresAt: number): Promise<void> {
    try {
      if (!this.client.isReady) {
        throw new Error('Redis unavailable');
      }
      await this.client.set(`auth:revoked:${jti}`, '1', {
        expiration: { type: 'EXAT', value: expiresAt },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }
  }

  async isTokenRevoked(jti: string): Promise<boolean> {
    try {
      if (!this.client.isReady) {
        throw new Error('Redis unavailable');
      }
      return (await this.client.exists(`auth:revoked:${jti}`)) === 1;
    } catch {
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    if (this.client.isOpen) {
      await this.client.close();
    }
  }
}
