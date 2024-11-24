export const highlightText=(indexes, structuredData)=> {
    // Highlight with a yellow background given an array of indexes of the structured text
    indexes.forEach(index => {
      const elementData = structuredData[index];
      if (elementData) {
        const elements = document.querySelectorAll(`${elementData.tag}.${elementData.className}`);
        elements.forEach((element) => {
          element.style.backgroundColor = 'yellow';
        });
      }
    });
  }