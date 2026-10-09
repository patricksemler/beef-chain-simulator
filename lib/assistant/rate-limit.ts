/**
 * # Rate Limit
 *
 * ## What this file is for
 * This file helps run the simulator experience and shows the controls and results people use to test scenarios.
 *
 * ## What it does
 * - Helps the app show the right page, section, or feature.
 * - Accepts or sends data needed by the rest of the app.
 * - Keeps the code organized so it is easier to understand and update.
 *
 * ## Main pieces in this file
 * - `sha256`: the main thing this file provides to the app.
 * - Other small helper functions or values support that main work.
 *
 * ## Important tools and connections
 * - Uses project code and libraries that help the app run smoothly.
 * - Works with the rest of the simulator, dashboard, or UI layers.
 *
 * ## How data moves through it
 * Data usually comes in from a user action or from another part of the app. This file reads that information, applies the needed logic, and then sends it on or displays it on screen.
 *
 * ## Errors and edge cases
 * The code checks for missing, unusual, or invalid values and tries to handle them safely. If something is not valid, it usually falls back to a safe default or prevents the bad input from continuing.
 *
 * ## How it fits into the app
 * This file is one small part of the larger system. It connects to other sections so the app feels like one working tool instead of separate pieces.
 *
 * ## Helpful notes
 * The goal here is to keep the code simple, clear, and easy to maintain without changing how the app behaves.
 */
export interface AssistantD1 {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
  batch(statements: unknown[]): Promise<unknown>;
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function claimTurn(
  db: AssistantD1,
  sessionHash: string,
  turnId: string,
  now = Math.floor(Date.now() / 1000),
) {
  const claimed = await db
    .prepare(
      `INSERT INTO assistant_turn_locks (session_hash, turn_id, expires_at, steps_used)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(session_hash) DO UPDATE SET
         turn_id = excluded.turn_id,
         expires_at = excluded.expires_at,
         steps_used = CASE
           WHEN assistant_turn_locks.turn_id = excluded.turn_id
             THEN assistant_turn_locks.steps_used
           ELSE 0
         END
       WHERE assistant_turn_locks.turn_id = excluded.turn_id
          OR assistant_turn_locks.expires_at <= ?
       RETURNING turn_id AS turnId, steps_used AS stepsUsed`,
    )
    .bind(sessionHash, turnId, now + 120, now)
    .first<{ turnId: string; stepsUsed: number }>();
  return {
    claimed: claimed?.turnId === turnId,
    stepsUsed: claimed?.stepsUsed ?? 0,
  };
}

export async function recordTurnSteps(
  db: AssistantD1,
  sessionHash: string,
  turnId: string,
  steps: number,
) {
  await db
    .prepare(
      `UPDATE assistant_turn_locks
       SET steps_used = steps_used + ?
       WHERE session_hash = ? AND turn_id = ?`,
    )
    .bind(steps, sessionHash, turnId)
    .run();
}

export async function releaseTurn(
  db: AssistantD1,
  sessionHash: string,
  turnId: string,
) {
  await db
    .prepare(
      'DELETE FROM assistant_turn_locks WHERE session_hash = ? AND turn_id = ?',
    )
    .bind(sessionHash, turnId)
    .run();
}

async function consumeWindow(
  db: AssistantD1,
  key: string,
  windowSeconds: number,
  limit: number,
  now: number,
) {
  const windowStart = Math.floor(now / windowSeconds) * windowSeconds;
  await db
    .prepare(
      `INSERT INTO assistant_rate_windows
         (scope_key, window_seconds, window_start, request_count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(scope_key, window_seconds, window_start)
       DO UPDATE SET request_count = request_count + 1`,
    )
    .bind(key, windowSeconds, windowStart)
    .run();
  const row = await db
    .prepare(
      `SELECT request_count AS requestCount
       FROM assistant_rate_windows
       WHERE scope_key = ? AND window_seconds = ? AND window_start = ?`,
    )
    .bind(key, windowSeconds, windowStart)
    .first<{ requestCount: number }>();
  return {
    allowed: (row?.requestCount ?? limit + 1) <= limit,
    retryAfter: windowStart + windowSeconds - now,
  };
}

export async function consumeUserMessage(
  db: AssistantD1,
  ipHash: string,
  now = Math.floor(Date.now() / 1000),
) {
  const minute = await consumeWindow(db, ipHash, 60, 8, now);
  const hour = await consumeWindow(db, ipHash, 3600, 80, now);
  if (!minute.allowed) return minute;
  if (!hour.allowed) return hour;
  return { allowed: true, retryAfter: 0 };
}
