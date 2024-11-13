// server/routes/api.js
const express = require('express');
const router = express.Router();

// test get route to verify server is running
router.get('/server-running', (req, res) => {
  res.json({ message: 'Server is running now...' });
});

// task1 to get page summary
router.post('/task1', (req, res) => {
  res.json({ message: 'Task 1 is not implemented yet', result: null });
});

// task2 to get highlighed text
router.post('/task2', (req, res) => {
  res.json({ message: 'Task 2 is not implemented yet', result: null });
});

// task3 to chat response
router.post('/task3', (req, res) => {
  res.json({ message: 'Task 3 is not implemented yet', result: null });
});

module.exports = router;
