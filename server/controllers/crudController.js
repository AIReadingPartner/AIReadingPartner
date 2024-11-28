// server/controllers/crudController.js
const RequestData = require('../models/RequestData');
const GeminiReq = require("../models/geminiReq");

exports.getHistoryById = async (req, res) => {
  try {
    const userId = req.params.id;

    const data = await GeminiReq.find({ userId }).sort({ createdAt: -1 });

    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'No data found for this user ID' });
    }

    res.json({ message: 'Request data found', data });
  } catch (error) {
    console.error('Error retrieving data:', error);
    res.status(500).json({ message: 'Error retrieving data', error });
  }
};

// create a new request data
exports.createData = async (req, res) => {
  try {
    const newData = new RequestData(req.body);
    const savedData = await newData.save();
    res.json({ message: 'Request data created successfully', savedData});
  } catch (error) {
    res.status(500).json({ message: 'Error creating data', error });
  }
};

// read all data from the database with specific id
exports.readDataById = async (req, res) => {
  try {
    const parentId = req.params.id;
    const data = await RequestData.find({ parentId });
    if (!data || data.length === 0) {
      return res.status(404).json({ message: 'No data found for this ID' });
    }
    res.json({ message: 'Request data found', data });
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving data', error });
  }
};

// updata data by id
exports.updateData = async (req, res) => {
  try {
    const updatedData = await RequestData.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedData) {
      return res.status(404).json({ message: 'Data not found' });
    }
    res.json({ message: 'Data updated successfully', updatedData });
  } catch (error) {
    res.status(500).json({ message: 'Error updating data', error });
  }
};

// delete data by id
exports.deleteData = async (req, res) => {
  try {
    const deletedData = await RequestData.findByIdAndDelete(req.params.id);
    if (!deletedData) {
      return res.status(404).json({ message: 'Data not found' });
    }
    res.json({ message: 'Data deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting data', error });
  }
};
