const { v4: uuidv4 } = require('uuid');
const EmailJob = require('../models/EmailJob');
const emailService = require('./emailService');

/**
 * Schedule a batch of emails.
 * 
 * @param {Object} params
 * @param {string[]} params.emails - Array of recipient email addresses
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body
 * @param {Date|string} params.startTime - When to begin sending
 * @param {number} params.delayBetweenEmails - Seconds between each email
 * @param {number} [params.hourlyLimit] - Override hourly limit for this batch (optional)
 * @param {string} params.userId - The authenticated user's ID
 * @returns {Promise<{batchId: string, totalScheduled: number, jobs: Object[]}>}
 */
async function scheduleBatch(params) {
  const { emails, subject, body, startTime, delayBetweenEmails, userId } = params;
  
  // Lazy require to avoid circular dependency
  const { emailQueue } = require('../queue/emailQueue');
  
  const batchId = uuidv4();
  const senderAccounts = emailService.getSenderAccounts();
  
  if (senderAccounts.length === 0) {
    throw new Error('No sender accounts available. Initialize email service first.');
  }

  const startMs = new Date(startTime).getTime();
  const delayMs = (delayBetweenEmails || 2) * 1000; // default 2 seconds
  const now = Date.now();

  const jobs = [];
  const bulkOps = [];
  const bullJobs = [];

  for (let i = 0; i < emails.length; i++) {
    const email = emails[i].trim();
    if (!email) continue;

    const jobId = `batch-${batchId}-${i}`;
    const scheduledAt = new Date(startMs + (i * delayMs));
    const senderEmail = senderAccounts[i % senderAccounts.length]; // round-robin
    const bullDelay = Math.max(0, scheduledAt.getTime() - now);

    bulkOps.push({
      insertOne: {
        document: {
          jobId,
          userId,
          to: email,
          subject,
          body,
          senderAccount: senderEmail,
          scheduledAt,
          status: 'scheduled',
          bullJobId: jobId,
          batchId,
          attempts: 0
        }
      }
    });

    bullJobs.push({
      name: 'send-email',
      data: {
        emailJobId: jobId,
        to: email,
        subject,
        body,
        senderAccount: senderEmail
      },
      opts: {
        jobId,
        delay: bullDelay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 10000 },
        removeOnFail: { age: 604800, count: 5000 }
      }
    });
  }

  // Bulk insert into MongoDB
  if (bulkOps.length > 0) {
    await EmailJob.bulkWrite(bulkOps, { ordered: false }).catch(err => {
      // Handle duplicate key errors (idempotency — re-scheduling same batch)
      if (err.code !== 11000) throw err;
      console.warn(`[Scheduler] Some jobs in batch ${batchId} already exist (idempotent re-add)`);
    });
  }

  // Bulk add to BullMQ queue
  if (bullJobs.length > 0) {
    await emailQueue.addBulk(bullJobs);
  }

  console.log(`[Scheduler] Batch ${batchId}: scheduled ${bullJobs.length} emails starting at ${new Date(startMs).toISOString()}`);

  return {
    batchId,
    totalScheduled: bullJobs.length,
    startTime: new Date(startMs).toISOString(),
    estimatedEndTime: new Date(startMs + ((bullJobs.length - 1) * delayMs)).toISOString()
  };
}

module.exports = { scheduleBatch };
