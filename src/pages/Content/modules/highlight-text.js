export const highlightText = (indexes, structuredData) => {
  // Highlight with a yellow background given an array of indexes of the structured text
  indexes.forEach(index => {
    const elementData = structuredData.find(data => data.index === index);
    if (elementData) {
      let selector = elementData.tag;
      if (elementData.id) {
        selector += `#${elementData.id}`;
      } else if (elementData.className) {
        selector += `.${elementData.className.split(' ').join('.')}`;
      }
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        elements.forEach((element) => {
            // Ensure the element matches all the criteria to avoid highlighting too many elements
            if (
                element.innerText.trim() === elementData.content.trim() 
            ) {
            element.style.backgroundColor = 'yellow';
          }
        });
      } else {
        console.warn(`No elements found for selector: ${selector}`);
      }
    } else {
      console.warn(`No element data found for index: ${index}`);
    }
  });
};
