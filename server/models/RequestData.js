// server/models/RequestData.js
const mongoose = require('mongoose');

const RequestDataSchema = new mongoose.Schema({
  name: { type: String, required: true },
  customID: { type: String, required: true },
  taskType: { type: String, required: true },     // "summarize", "highlight", "chat"
  context: { type: String, required: true },      // page content
  description: { type: String, required: true },  // user defined task description 
  result: { type: String, required: true },       // llm response, optional for test
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RequestData', RequestDataSchema);
