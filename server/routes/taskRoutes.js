// server/routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const task1Controller = require('../controllers/task1Controller');
const task2Controller = require('../controllers/task2Controller');
const task3Controller = require('../controllers/task3Controller');

router.post('/task1', task1Controller.processTask1);
router.post('/task2', task2Controller.processTask2);
router.post('/task3', task3Controller.processTask3);

module.exports = router;
