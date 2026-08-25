const IORedis = require('ioredis');
const env = require('./env');

/** Standard Redis connection for producers/API */
const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true
});

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error', (err) => console.error('[Redis] Error:', err.message));

/**
 * Create a new Redis connection suitable for BullMQ workers.
 * Workers require maxRetriesPerRequest: null and enableReadyCheck: false.
 */
function createWorkerConnection() {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  });
}

module.exports = { redis, createWorkerConnection };
