export const extractStructuredText = (): string => {
  // Check if we're on a chrome:// URL
  if (window.location.protocol === 'chrome:') {
    return 'Cannot extract content from Chrome system pages.';
  }

  const extractedText: Set<string> = new Set(); // Use Set to avoid duplicates
  
  const isVisible = (element: HTMLElement): boolean => {
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    );
  };

  const shouldExcludeElement = (element: HTMLElement): boolean => {
    const excludedTags: string[] = ['script', 'style', 'noscript', 'iframe', 'canvas', 'svg',
      'audio', 'video', 'img', 'input', 'textarea', 'select', 'button', 'nav',
      'header', 'footer', 'menu', 'form'];
    const excludedClasses: string[] = ['nav', 'footer', 'header', 'menu'];
    
    return (
      excludedTags.includes(element.tagName.toLowerCase()) ||
      excludedClasses.some(cls => 
        element.className?.toLowerCase().includes(cls)
      )
    );
  };

  const extractTextFromElement = (element: HTMLElement): void => {
    if (!isVisible(element) || shouldExcludeElement(element)) {
      return;
    }

    const text = element.innerText?.trim();
    if (text && /\w/.test(text) && text.length >= 10 && text.split(/\s+/).length > 2) {
      extractedText.add(text);
    }

    Array.from(element.children).forEach(child => {
      extractTextFromElement(child as HTMLElement);
    });
  };

  // Focus on elements that typically contain main content
  const mainContentSelectors: string[] = [
    'article',
    'main',
    '[role="main"]',
    '.main-content',
    '.content',
    '#content',
    '.post',
    '.article'
  ];

  const mainElements = document.querySelectorAll(mainContentSelectors.join(','));
  
  if (mainElements.length > 0) {
    mainElements.forEach(element => extractTextFromElement(element as HTMLElement));
  } else {
    // Fallback to body if no main content containers found
    extractTextFromElement(document.body);
  }

  // Convert Set to Array and join with newlines
  const result = Array.from(extractedText).join('\n\n');
  console.log('Extracted Text:', result);
  return result;
};