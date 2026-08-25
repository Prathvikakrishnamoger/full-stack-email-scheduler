const { redis } = require('../config/redis');
const env = require('../config/env');

/**
 * Lua script to atomically check and increment a rate limit counter.
 * Returns [allowed (0 or 1), currentCount]
 * Uses INCR + EXPIRE with a 1-hour TTL.
 */
const CHECK_AND_INCREMENT_LUA = `
  local key = KEYS[1]
  local limit = tonumber(ARGV[1])
  local current = tonumber(redis.call('GET', key) or '0')
  if current >= limit then
    return {0, current}
  end
  local newCount = redis.call('INCR', key)
  if newCount == 1 then
    redis.call('EXPIRE', key, 3600)
  end
  return {1, newCount}
`;

/**
 * Get the current hour window identifier.
 * @returns {number}
 */
function getCurrentHourWindow() {
  return Math.floor(Date.now() / 3600000);
}

/**
 * Get milliseconds until the next hour window starts.
 * @returns {number}
 */
function getMsUntilNextHour() {
  const now = Date.now();
  const nextHour = (Math.floor(now / 3600000) + 1) * 3600000;
  return nextHour - now;
}

/**
 * Check rate limits for a sender. Checks both per-sender and global limits.
 * If allowed, atomically increments both counters.
 * 
 * @param {string} senderEmail - The sender account email
 * @returns {Promise<{allowed: boolean, retryAfterMs: number, reason?: string}>}
 */
async function checkAndIncrement(senderEmail) {
  const hourWindow = getCurrentHourWindow();
  const senderKey = `rate:sender:${senderEmail}:${hourWindow}`;
  const globalKey = `rate:global:${hourWindow}`;

  // Check per-sender limit first
  const [senderAllowed] = await redis.eval(
    CHECK_AND_INCREMENT_LUA, 1, senderKey, env.MAX_EMAILS_PER_HOUR_PER_SENDER
  );

  if (!senderAllowed) {
    return {
      allowed: false,
      retryAfterMs: getMsUntilNextHour(),
      reason: `Sender ${senderEmail} hourly limit reached (${env.MAX_EMAILS_PER_HOUR_PER_SENDER}/hr)`
    };
  }

  // Check global limit
  const [globalAllowed] = await redis.eval(
    CHECK_AND_INCREMENT_LUA, 1, globalKey, env.MAX_EMAILS_PER_HOUR
  );

  if (!globalAllowed) {
    // Rollback sender counter since global limit was hit
    await redis.decr(senderKey);
    return {
      allowed: false,
      retryAfterMs: getMsUntilNextHour(),
      reason: `Global hourly limit reached (${env.MAX_EMAILS_PER_HOUR}/hr)`
    };
  }

  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Get current usage stats for monitoring.
 * @param {string} senderEmail
 * @returns {Promise<{senderCount: number, globalCount: number, hourWindow: number}>}
 */
async function getUsageStats(senderEmail) {
  const hourWindow = getCurrentHourWindow();
  const senderKey = `rate:sender:${senderEmail}:${hourWindow}`;
  const globalKey = `rate:global:${hourWindow}`;

  const [senderCount, globalCount] = await Promise.all([
    redis.get(senderKey),
    redis.get(globalKey)
  ]);

  return {
    senderCount: parseInt(senderCount || '0', 10),
    globalCount: parseInt(globalCount || '0', 10),
    hourWindow
  };
}

module.exports = { checkAndIncrement, getUsageStats, getMsUntilNextHour };
