const mongoose = require('mongoose');

const geminiReqSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, required: true }, // summary, explain, request
    browsingTarget: { type: String, required: true },
    currentWebpage: { type: String, required: true },
    ifValid: {type: Boolean, default: undefined},
    result: { type: String }, // null when doing summary
    customizedRequest: { type: String },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('geminiReq', geminiReqSchema);