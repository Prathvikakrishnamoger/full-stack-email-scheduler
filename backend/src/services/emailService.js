const nodemailer = require('nodemailer');
const env = require('../config/env');

/** @type {Map<string, nodemailer.Transporter>} */
const transports = new Map();

/** @type {string[]} */
let senderEmails = [];

/** Whether SMTP is available (detected at runtime) */
let smtpAvailable = true;

/**
 * Create a Nodemailer transport with robust settings for cloud deployment.
 */
function createTransport(user, pass) {
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,
    maxConnections: 2,
    maxMessages: 30,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    tls: { rejectUnauthorized: false }
  });
}

/**
 * Initialize sender accounts and their SMTP transports.
 * If no SENDER_ACCOUNTS env is configured, auto-creates one Ethereal test account.
 */
async function initializeSenders() {
  if (env.SENDER_ACCOUNTS.length > 0) {
    for (const account of env.SENDER_ACCOUNTS) {
      const transport = createTransport(account.email, account.pass);
      transports.set(account.email, transport);
      senderEmails.push(account.email);
      console.log(`[Email] Configured sender: ${account.email}`);
    }
  } else {
    console.log('[Email] No SENDER_ACCOUNTS configured, creating Ethereal test account...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      const transport = createTransport(testAccount.user, testAccount.pass);
      transports.set(testAccount.user, transport);
      senderEmails.push(testAccount.user);
      console.log(`[Email] Auto-created Ethereal account: ${testAccount.user}`);
      console.log(`[Email] Ethereal password: ${testAccount.pass}`);
      console.log(`[Email] View sent emails at: https://ethereal.email/login`);
    } catch (error) {
      console.warn(`[Email] Could not create Ethereal account: ${error.message}`);
      console.log('[Email] Will use demo mode for email sending');
      senderEmails.push('demo@email-scheduler.app');
      smtpAvailable = false;
    }
  }

  // Test SMTP connectivity with a verify call
  if (smtpAvailable && transports.size > 0) {
    const firstTransport = transports.values().next().value;
    try {
      await Promise.race([
        firstTransport.verify(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP verify timeout')), 10000))
      ]);
      console.log('[Email] SMTP connection verified successfully');
    } catch (error) {
      console.warn(`[Email] SMTP not reachable (${error.message}). Switching to demo mode.`);
      smtpAvailable = false;
    }
  }
}

/**
 * Get all available sender email addresses.
 * @returns {string[]}
 */
function getSenderAccounts() {
  return [...senderEmails];
}

/**
 * Send an email — uses real SMTP if available, falls back to demo mode.
 * Demo mode logs the email and generates a mock result so the full
 * scheduling/queue/rate-limiting pipeline can be demonstrated.
 *
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} body - Email body (HTML supported)
 * @param {string} senderEmail - Sender account email to use
 * @param {number} retries - Number of retries remaining
 * @returns {Promise<{messageId: string, previewUrl: string}>}
 */
async function sendEmail(to, subject, body, senderEmail, retries = 2) {
  // Demo mode — simulate sending
  if (!smtpAvailable) {
    const messageId = `<demo-${Date.now()}-${Math.random().toString(36).slice(2)}@email-scheduler.app>`;
    console.log(`[Email] [DEMO] Sent to ${to} from ${senderEmail} | Subject: ${subject}`);

    // Small delay to simulate real send
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      messageId,
      previewUrl: `https://email-scheduler-demo.app/preview/${Date.now()}`
    };
  }

  // Real SMTP mode
  const transport = transports.get(senderEmail);
  if (!transport) {
    throw new Error(`No transport found for sender: ${senderEmail}`);
  }

  try {
    const info = await transport.sendMail({
      from: senderEmail,
      to,
      subject,
      html: body,
      text: body.replace(/<[^>]*>/g, '')
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[Email] Sent to ${to} from ${senderEmail} | Preview: ${previewUrl}`);

    return {
      messageId: info.messageId,
      previewUrl: previewUrl || ''
    };
  } catch (error) {
    // If SMTP fails with connection error, switch to demo mode permanently
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET' || error.code === 'ECONNREFUSED') {
      if (retries > 0) {
        console.warn(`[Email] SMTP error (${error.code}), retrying in 2s... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return sendEmail(to, subject, body, senderEmail, retries - 1);
      }
      // After all retries exhausted, switch to demo mode
      console.warn(`[Email] SMTP unreachable after retries. Switching to demo mode permanently.`);
      smtpAvailable = false;
      return sendEmail(to, subject, body, senderEmail, 0);
    }
    throw error;
  }
}

module.exports = { initializeSenders, getSenderAccounts, sendEmail };
