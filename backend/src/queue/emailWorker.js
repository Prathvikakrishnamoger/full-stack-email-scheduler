const { Worker, DelayedError } = require('bullmq');
const { createWorkerConnection } = require('../config/redis');
const env = require('../config/env');
const EmailJob = require('../models/EmailJob');
const emailService = require('../services/emailService');
const rateLimiterService = require('../services/rateLimiterService');

let worker = null;

/**
 * Process a single email send job.
 * @param {import('bullmq').Job} job
 */
async function processEmailJob(job) {
  const { emailJobId, to, subject, body, senderAccount } = job.data;

  // 1. Fetch the EmailJob from MongoDB
  const emailJob = await EmailJob.findOne({ jobId: emailJobId });
  if (!emailJob) {
    console.warn(`[Worker] EmailJob not found in DB: ${emailJobId}`);
    return; // Job doesn't exist in DB, nothing to do
  }

  // 2. Idempotency check — never send twice
  if (emailJob.status === 'sent') {
    console.log(`[Worker] Job ${emailJobId} already sent, skipping (idempotent)`);
    return;
  }

  // 3. Rate limit check
  const rateCheck = await rateLimiterService.checkAndIncrement(senderAccount);
  if (!rateCheck.allowed) {
    console.log(`[Worker] Rate limited: ${rateCheck.reason}. Rescheduling ${emailJobId} for ${rateCheck.retryAfterMs}ms`);
    
    // Update status to rate-limited
    await EmailJob.updateOne(
      { jobId: emailJobId },
      { status: 'rate-limited', attempts: emailJob.attempts + 1 }
    );

    // Reschedule job to next available window
    await job.moveToDelayed(Date.now() + rateCheck.retryAfterMs, job.token);
    throw new DelayedError();
  }

  // 4. Update status to sending
  await EmailJob.updateOne({ jobId: emailJobId }, { status: 'sending' });

  try {
    // 5. Send the email
    const result = await emailService.sendEmail(to, subject, body, senderAccount);

    // 6. Update status to sent
    await EmailJob.updateOne(
      { jobId: emailJobId },
      {
        status: 'sent',
        sentAt: new Date(),
        previewUrl: result.previewUrl,
        attempts: emailJob.attempts + 1
      }
    );

    console.log(`[Worker] ✓ Sent ${emailJobId} to ${to}`);
    return result;
  } catch (error) {
    // 7. Update status to failed
    await EmailJob.updateOne(
      { jobId: emailJobId },
      {
        status: 'failed',
        error: error.message,
        attempts: emailJob.attempts + 1
      }
    );

    console.error(`[Worker] ✗ Failed ${emailJobId}: ${error.message}`);
    throw error; // Let BullMQ handle retry
  }
}

/**
 * Start the BullMQ email worker.
 */
function startWorker() {
  const connection = createWorkerConnection();

  worker = new Worker('email-sends', processEmailJob, {
    connection,
    concurrency: env.WORKER_CONCURRENCY,
    limiter: {
      max: 1,
      duration: env.MIN_DELAY_BETWEEN_SENDS_MS
    }
  });

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    if (err instanceof DelayedError) return; // Expected for rate-limited jobs
    console.error(`[Worker] Job ${job?.id} failed: ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err.message);
  });

  console.log(`[Worker] Email worker started with concurrency=${env.WORKER_CONCURRENCY}, minDelay=${env.MIN_DELAY_BETWEEN_SENDS_MS}ms`);

  return worker;
}

/**
 * Gracefully shut down the worker.
 */
async function stopWorker() {
  if (worker) {
    console.log('[Worker] Shutting down gracefully...');
    await worker.close();
    console.log('[Worker] Worker closed');
  }
}

module.exports = { startWorker, stopWorker };
