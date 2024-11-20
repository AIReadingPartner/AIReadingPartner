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

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSidePanel') {
    // Open the side panel
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});


 chrome.action.onClicked.addListener((tab) => {
    const tabId = tab.id;
    chrome.sidePanel.open({ tabId });
    chrome.sidePanel.setOptions({
    tabId,
    path: 'panel.html',
    enabled: true
    });
  }
);