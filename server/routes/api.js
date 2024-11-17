// server/routes/api.js
const express = require('express');
const router = express.Router();
const crudRoutes = require('./crudRoutes');
const taskRoutes = require('./taskRoutes');

// test get route to verify server is running
router.get('/server-running', (req, res) => {
  res.json({ message: 'Server is running now...' });
});

router.use('/crud', crudRoutes); 
router.use('/task', taskRoutes); 

module.exports = router;