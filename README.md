# AI Reading Partner

## Key Features

- **Goal-Driven Browsing**  
  Define a specific browsing goal for each session. Whether it’s a targeted task (e.g., "Find job postings matching my skills") or broad exploration (e.g., "Learn about renewable energy trends"), the tool tailors its assistance to your needs.

- **Page Analysis and Summaries**  
  Leverage built-in summarization APIs and Gemini to analyze visited pages. Receive concise summaries that are directly aligned with your browsing goals.
![alt text](https://github.com/AIReadingPartner/AIReadingPartner/blob/main/imgs/summary.png?raw=true)
- **Highlighted Core Sentences**  
  AI-powered by Gemini highlights the most relevant content on each page, making it easier for you to focus on what truly matters.
![alt text](https://github.com/AIReadingPartner/AIReadingPartner/blob/main/imgs/highlight.png?raw=true)
- **Conversational Follow-Up Questions**  
  Engage with the tool using natural, conversational language. Ask follow-up questions to dive deeper, clarify details, or refine your understanding of the information presented.
![alt text](https://github.com/AIReadingPartner/AIReadingPartner/blob/main/imgs/askmore.png?raw=true)


## Setup Instructions

### Using the Chrome Plugin

- **Load Unpacked Plugin**  
  1. Go to Chrome's Extensions page (`chrome://extensions/`).  
  2. Enable *Developer Mode* (toggle in the top-right corner).  
  3. Click on *Load Unpacked* and select the `build` directory as the target.

- **Prebuilt Plugin**  
  If you want to use the plugin easily without running the client locally:  
  1. Use the zipped plugin resource available in the repository.  
  2. Load the zipped plugin into Chrome from the Extensions page.  

The deployed version of the server is already connected to the plugin.

### Clone the Repository and Run Locally

1. **Client Setup**  
   Navigate to the `AIReadingPartner/src` directory and run the following commands:  
   ```bash
   npm install
   npm start
   ```

2. **Server Setup**  
   Navigate to the `AIReadingPartner/server` directory and run the following commands:  
   ```bash
   npm install
   npm run start-server
   ```

3. **Environment Variables**  
   Set up the `.env` file with your own credentials:  
   ```bash
   MONGO_URI=your_mongo_db_connection_string
   GEMINI_KEY=your_gemini_api_key
   ```
   
## Acknowledgements

Created from boilerplate https://github.com/lxieyang/chrome-extension-boilerplate-react
