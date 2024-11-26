const mongoose = require('mongoose');

const reqHistorySchema = new mongoose.Schema({
    userId: { type: String, required: true },
    requestHistory: { type: String, required: true }, // Store history as JSON string
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('reqHistory', reqHistorySchema);