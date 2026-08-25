const { Queue } = require('bullmq');
const { redis } = require('../config/redis');
const env = require('../config/env');

const emailQueue = new Queue('email-sends', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: { age: 86400, count: 10000 },
    removeOnFail: { age: 604800, count: 5000 }
  }
});

console.log('[Queue] Email queue initialized');

module.exports = { emailQueue };
