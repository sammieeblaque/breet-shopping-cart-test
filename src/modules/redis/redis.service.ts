import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly redisClient: Redis;

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
      db: this.configService.get<number>('REDIS_DB') || 0,
    });
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }

  getClient(): Redis {
    return this.redisClient;
  }

  // Distributed locking implementation for handling concurrent operations
  async acquireLock(key: string, ttl: number = 30000): Promise<string | null> {
    const token = Math.random().toString(36).substring(2);
    const acquired = await this.redisClient.set(
      `lock:${key}`,
      token,
      'PX',
      ttl,
      'NX',
    );

    return acquired ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<boolean> {
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redisClient.eval(script, 1, `lock:${key}`, token);

    return result === 1;
  }

  // Cache methods
  async cacheGet(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  async cacheSet(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.redisClient.set(key, value, 'PX', ttl);
    } else {
      await this.redisClient.set(key, value);
    }
  }

  async cacheDelete(key: string): Promise<void> {
    await this.redisClient.del(key);
  }

  async cacheInvalidatePattern(pattern: string): Promise<void> {
    const keys = await this.redisClient.keys(pattern);
    if (keys.length > 0) {
      await this.redisClient.del(...keys);
    }
  }
}
