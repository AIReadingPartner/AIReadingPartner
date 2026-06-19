const { GoogleGenerativeAI } = require("@google/generative-ai");
const GeminiReq = require("../models/geminiReq");
const { getStore, retrieveContext } = require("../rag");
const { embed: defaultEmbed } = require("../rag/embeddings");

const GEMINI_KEY = process.env.GEMINI_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// Default generation: summarize using ONLY the retrieved, numbered context.
const defaultGenerate = async (prompt) => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
};

exports.pageSummarize = async (req, res) => {
  try {
    const { userId, type, browsingTarget, currentWebpage } = req.body;
    if (!userId || !browsingTarget || !currentWebpage || !type) {
      return res.status(400).json({ message: "Missing required fields in request body" });
    }

    const store = req.app.locals.ragStore || getStore();
    const embed = req.app.locals.ragEmbed || defaultEmbed;
    const generate = req.app.locals.ragGenerate || defaultGenerate;

    // Phase 1 contract: currentWebpage must be the page URL used as the ingestion
    // key (the same `url` passed to /api/task/ingest). Phase 3 client wiring must
    // send the URL here, not the page text, and call /ingest before summarizing.
    const { context, citations } = await retrieveContext({
      store, embed, userId, url: currentWebpage, query: browsingTarget, k: 5,
    });

    if (!context) {
      return res.json({
        message: "Page not indexed yet - call /api/task/ingest first",
        citations: [],
        data: null,
      });
    }

    const prompt = "Summarize the page for the goal \"" + browsingTarget + "\" in under 150 words. " +
      "Use ONLY the numbered context below and cite the [n] indices you used. " +
      "If the goal is irrelevant to the context, answer exactly \"no\".\n\nContext:\n" + context;
    const responseText = await generate(prompt);
    const ifValid = !/^no(\s+)?$/i.test(responseText.trim());

    let data = { userId, type, browsingTarget, currentWebpage, result: responseText, ifValid };
    if (!req.app.locals.ragSkipPersist) {
      const geminiRequest = new GeminiReq(data);
      await geminiRequest.save();
      data = geminiRequest;
    }

    res.json({ message: "Page summary processed", citations, data });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error processing Page Summary", error: error.message });
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
