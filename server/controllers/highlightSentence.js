const { GoogleGenerativeAI } = require('@google/generative-ai');
const GEMINI_KEY = process.env.GEMINI_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

exports.processTask4 = async (req, res) => {
  try {
    // Extract request parameters
    const browsingTarget = req.body.browsingTarget || "I want to know the main point of the news";
    const structuredData = req.body.structuredData || [];
  
    if (!Array.isArray(structuredData) || structuredData.length === 0) {
      return res.status(400).send({ error: 'Invalid structuredData array' });
    }
    console.log('Task 4 called successfully');

    const inputText = structuredData
      .map((data) => `${data.index}: ${data.content}`)
      .join('\n');
    const prompt = `Analyze the following text to identify the most relevant sentences based on the browsing target: "${browsingTarget}". Return only the indices of the most relevant sentences, separated by commas.

Text:
${inputText}`
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    const responseText = result.response.text();
    console.log('Raw response:', responseText);

    const relevantIndices = [];
    responseText.split(',').forEach((index) => {
      const parsedIndex = parseInt(index.trim(), 10);
      if (
        !isNaN(parsedIndex) &&
        parsedIndex >= 0  // index could be larger than the array length
      ) {
        relevantIndices.push(parsedIndex);
      }
    });

    console.log(relevantIndices);
    res.json({
      message: 'Task 4 processed successfully',
      result: relevantIndices,
    });
  } catch (error) {
    console.error('Error processing task4:', error);
    res
      .status(500)
      .json({ message: 'Error processing Task 4', error: error.message });
  }
};
