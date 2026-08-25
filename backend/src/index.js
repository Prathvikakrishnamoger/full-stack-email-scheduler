const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const env = require('./config/env');
const { connectDB } = require('./config/db');
const { initializeSenders } = require('./services/emailService');
const { startWorker, stopWorker } = require('./queue/emailWorker');
const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/emails');

async function main() {
  // Connect to MongoDB
  await connectDB();

  // Initialize Ethereal email senders
  await initializeSenders();

  // Create Express app
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(morgan('dev'));
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/emails', emailRoutes);

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  // Start BullMQ worker
  startWorker();

  // Start HTTP server
  const server = app.listen(env.PORT, () => {
    console.log(`[Server] Email Scheduler API running on port ${env.PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);
    
    server.close(async () => {
      console.log('[Server] HTTP server closed');
      await stopWorker();
      process.exit(0);
    });

    // Force shutdown after 30s
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout');
      process.exit(1);
    }, 30000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[Server] Fatal error during startup:', err);
  process.exit(1);
});
