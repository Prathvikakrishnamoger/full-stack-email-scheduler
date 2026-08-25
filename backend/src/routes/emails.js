const { Router } = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { authenticate } = require('../middleware/auth');
const { scheduleBatch } = require('../services/schedulerService');
const EmailJob = require('../models/EmailJob');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Simple email regex for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse email addresses from CSV buffer.
 * Supports: single column, column named 'email', or first column.
 * @param {Buffer} buffer
 * @returns {string[]}
 */
function parseEmailsFromCSV(buffer) {
  const content = buffer.toString('utf-8').trim();
  
  // Try parsing as CSV
  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true
    });

    if (records.length > 0) {
      // Look for an 'email' column (case-insensitive)
      const headers = Object.keys(records[0]);
      const emailCol = headers.find(h => h.toLowerCase() === 'email');

      if (emailCol) {
        return records
          .map(r => r[emailCol]?.trim())
          .filter(e => e && EMAIL_REGEX.test(e));
      }

      // Use the first column
      const firstCol = headers[0];
      return records
        .map(r => r[firstCol]?.trim())
        .filter(e => e && EMAIL_REGEX.test(e));
    }
  } catch {
    // Fall through to line-by-line parsing
  }

  // Fallback: treat each line as an email
  return content
    .split(/[\r\n]+/)
    .map(line => line.trim())
    .filter(line => EMAIL_REGEX.test(line));
}

/**
 * POST /api/emails/schedule
 * Schedule a batch of emails from a CSV file.
 */
router.post('/schedule', authenticate, upload.single('csv'), async (req, res) => {
  try {
    const { subject, body, startTime, delayBetweenEmails } = req.body;

    // Validate required fields
    if (!subject || !body || !startTime) {
      return res.status(400).json({ error: 'subject, body, and startTime are required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file with email addresses is required' });
    }

    // Parse emails from CSV
    const emails = parseEmailsFromCSV(req.file.buffer);
    if (emails.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses found in the CSV file' });
    }

    // Schedule the batch
    const result = await scheduleBatch({
      emails,
      subject,
      body,
      startTime: new Date(startTime),
      delayBetweenEmails: parseInt(delayBetweenEmails, 10) || 2,
      userId: req.user.id
    });

    res.status(201).json({
      message: `Successfully scheduled ${result.totalScheduled} emails`,
      ...result
    });
  } catch (error) {
    console.error('[Emails] Schedule error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to schedule emails' });
  }
});

/**
 * GET /api/emails/scheduled
 * Get paginated scheduled emails for the current user.
 */
router.get('/scheduled', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      userId: req.user.id,
      status: { $in: ['scheduled', 'queued', 'rate-limited', 'sending'] }
    };

    const [emails, total] = await Promise.all([
      EmailJob.find(filter)
        .sort({ scheduledAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailJob.countDocuments(filter)
    ]);

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[Emails] Fetch scheduled error:', error.message);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
});

/**
 * GET /api/emails/sent
 * Get paginated sent/failed emails for the current user.
 */
router.get('/sent', authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {
      userId: req.user.id,
      status: { $in: ['sent', 'failed'] }
    };

    const [emails, total] = await Promise.all([
      EmailJob.find(filter)
        .sort({ sentAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EmailJob.countDocuments(filter)
    ]);

    res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[Emails] Fetch sent error:', error.message);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});

module.exports = router;
