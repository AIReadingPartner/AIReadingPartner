export const extractStructuredText = () => {
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
  
    console.log('Extracted Structured Text:', sections);
    return sections; // Return the structured data
  }