import config from '..//config';
export interface StructuredText {
  tag: string; // HTML tag of the element, "section"
  content: string; // Visible text content, "This is section 1."
  id: string | null; // Element's ID (if any), "section1"
  className: string | null; // Element's class (if any), "main-section"
  index: number; // Index of the element within its type, 0
}
// console.log('Current API URL:', config.API_URL);

const sendMessageToTab = (tabId: number, message: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError.message);
      } else {
        resolve(response);
      }
    });
  });
};

const getActiveTab = (): Promise<chrome.tabs.Tab> => {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id !== undefined) {
        resolve(tabs[0]);
      } else {
        reject('No active tab found');
      }
    });
  });
};

export const handleUpdateHighlight = async (goal: string) => {
  console.log('Update button clicked');

  try {
    const activeTab = await getActiveTab();
    await sendMessageToTab(activeTab.id!, { action: 'clearHighlight' });
    console.log('Highlights cleared');

    const response = await sendMessageToTab(activeTab.id!, {
      action: 'extractText',
    });
    if (response && response.structuredData) {
      const structuredData = response.structuredData;
      console.log('Response: ', response);
      console.log('Structured Data:', structuredData);
      if (structuredData.length > 0) {
        const backendResponse = await fetch(
          `${config.API_URL}/task/highlightSentence`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              browsingTarget: goal,
              structuredData: structuredData,
            }),
          }
        );
        if (!backendResponse.ok) {
          console.log('Backend Response:', backendResponse);
          throw new Error(`HTTP error! status: ${backendResponse.status}`);
        }
        const responseData = await backendResponse.json();
        const indexes = responseData.result; //array of numbers, relevant indices.
        console.log('Relevant Indices:', indexes);

        const highlightResponse = await sendMessageToTab(activeTab.id!, {
          action: 'highlightText',
          indexes: indexes,
          structuredData,
        });

        if (highlightResponse && highlightResponse.success) {
          console.log('Text highlighted successfully');
        } else {
          console.error('Error:', highlightResponse.error);
        }
      } else {
        console.error('Error:', response.error);
      }
    }
  } catch (error) {
    console.error('Error:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));

  }
};
