const mongoose = require('mongoose');

async function connectDB(uri) {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(uri);
    console.log('[db] MongoDB connected');
  } catch (err) {
    console.error('[db] Connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;