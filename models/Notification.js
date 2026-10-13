const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  body: { type: String, default: '' },
  read: { type: Boolean, default: false },
  kind: { type: String, enum: ['info', 'success', 'warning'], default: 'info' }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);