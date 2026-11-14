import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

describe('Redis rate limit failure handling', () => {
  it.each([null, [], [1, 2], ['1', 2, 0, 0]])(
    'rejects an invalid Redis response %j',
    async (reply) => {
      const redis = { evaluate: jest.fn().mockResolvedValue(reply) };
      const storage = new RedisThrottlerStorage(
        redis as unknown as RedisService,
        'test',
      );
      await expect(
        storage.increment('key', 60_000, 5, 60_000, 'default'),
      ).rejects.toMatchObject({ status: 503 });
    },
  );

  it('fails closed with a safe service error when Redis is not ready', async () => {
    const redis = new RedisService(
      new ConfigService({ REDIS_URL: 'redis://localhost:1' }),
    );
    const storage = new RedisThrottlerStorage(redis, 'test');
    try {
      await expect(
        storage.increment('key', 60_000, 5, 60_000, 'default'),
      ).rejects.toMatchObject({
        status: 503,
        message: 'Rate limiting service unavailable',
      });
    } finally {
      await redis.onModuleDestroy();
    }
  });
});
