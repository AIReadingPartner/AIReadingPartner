import { printLine } from './modules/print';
import { extractStructuredText } from './modules/extract-structured-text';
import { highlightText } from './modules/highlight-text';
import {clearHighlight} from './modules/clear-highlight';


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  if (request.action === "extractText") {
    try {
      const structuredData = extractStructuredText();
      sendResponse({ structuredData });
    } catch (error) {
      console.error('Error extracting structured text:', error);
      sendResponse({ error: error.message });
    }
    return true; // Indicates that the response will be sent asynchronously
  } else if (request.action === "highlightText") {
    console.log('Highlighting text with indexes:', request.indexes);
    try {
      highlightText(request.indexes, request.structuredData);
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error highlighting text:', error);
      sendResponse({ error: error.message });
    }
    return true; // Indicates that the response will be sent asynchronously
  } else if (request.action === "clearHighlight") {
    console.log('Clearing highlights');
    try {
      clearHighlight();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error clearing highlights:', error);
      sendResponse({ error: error.message });
    }
    return true; // Indicates that the response will be sent asynchronously
  }
});
console.log('Content script works!');
console.log('Must reload extension for modifications to take effect.');

printLine("Using the 'printLine' function from the Print Module");
