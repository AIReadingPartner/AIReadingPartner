// server/routes/taskRoutes.js
const express = require('express');
const router = express.Router();
const task1Controller = require('../controllers/pageSummary');
const task2Controller = require('../controllers/customizedRequest');
const task3Controller = require('../controllers/sentenceExplanation');
const task4Controller = require('../controllers/highlightSentence');

router.post('/pageSummarize', task1Controller.pageSummarize);
router.post('/saveSummary', task1Controller.saveSummary);
router.post('/customizedReq', task2Controller.customizedReq);
router.post('/sentenceExplain', task3Controller.sentenceExplain);
router.post('/highlightSentence', task4Controller.highlightSentence);

module.exports = router;
