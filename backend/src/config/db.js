const mongoose = require('mongoose');
const env = require('./env');

async function connectDB() {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log(`[DB] Connected to MongoDB at ${env.MONGO_URI}`);
  } catch (error) {
    console.error('[DB] MongoDB connection error:', error.message);
    process.exit(1);
  }

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB runtime error:', err.message);
  });
}

module.exports = { connectDB };
