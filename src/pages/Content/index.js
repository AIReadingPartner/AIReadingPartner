import { printLine } from './modules/print';

function extractStructuredText() {
  const sections = []; // Array to hold the structured content

  // Query elements that could have meaningful content
  document.querySelectorAll('section, div, p, article, span').forEach((element, index) => {
    const text = element.innerText.trim(); // Get visible text content
    if (text) {
      sections.push({
        tag: element.tagName.toLowerCase(),
        content: text,
        id: element.id || null,
        className: element.className || null,
        index: index,
      });
    }
  });

  return sections; // Return the structured data
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "extractText") {
    try {
      const structuredData = extractStructuredText();
      sendResponse({ structuredData });
    } catch (error) {
      console.error('Error extracting structured text:', error);
      sendResponse({ error: error.message });
    }
    return true; // Indicates that the response will be sent asynchronously
  }
});

console.log('Content script works!');
console.log('Must reload extension for modifications to take effect.');

printLine("Using the 'printLine' function from the Print Module");
