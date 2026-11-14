import { Injectable, Logger, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
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
    // ---- Cache helpers: ถ้า Redis ล่ม ให้ข้าม cache แล้วไปอ่าน DB (ไม่ throw 503) ----
  async getJson<T>(key: string): Promise<T | null> {
    try {
      if (!this.client.isReady) return null;
      const raw = await this.client.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      if (!this.client.isReady) return;
      await this.client.set(key, JSON.stringify(value), {
        expiration: { type: 'EX', value: ttlSeconds },
      });
    } catch {
      // ข้ามได้ cache เป็นแค่ตัวช่วย
    }
  }

  // ล้าง cache ด้วยการเพิ่มเลข version (key เก่าหมดอายุเองใน 60 วินาที)
  async getCacheVersion(name: string): Promise<string> {
    try {
      if (!this.client.isReady) return '0';
      return (await this.client.get(`cache:version:${name}`)) ?? '0';
    } catch {
      return '0';
    }
  }

  async bumpCacheVersion(name: string): Promise<void> {
    try {
      if (!this.client.isReady) return;
      await this.client.incr(`cache:version:${name}`);
    } catch {
      // ข้ามได้
    }
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.client.isReady) return false;
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}
