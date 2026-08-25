const mongoose = require('mongoose');

const emailJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  to: { type: String, required: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  senderAccount: { type: String, default: '' },
  scheduledAt: { type: Date, required: true },
  status: {
    type: String,
    enum: ['scheduled', 'queued', 'sending', 'sent', 'failed', 'rate-limited'],
    default: 'scheduled',
    index: true
  },
  sentAt: { type: Date },
  error: { type: String },
  previewUrl: { type: String },
  bullJobId: { type: String },
  batchId: { type: String, index: true },
  attempts: { type: Number, default: 0 }
}, { timestamps: true });

// Compound indexes for common queries
emailJobSchema.index({ userId: 1, status: 1 });
emailJobSchema.index({ userId: 1, scheduledAt: -1 });

module.exports = mongoose.model('EmailJob', emailJobSchema);
