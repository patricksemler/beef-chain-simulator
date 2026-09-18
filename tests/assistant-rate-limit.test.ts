import { describe, expect, it } from 'vitest';
import {
  consumeUserMessage,
  type AssistantD1,
} from '../lib/assistant/rate-limit';

class FakeD1 implements AssistantD1 {
  windows = new Map<string, number>();
  boundValues: unknown[] = [];

  prepare(query: string) {
    return {
      bind: (...values: unknown[]) => {
        this.boundValues.push(...values);
        return {
          first: async <T>() => this.first(query, values) as T | null,
          run: async () => this.run(query, values),
        };
      },
    };
  }

  private first(query: string, values: unknown[]) {
    if (query.includes('SELECT request_count')) {
      const [key, seconds, start] = values as [string, number, number];
      const requestCount = this.windows.get(`${key}:${seconds}:${start}`);
      return requestCount === undefined ? null : { requestCount };
    }
    return null;
  }

  private run(query: string, values: unknown[]) {
    if (query.includes('INSERT INTO assistant_rate_windows')) {
      const [key, seconds, start] = values as [string, number, number];
      const mapKey = `${key}:${seconds}:${start}`;
      this.windows.set(mapKey, (this.windows.get(mapKey) ?? 0) + 1);
    }
    return {};
  }
}

describe('assistant rate limits', () => {
  it('returns a one-minute limit on the ninth message', async () => {
    const db = new FakeD1();
    for (let index = 0; index < 8; index += 1) {
      await expect(
        consumeUserMessage(db, 'ip-hash', 1_000),
      ).resolves.toMatchObject({
        allowed: true,
      });
    }
    await expect(
      consumeUserMessage(db, 'ip-hash', 1_000),
    ).resolves.toMatchObject({
      allowed: false,
      retryAfter: 20,
    });
  });

  it('returns an hourly limit after 80 messages and never stores a raw key', async () => {
    const db = new FakeD1();
    for (let minute = 0; minute < 10; minute += 1) {
      for (let request = 0; request < 8; request += 1) {
        const result = await consumeUserMessage(
          db,
          'ip-hash',
          60 + minute * 60,
        );
        expect(result.allowed).toBe(true);
      }
    }
    await expect(consumeUserMessage(db, 'ip-hash', 670)).resolves.toMatchObject(
      {
        allowed: false,
      },
    );
    expect(db.boundValues).not.toContain('sk-user-secret');
  });
});
