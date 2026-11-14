import type { INestApplication } from '@nestjs/common';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';

// Each case gets fresh counters while the real guard and limits stay enabled.
// This resets only this test app's default in-memory storage, not MySQL/Redis.
export function resetRateLimits(app: INestApplication): void {
  const storage = app.get<ThrottlerStorageService>(getStorageToken());
  // Public cleanup clears both counters and expiration tracking/sweep timers.
  storage.onApplicationShutdown();
}
