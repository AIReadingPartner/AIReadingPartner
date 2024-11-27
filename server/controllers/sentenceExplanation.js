const { GoogleGenerativeAI } = require("@google/generative-ai");
const GeminiReq = require("../models/geminiReq");
const GEMINI_KEY = process.env.GEMINI_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

exports.sentenceExplain = async (req, res) => {
    try {
        // const userId = req.body.userId || "1";
        // const type = "explanation";
        // const browsingTarget = req.body.browsingTarget;
        // const currentWebpage = req.body.currentWebpage;
        // const sentenceToExplain = req.body.sentenceToExplain;
        const userId = "1";
        const type = "explanation";
        const browsingTarget = "I want to know the main point of the news";
        const currentWebpage = "Let’s learn how to spend a long layover in Zurich, Switzerland. My first layover was 11 hours long. An 11-hour layover sounds very long. However, it goes by very quickly. The plane arrived early in the morning, so nothing was open for the first few hours. (I took a much-needed nap because I couldn’t sleep in the cramped plane seat. More about those seats in an upcoming flight review post.) Then I needed to go through passport control and exit the airport. All of that cut into my layover.";
        //const currentWebpage = "This is a unhealthy news which relates to murder"
        const sentenceToExplain = "I couldn’t sleep in the cramped plane seat";
        console.log("Task 3 called successfully");

        if (!userId || !browsingTarget || !currentWebpage || !sentenceToExplain) {
            return res.status(400).json({ message: 'Missing required fields in request body' });
        }

        const prompt = `Now I’m browsing a webpage with the text "${currentWebpage}" and my browsing target is "${browsingTarget}". And I want to ask "${sentenceToExplain}". Can you tell me if the webpage is relevant and healthy that can be dealt with? If no, answer with only "no"; if yes, don't give me yes but only provide an explanation of "${sentenceToExplain}" directly with less than 100 words based on the context.`;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);

        const responseText = result.response.text();
        console.log("Raw response:", responseText);
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
            message: 'Sentence explanation processed successfully and data stored in MongoDB',
            data: geminiRequest,
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: 'Error processing Sentence explanation', error: error.message });
    }
};