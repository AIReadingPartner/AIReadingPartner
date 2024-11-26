// server/routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const task1Controller = require('../controllers/pageSummary');
const task2Controller = require('../controllers/customizedRequest');
const task3Controller = require('../controllers/sentenceExplanation');

router.post('/task1', task1Controller.pageSummarize);
router.post('/task2', task2Controller.customizedReq);
router.post('/task3', task3Controller.sentenceExplain);

module.exports = router;
