import { describe, expect, it } from 'vitest';
import {
  claimTurn,
  consumeUserMessage,
  recordTurnSteps,
  releaseTurn,
  type AssistantD1,
} from '../lib/assistant/rate-limit';

interface Lock {
  turnId: string;
  expiresAt: number;
  stepsUsed: number;
}

class FakeD1 implements AssistantD1 {
  locks = new Map<string, Lock>();
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

  async batch() {
    return [];
  }

  private first(query: string, values: unknown[]) {
    if (query.includes('INSERT INTO assistant_turn_locks')) {
      const [sessionHash, turnId, expiresAt, now] = values as [
        string,
        string,
        number,
        number,
      ];
      const existing = this.locks.get(sessionHash);
      if (existing && existing.turnId !== turnId && existing.expiresAt > now) {
        return null;
      }
      const stepsUsed = existing?.turnId === turnId ? existing.stepsUsed : 0;
      this.locks.set(sessionHash, { turnId, expiresAt, stepsUsed });
      return { turnId, stepsUsed };
    }
    if (query.includes('SELECT request_count')) {
      const [key, seconds, start] = values as [string, number, number];
      const requestCount = this.windows.get(`${key}:${seconds}:${start}`);
      return requestCount === undefined ? null : { requestCount };
    }
    return null;
  }

  private run(query: string, values: unknown[]) {
    if (query.includes('DELETE FROM assistant_turn_locks')) {
      const [sessionHash, turnId] = values as [string, string];
      if (this.locks.get(sessionHash)?.turnId === turnId) {
        this.locks.delete(sessionHash);
      }
    }
    if (query.includes('SET steps_used = steps_used +')) {
      const [steps, sessionHash, turnId] = values as [number, string, string];
      const lock = this.locks.get(sessionHash);
      if (lock?.turnId === turnId) lock.stepsUsed += steps;
    }
    if (query.includes('INSERT INTO assistant_rate_windows')) {
      const [key, seconds, start] = values as [string, number, number];
      const mapKey = `${key}:${seconds}:${start}`;
      this.windows.set(mapKey, (this.windows.get(mapKey) ?? 0) + 1);
    }
    return {};
  }
}

describe('assistant request controls', () => {
  it('allows same-turn continuations, blocks concurrent turns, and expires leases', async () => {
    const db = new FakeD1();
    await expect(claimTurn(db, 'session-hash', 'turn-a', 100)).resolves.toEqual(
      {
        claimed: true,
        stepsUsed: 0,
      },
    );
    await recordTurnSteps(db, 'session-hash', 'turn-a', 2);
    await expect(claimTurn(db, 'session-hash', 'turn-a', 110)).resolves.toEqual(
      {
        claimed: true,
        stepsUsed: 2,
      },
    );
    await expect(claimTurn(db, 'session-hash', 'turn-b', 111)).resolves.toEqual(
      {
        claimed: false,
        stepsUsed: 0,
      },
    );
    await expect(claimTurn(db, 'session-hash', 'turn-b', 231)).resolves.toEqual(
      {
        claimed: true,
        stepsUsed: 0,
      },
    );
    await releaseTurn(db, 'session-hash', 'turn-b');
    expect(db.locks.size).toBe(0);
  });

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
