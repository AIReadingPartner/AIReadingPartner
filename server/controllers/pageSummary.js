const { GoogleGenerativeAI } = require("@google/generative-ai");
const GEMINI_KEY = process.env.GEMINI_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

exports.processTask1 = async (req, res) => {
    try {
        // Sample request values (replace these with req.body values if needed)
        const userId = "1";
        const type = "summary";
        const browsingTarget = "I want to know the main point of the news";
        //const currentWebpage = "Let’s learn how to spend a long layover in Zurich, Switzerland. My first layover was 11 hours long. An 11-hour layover sounds very long. However, it goes by very quickly. The plane arrived early in the morning, so nothing was open for the first few hours. (I took a much-needed nap because I couldn’t sleep in the cramped plane seat. More about those seats in an upcoming flight review post.) Then I needed to go through passport control and exit the airport. All of that cut into my layover.";
        const currentWebpage = "This is a unhealthy news which relates to murder"
        console.log("called successfully");

        if (!userId || !browsingTarget || !currentWebpage || !type) {
            return res.status(400).json({ message: 'Missing required fields in request body' });
        }

        const prompt = `Now I’m browsing a webpage with the text "${currentWebpage}" and I want to achieve "${browsingTarget}". Can you tell me if this is a relevant and healthy webpage to engage with? If no, answer with "no"; if yes,don't give me yes but provide a summary directly with less than 50 words.`;

        // Initialize the generative model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Generate content using the Gemini API
        const result = await model.generateContent(prompt);

        const responseText = result.response.text();
        const isNoResponse = /^no(\s+)?$/i.test(responseText);
        const ifValid = !isNoResponse;
        const resultData = {
            userId,
            type,
            textBody: responseText,
            ifValid,
        };

        console.log(resultData);
        res.json({ message: 'Task 1 processed successfully', result: resultData });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: 'Error processing Task 1', error: error.message });
    }
};
