export const highlightText = (indexes, structuredData) => {
  // Function to determine if a color is light or dark
  const isLightColor = (color) => {
    const rgb = color.match(/\d+/g);
    const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
    return brightness > 155;
  };

  // Function to get the computed color of an element
  const getComputedColor = (element, property) => {
    return window.getComputedStyle(element).getPropertyValue(property);
  };

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
          if (element.innerText.trim() === elementData.content.trim()) {
            const textColor = getComputedColor(element, 'color');
            const backgroundColor = getComputedColor(element, 'background-color');
            let highlightColor;

            if (isLightColor(textColor)) {
              highlightColor = 'rgba(0, 0, 255, 0.1)'; // Light text, use dark blue highlight
            } else {
              highlightColor = 'rgba(255, 255, 0, 0.5)'; // Dark text, use light yellow highlight
            }

            element.style.backgroundColor = highlightColor;
            console.log(`Highlighted element for selector: ${selector}`);
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
