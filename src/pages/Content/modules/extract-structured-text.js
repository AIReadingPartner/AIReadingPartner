export const extractStructuredText = () => {
  const sections = []; // Array to hold the structured content
  let indexCounter = 0; // Counter to assign unique index numbers

  const extractTextFromElement = (element) => {
    const text = element.innerText ? element.innerText.trim() : ''; // Get visible text content
    if (text) {
      sections.push({
        tag: element.tagName.toLowerCase(),
        content: text,
        id: element.id || null,
        className: element.className || null,
        index: indexCounter++, // Assign a unique index number
      });
    }

    // Recursively extract text from child elements
    Array.from(element.children).forEach((child) => {
      extractTextFromElement(child);
    });
  };

  // Query elements that could have meaningful content
  document.querySelectorAll('section, div, p, article, span').forEach((element) => {
    extractTextFromElement(element);
  });

  console.log('Extracted Structured Text:', sections);
  return sections; // Return the structured data
};