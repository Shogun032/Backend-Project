import { ServiceUnavailableException } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
type StorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;
import { RedisService } from '../../redis/redis.service';

// All three keys share a Redis Cluster hash slot. Redis TIME avoids app clock skew.
// Trim/check/add/block happen atomically; denied hits do not grow the sorted set.
const INCREMENT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local block = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - ttl)
local count = redis.call('ZCARD', KEYS[1])
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local reset = ttl
if #oldest > 0 then reset = math.max(1, tonumber(oldest[2]) + ttl - now) end
local blocked = redis.call('PTTL', KEYS[2])
if blocked > 0 then
  return {limit + 1, math.ceil(reset / 1000), 1, math.ceil(blocked / 1000)}
end
if count >= limit then
  local retry = reset
  if block > 0 then
    retry = block
    redis.call('SET', KEYS[2], '1', 'PX', block)
    redis.call('DEL', KEYS[1], KEYS[3])
  end
  return {count + 1, math.ceil(reset / 1000), 1, math.ceil(retry / 1000)}
end
local sequence = redis.call('INCR', KEYS[3])
redis.call('ZADD', KEYS[1], now, tostring(sequence))
redis.call('PEXPIRE', KEYS[1], ttl)
redis.call('PEXPIRE', KEYS[3], ttl)
return {count + 1, math.ceil(reset / 1000), 0, 0}
`;

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: RedisService,
    private readonly prefix: string,
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    const base = `${this.prefix}:{${key}}:${throttlerName}`;
    const reply = await this.redis.evaluate(
      INCREMENT,
      [`${base}:hits`, `${base}:block`, `${base}:sequence`],
      [String(ttl), String(limit), String(blockDuration)],
    );
    if (
      !Array.isArray(reply) ||
      reply.length !== 4 ||
      !reply.every(
        (value: unknown) => typeof value === 'number' && Number.isFinite(value),
      )
    ) {
      throw new ServiceUnavailableException(
        'Rate limiting service unavailable',
      );
    }
    const [totalHits, timeToExpire, blocked, timeToBlockExpire] =
      reply as number[];
    return {
      totalHits,
      timeToExpire,
      isBlocked: blocked === 1,
      timeToBlockExpire,
    };
  }
}
