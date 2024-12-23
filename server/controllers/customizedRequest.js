const { GoogleGenerativeAI } = require('@google/generative-ai');
const ReqHistory = require('../models/reqHistory');
const GeminiReq = require('../models/geminiReq');
const GEMINI_KEY = process.env.GEMINI_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

exports.customizedReq = async (req, res) => {
  try {
    console.log('Starting customizedReq method...');

    // Validate request body
    const { userId, browsingTarget, currentWebpage, customizedRequest } =
      req.body;
    const type = req.body.type || 'request'; // Default to "request" if not provided

    // Log received data
    console.log('Received request data:', {
      userId,
      type,
      browsingTarget,
      currentWebpage,
      customizedRequest,
    });

    // Validate required fields
    if (!userId || !browsingTarget || !currentWebpage || !customizedRequest) {
      console.error('Missing required fields in the request.');
      return res.status(400).json({
        message: 'Missing required fields',
        required: [
          'userId',
          'browsingTarget',
          'currentWebpage',
          'customizedRequest',
        ],
      });
    }

    const prompt = `Now I'm browsing a webpage with the text "${currentWebpage}" and my browsing target is "${browsingTarget}". And my question is "${customizedRequest}". If my question is irrelevant to the webpage, answer with only "no"; if my question is relevant to the webpage, provide only an answer directly to "${customizedRequest}" with less than 200 words.`;
    console.log(`Generated Prompt: ${prompt}`);

    console.log('Fetching request history for user...');
    let historyEntry = await ReqHistory.findOne({ userId });
    console.log('Fetched History Entry:', historyEntry);

    let modelHistory = [];
    if (historyEntry) {
      console.log('History exists for user. Parsing history...');
      modelHistory = JSON.parse(historyEntry.requestHistory);
    } else {
      console.log('No history found for user. Initializing new history...');
      modelHistory = [
        {
          role: 'user',
          parts: [
            {
              text: `Hello, Now I'm browsing a webpage and my browsing target is "${browsingTarget}"`,
            },
          ],
        },
        {
          role: 'model',
          parts: [{ text: 'Great to meet you. What would you like to know?' }],
        },
      ];
    }
    console.log('Model History before request:', modelHistory);

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b' });
    console.log('Initialized generative model.');

    const chat = model.startChat({ history: modelHistory });
    console.log('Started chat with model. Sending prompt...');

    const result = await chat.sendMessage(prompt);
    const responseText = result.response.text().trim();
    console.log('Raw response from model:', responseText);
    console.log('Model History after adding model response:', modelHistory);

    if (historyEntry) {
      console.log('Updating existing history entry in database...');
      historyEntry.requestHistory = JSON.stringify(modelHistory);
      historyEntry.updatedAt = new Date();
      await historyEntry.save();
      console.log('History entry updated successfully.');
    } else {
      console.log('Creating new history entry in database...');
      historyEntry = new ReqHistory({
        userId,
        requestHistory: JSON.stringify(modelHistory),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      await historyEntry.save();
      console.log('New history entry created successfully.');
    }

    const isNoResponse = /^no(\s+)?$/i.test(responseText);
    const ifValid = !isNoResponse;
    console.log(`Response validity check: isValid = ${ifValid}`);

    console.log('Saving GeminiReq entry...');
    const geminiRequest = new GeminiReq({
      userId,
      type,
      browsingTarget,
      currentWebpage,
      customizedRequest,
      result: responseText,
      ifValid,
    });
    await geminiRequest.save();
    console.log('GeminiReq entry saved successfully.');

    res.json({
      message: 'Customized request processed successfully',
      response: responseText,
      ifValid: ifValid,
      // history: modelHistory,
    });
  } catch (error) {
    console.error('Error occurred while processing request:', error);
    res
      .status(500)
      .json({
        message: 'Error processing customized request',
        error: error.message,
      });
  }
};