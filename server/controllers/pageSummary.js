const { GoogleGenerativeAI } = require("@google/generative-ai");
const GeminiReq = require("../models/geminiReq");
const GEMINI_KEY = process.env.GEMINI_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

exports.pageSummarize = async (req, res) => {
    try {
        const { userId, type, browsingTarget, currentWebpage } = req.body;

        if (!userId || !browsingTarget || !currentWebpage || !type) {
            return res.status(400).json({ message: 'Missing required fields in request body' });
        }

        console.log("Task 1 called successfully");

        const prompt = `Now I’m browsing a webpage with the text "${currentWebpage}" and I want to achieve the goal of "${browsingTarget}". If the "${browsingTarget}" is irrelevant to the webpage, answer with "no"; If the "${browsingTarget}" is relevant to the webpage ,only provide me a summary of the webpage with less than 150 words.`;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
        const result = await model.generateContent(prompt);

        const responseText = result.response.text();
        const isNoResponse = /^no(\s+)?$/i.test(responseText.trim());
        const ifValid = !isNoResponse;

        const geminiRequest = new GeminiReq({
            userId,
            type,
            browsingTarget,
            currentWebpage,
            result: responseText.trim(),
            ifValid,
        });

        await geminiRequest.save();
        console.log("db saved: " + geminiRequest)


        res.json({
            message: 'Page Summary processed successfully and data stored in MongoDB',
            data: geminiRequest,
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: 'Error processing Page Summary', error: error.message });
    }
};

exports.saveSummary = async (req, res) => {
    try {
        const { userId, type, result ,browsingTarget, currentWebpage } = req.body;

        if (!userId || !browsingTarget || !result || !currentWebpage || !type) {
            return res.status(400).json({ message: 'Missing required fields in request body' });
        }

        console.log("save summary called successfully");

        const geminiRequest = new GeminiReq({
            userId,
            type,
            browsingTarget,
            currentWebpage,
            result,
            ifValid: true,
        });

        await geminiRequest.save();
        console.log("db saved: " + geminiRequest)


        res.json({
            message: 'Page Summary processed successfully and data stored in MongoDB',
            data: geminiRequest,
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: 'Error processing Page Summary', error: error.message });
    }
}
