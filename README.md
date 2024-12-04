# AIReadingPartner

# Setup Instructions

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


## Highlight

The AI Reading Partner extension includes a feature to highlight specific text on a webpage.

Click the "Update" button to trigger the highlight functionality. This button will clear any existing highlights, extract the structured text from the webpage, and apply new highlights based on the specified criteria.

# Acknowledgements

Created from boilerplate https://github.com/lxieyang/chrome-extension-boilerplate-react
