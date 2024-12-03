export const extractStructuredText = () => {
  const sections = []; // Array to hold the structured content
  let indexCounter = 0; // Counter to assign unique index numbers

  const isVisible = (element) => {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  };

  const shouldExcludeElement = (element) => {
    const excludedTags = ['script', 'style', 'noscript', 'iframe', 'canvas', 'svg',
       'audio', 'video', 'img', 'input', 'textarea', 
       'select', 'button', 'font']; // Add tags to exclude
    const excludedClasses = ['exclude-class']; // Add classes to exclude
    const excludedIds = ['exclude-id']; // Add IDs to exclude

    return (
      excludedTags.includes(element.tagName.toLowerCase()) ||
      excludedClasses.some((cls) => element.classList.contains(cls)) ||
      excludedIds.includes(element.id)
    );
  };

  const extractTextFromElement = (element) => {
    if (!isVisible(element) || shouldExcludeElement(element)) {
      return; // Skip invisible or excluded elements
    }

    const text = element.innerText ? element.innerText.trim() : ''; // Get visible text content
    const lines = text.split('\n'); // Split text by newline characters

    lines.forEach((line) => {
      // Check if the line contains any word characters (letters or digits) and meets minimum length
      const hasWords = /\w/.test(line);
      const minLength = 5; // Minimum length of text to be included
      const wordCount = line.split(/\s+/).length; // Count the number of words
      if (line && hasWords && line.length >= minLength && wordCount > 1) {
        sections.push({
          tag: element.tagName.toLowerCase(),
          content: line,
          id: element.id || null,
          className: element.className || null,
          index: indexCounter++, // Assign a unique index number
        });
      }
    });

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
