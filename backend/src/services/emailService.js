const nodemailer = require('nodemailer');
const env = require('../config/env');

/** @type {Map<string, nodemailer.Transporter>} */
const transports = new Map();

/** @type {string[]} */
let senderEmails = [];

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
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
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
    const testAccount = await nodemailer.createTestAccount();
    const transport = createTransport(testAccount.user, testAccount.pass);
    transports.set(testAccount.user, transport);
    senderEmails.push(testAccount.user);
    console.log(`[Email] Auto-created Ethereal account: ${testAccount.user}`);
    console.log(`[Email] Ethereal password: ${testAccount.pass}`);
    console.log(`[Email] View sent emails at: https://ethereal.email/login`);
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
 * Send an email with retry logic.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} body - Email body (HTML supported)
 * @param {string} senderEmail - Sender account email to use
 * @param {number} retries - Number of retries remaining
 * @returns {Promise<{messageId: string, previewUrl: string|false}>}
 */
async function sendEmail(to, subject, body, senderEmail, retries = 2) {
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
    if (retries > 0 && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ESOCKET')) {
      console.warn(`[Email] SMTP error (${error.code}), retrying in 2s... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return sendEmail(to, subject, body, senderEmail, retries - 1);
    }
    throw error;
  }
}

module.exports = { initializeSenders, getSenderAccounts, sendEmail };

