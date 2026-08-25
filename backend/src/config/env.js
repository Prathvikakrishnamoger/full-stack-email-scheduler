require('dotenv').config();

const env = {
  PORT: parseInt(process.env.PORT, 10) || 5000,
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017/email-scheduler',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY, 10) || 5,
  MAX_EMAILS_PER_HOUR: parseInt(process.env.MAX_EMAILS_PER_HOUR, 10) || 500,
  MAX_EMAILS_PER_HOUR_PER_SENDER: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER, 10) || 100,
  MIN_DELAY_BETWEEN_SENDS_MS: parseInt(process.env.MIN_DELAY_BETWEEN_SENDS_MS, 10) || 2000,
  SENDER_ACCOUNTS: (() => {
    try {
      const raw = process.env.SENDER_ACCOUNTS;
      if (raw && raw.trim()) return JSON.parse(raw);
      return [];
    } catch {
      console.warn('Failed to parse SENDER_ACCOUNTS, using empty array');
      return [];
    }
  })()
};

module.exports = env;
