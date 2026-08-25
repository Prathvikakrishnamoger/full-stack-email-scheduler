const nodemailer = require('nodemailer');
const env = require('../config/env');

/** @type {Map<string, nodemailer.Transporter>} */
const transports = new Map();

/** @type {string[]} */
let senderEmails = [];

/**
 * Initialize sender accounts and their SMTP transports.
 * If no SENDER_ACCOUNTS env is configured, auto-creates one Ethereal test account.
 */
async function initializeSenders() {
  if (env.SENDER_ACCOUNTS.length > 0) {
    for (const account of env.SENDER_ACCOUNTS) {
      const transport = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.email, pass: account.pass }
      });
      transports.set(account.email, transport);
      senderEmails.push(account.email);
      console.log(`[Email] Configured sender: ${account.email}`);
    }
  } else {
    console.log('[Email] No SENDER_ACCOUNTS configured, creating Ethereal test account...');
    const testAccount = await nodemailer.createTestAccount();
    const transport = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
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
 * Send an email via the specified sender account.
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} body - Email body (HTML supported)
 * @param {string} senderEmail - Sender account email to use
 * @returns {Promise<{messageId: string, previewUrl: string|false}>}
 */
async function sendEmail(to, subject, body, senderEmail) {
  const transport = transports.get(senderEmail);
  if (!transport) {
    throw new Error(`No transport found for sender: ${senderEmail}`);
  }

  const info = await transport.sendMail({
    from: senderEmail,
    to,
    subject,
    html: body,
    text: body.replace(/<[^>]*>/g, '') // strip HTML for plain text version
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`[Email] Sent to ${to} from ${senderEmail} | Preview: ${previewUrl}`);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || ''
  };
}

module.exports = { initializeSenders, getSenderAccounts, sendEmail };
