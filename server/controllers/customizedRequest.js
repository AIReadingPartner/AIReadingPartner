const { GoogleGenerativeAI } = require("@google/generative-ai");
const ReqHistory = require("../models/reqHistory");
const GeminiReq = require("../models/geminiReq");
const GEMINI_KEY = process.env.GEMINI_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

exports.customizedReq = async (req, res) => {
    try {
        console.log("Starting customizedReq method...");

        const userId = req.body.userId || "1";
        console.log(`User ID: ${userId}`);

        const type = "request";
        console.log(`Type: ${type}`);

        const browsingTarget = req.body.browsingTarget || "I want to know the main point of the news";
        console.log(`Browsing Target: ${browsingTarget}`);

        const currentWebpage = req.body.currentWebpage || `Let’s learn how to spend a long layover in Zurich, Switzerland. My first layover was 11 hours long...`;
        console.log(`Current Webpage: ${currentWebpage}`);

        const customizedRequest = req.body.customizedRequest || "which city is the news talking about";
        console.log(`Customized Request: ${customizedRequest}`);

        if (!userId || !browsingTarget || !currentWebpage || !customizedRequest) {
            console.error("Missing required fields in the request.");
            return res.status(400).json({ message: "Missing required fields in request body" });
        }

        const prompt = `Now I’m browsing a webpage with the text "${currentWebpage}" and my browsing target is "${browsingTarget}". And I want to ask "${customizedRequest}". Can you tell me if the webpage and request are relevant and healthy that can be dealt with? If no, answer with only "no"; if yes, provide only an answer directly to "${customizedRequest}" with less than 100 words.`;
        console.log(`Generated Prompt: ${prompt}`);

        console.log("Fetching request history for user...");
        let historyEntry = await ReqHistory.findOne({ userId });
        console.log("Fetched History Entry:", historyEntry);

        let modelHistory = [];
        if (historyEntry) {
            console.log("History exists for user. Parsing history...");
            modelHistory = JSON.parse(historyEntry.requestHistory);
        } else {
            console.log("No history found for user. Initializing new history...");
            modelHistory = [
                {
                    role: "user",
                    parts: [{ text: `Hello, Now I’m browsing a webpage and my browsing target is "${browsingTarget}"` }],
                },
                {
                    role: "model",
                    parts: [{ text: "Great to meet you. What would you like to know?" }],
                },
            ];
        }
        console.log("Model History before request:", modelHistory);

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Initialized generative model.");

        const chat = model.startChat({ history: modelHistory });
        console.log("Started chat with model. Sending prompt...");

        const result = await chat.sendMessage(prompt);
        const responseText = result.response.text().trim();
        console.log("Raw response from model:", responseText);
        console.log("Model History after adding model response:", modelHistory);

        if (historyEntry) {
            console.log("Updating existing history entry in database...");
            historyEntry.requestHistory = JSON.stringify(modelHistory);
            historyEntry.updatedAt = new Date();
            await historyEntry.save();
            console.log("History entry updated successfully.");
        } else {
            console.log("Creating new history entry in database...");
            historyEntry = new ReqHistory({
                userId,
                requestHistory: JSON.stringify(modelHistory),
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            await historyEntry.save();
            console.log("New history entry created successfully.");
        }

        const isNoResponse = /^no(\s+)?$/i.test(responseText);
        const ifValid = !isNoResponse;
        console.log(`Response validity check: isValid = ${ifValid}`);

        console.log("Saving GeminiReq entry...");
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
        console.log("GeminiReq entry saved successfully.");

        res.json({
            message: "Customized request processed successfully",
            response: responseText,
            history: modelHistory,
        });
    } catch (error) {
        console.error("Error occurred while processing request:", error);
        res.status(500).json({ message: "Error processing customized request", error: error.message });
    }
};
