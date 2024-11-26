const { GoogleGenerativeAI } = require("@google/generative-ai");
const GeminiReq = require("../models/geminiReq");
const GEMINI_KEY = process.env.GEMINI_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

exports.customizedReq = async (req, res) => {
    try {
        // const userId = req.body.userId || "1"; // Default to "1" if not provided
        // const type = "request"; // Set the type for this task
        // const browsingTarget = req.body.browsingTarget;
        // const currentWebpage = req.body.currentWebpage;
        // const customizedRequest = req.body.customizedRequest;
        const userId = "1";
        const type = "request";
        const browsingTarget = "I want to know the main point of the news";
        const currentWebpage = "Let’s learn how to spend a long layover in Zurich, Switzerland. My first layover was 11 hours long. An 11-hour layover sounds very long. However, it goes by very quickly. The plane arrived early in the morning, so nothing was open for the first few hours. (I took a much-needed nap because I couldn’t sleep in the cramped plane seat. More about those seats in an upcoming flight review post.) Then I needed to go through passport control and exit the airport. All of that cut into my layover.";
        //const currentWebpage = "This is a unhealthy news which relates to murder"
        const customizedRequest = "which city is the news talking about";
        console.log("Task 2 called successfully");

        if (!userId || !browsingTarget || !currentWebpage || !customizedRequest) {
            return res.status(400).json({ message: 'Missing required fields in request body' });
        }

        const prompt = `Now I’m browsing a webpage with the text "${currentWebpage}" and my browsing target is "${browsingTarget}". And I want to ask "${customizedRequest}". Can you tell me if the webpage and request are relevant and healthy that can be dealt with? If no, answer with only "no"; if yes, provide only an answer directly to "${customizedRequest}" with less than 100 words.`;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        //TBD in future to store the history
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "Hello" }],
                },
                {
                    role: "model",
                    parts: [{ text: "Great to meet you. What would you like to know?" }],
                },
            ],
        });

        const result = await chat.sendMessage(prompt);
        const responseText = result.response.text();
        console.log("Raw response:", responseText);

        const isNoResponse = /^no(\s+)?$/i.test(responseText.trim());
        const ifValid = !isNoResponse;
        const geminiRequest = new GeminiReq({
            userId,
            type,
            browsingTarget,
            currentWebpage,
            customizedRequest,
            result: responseText.trim(),
            ifValid,
        });

        await geminiRequest.save();
        console.log("db saved: " + geminiRequest)

        res.json({
            message: 'Customized request processed successfully and data stored in MongoDB',
            data: geminiRequest,
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: 'Error processing customized request', error: error.message });
    }
};
