const { GoogleGenerativeAI } = require("@google/generative-ai");
const GeminiReq = require("../models/geminiReq");
const GEMINI_KEY = process.env.GEMINI_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

exports.pageSummarize = async (req, res) => {
    try {
        const userId = req.body.userId || "1";
        const type = "summary";
        const browsingTarget = req.body.browsingTarget || "I want to know the main point of the news";
        const currentWebpage = req.body.currentWebpage || "Let’s learn how to spend a long layover in Zurich, Switzerland. My first layover was 11 hours long. An 11-hour layover sounds very long. However, it goes by very quickly. The plane arrived early in the morning, so nothing was open for the first few hours. (I took a much-needed nap because I couldn’t sleep in the cramped plane seat. More about those seats in an upcoming flight review post.) Then I needed to go through passport control and exit the airport. All of that cut into my layover.";
        //const currentWebpage = "This is a unhealthy news which relates to murder"
        console.log("Task 1 called successfully");

        if (!userId || !browsingTarget || !currentWebpage || !type) {
            return res.status(400).json({ message: 'Missing required fields in request body' });
        }

        const prompt = `Now I’m browsing a webpage with the text "${currentWebpage}" and I want to achieve "${browsingTarget}". Can you tell me if this is a relevant and healthy webpage to engage with? If no, answer with "no"; if yes,don't give me yes but provide a summary directly with less than 50 words.`;

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
