export const clearHighlight = () => {
    const highlightedElements = document.querySelectorAll('[style*="background-color: yellow"]');
    highlightedElements.forEach((element) => {
      element.style.backgroundColor = '';
    });
  };