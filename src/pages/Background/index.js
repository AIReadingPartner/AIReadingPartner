console.log('This is the background page.');
console.log('Put the background scripts here.');

// Create context menu item
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'openSidePanel',
    title: 'Open AI Reading Partner',
    contexts: ['page', 'selection']
  });
});

// Get Session Id
const getSessionId = () => {
  try {
    chrome.storage.local.get('sessionId', (result) => {
      if (!result.sessionId) {
        const uuid = crypto.randomUUID();
        chrome.storage.local.set({ sessionId: uuid });
      }
    });
  } catch (e) {
    const uuid = crypto.randomUUID();
    chrome.storage.local.set({ sessionId: uuid });
  }

  chrome.storage.local.get('sessionId', (result) => {
    console.log('Session ID:', result.sessionId);
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSidePanel') {
    // Open the side panel
    chrome.sidePanel.open({ windowId: tab.windowId });
    getSessionId();
  }
});


 chrome.action.onClicked.addListener((tab) => {
    const tabId = tab.id;
    chrome.sidePanel.setOptions({
    tabId,
    path: 'panel.html',
    enabled: true
    });
    chrome.sidePanel.open({ tabId });
    getSessionId();
  }
);


// Handle change of active tab
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.sidePanel.getOptions({ tabId: activeInfo.tabId }, (options) => {
      if (options && options.enabled) {
        chrome.sidePanel.setOptions({
          tabId: activeInfo.tabId
        });
        try {
          chrome.runtime.sendMessage({ action: 'tabChanged', tabId: activeInfo.tabId });
        } catch (e) {
          console.log('Error:', e);
        }
      }
    });
});

// Handle tab updates / refresh
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.sidePanel.getOptions({ tabId: tabId }, (options) => {
      if (options && options.enabled) {
        chrome.sidePanel.setOptions({
          tabId: tabId,
        });
        try {
          chrome.runtime.sendMessage({ action: 'tabChanged', tabId: tabId });
        } catch (e) {
          console.log('Error:', e);
      }
    }
    });
  }
});