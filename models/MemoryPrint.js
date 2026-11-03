const mongoose = require('mongoose');

const memoryPrintSchema = new mongoose.Schema({
  signatureHash: { type: String, required: true, index: true },
  userId: { type: String },
  userEmail: { type: String },
  albumPath: { type: String },
  fileUrls: [{ type: String }],
  mediaUrl: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('MemoryPrint', memoryPrintSchema);