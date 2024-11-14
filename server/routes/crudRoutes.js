// server/routes/crudRoutes.js
const express = require('express');
const router = express.Router();
const crudController = require('../controllers/crudController');

router.post('/data', crudController.createData);
router.get('/data/:id', crudController.readDataById);
router.put('/data/:id', crudController.updateData);
router.delete('/data/:id', crudController.deleteData);

module.exports = router;
