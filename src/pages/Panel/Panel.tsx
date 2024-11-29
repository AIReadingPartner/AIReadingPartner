import React, { useState, useEffect } from 'react';
import './Panel.css';
import { Input, Button, Avatar, Card, Space, Spin } from 'antd';
import { UserOutlined, DesktopOutlined } from '@ant-design/icons';
import { extractStructuredText } from './utils/extract-structured-text.js';
const { TextArea } = Input;

interface Message {
  type: 'sent' | 'received';
  content: string;
  loading?: boolean;
}

const Panel: React.FC = () => {
  const [goal, setGoal] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    // { type: 'sent', content: 'Hello there!' },
    // { type: 'received', content: 'Hi! How can I help you today?' },
    // { type: 'sent', content: 'I have a question about programming.' },
  ]);
  const [currentTabId, setCurrentTabId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoalLoading, setIsGoalLoading] = useState(false);

  // Get Session Id
  const getSessionId = async () => {
    return new Promise<string>((resolve, reject) => {
      chrome.storage.local.get('sessionId', (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result.sessionId || crypto.randomUUID());
        }
      });
    });
  };

  // get current tab id
  const getCurrentTabId = async () => {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0].id !== undefined) {
        setCurrentTabId(tabs[0].id.toString());
      }
    } catch (err) {
      console.log(err);
    }
  };

  // New helper function to extract webpage content
  const extractWebpageContent = async (): Promise<string> => {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.id || tab.url?.startsWith('chrome://')) {
        return 'This page cannot be analyzed. Please navigate to a regular webpage.';
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractStructuredText,
      });
      return result[0].result;
    } catch (err) {
      console.error('Error extracting webpage content:', err);
      return 'An error occurred while analyzing the page.';
    }
  };

  // send goal
  const sendGoal = async (goal: string) => {
    setIsGoalLoading(true);
    setMessages((prevMessages) => [
      ...prevMessages,
      { type: 'sent', content: goal },
      { type: 'received', content: '', loading: true }
    ]);

    const sessionId = await getSessionId();
    const userId = sessionId + currentTabId;
    const currentWebpage = await extractWebpageContent();
    console.log(currentWebpage);

    // Updated request body to match API format
    const requestBody = {
      userId,
      type: 'summary',
      browsingTarget: goal, // Fixed typo from 'browingTarget'
      currentWebpage, // Fixed property name from 'currentWebPage'
    };

    try {
      const response = await fetch(
        'http://localhost:3030/api/task/pageSummarize',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);

      // Updated to match API response structure
      if (!data.data.ifValid) {
        receivedSummary('Invalid Goal. Please try again.');
        return;
      }

      if (userId !== data.data.userId) {
        return;
      }

      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages.pop(); // Remove loading message
        newMessages.push({ type: 'received', content: data.data.result });
        return newMessages;
      });
    } catch (err) {
      console.log(err);
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages.pop(); // Remove loading message
        newMessages.push({ 
          type: 'received', 
          content: 'Error processing your request. Please try again.' 
        });
        return newMessages;
      });
    } finally {
      setIsGoalLoading(false);
    }
  };

  // received summary
  const receivedSummary = async (summary: string) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { type: 'received', content: summary },
    ]);
  };

  const initPanelbyTabId = async (tabId: string) => {
    console.log('Init panel by tab id:', tabId);
    // default page
    setMessages([]);
    setGoal('');
    setMessageInput('');
    setIsLoading(true);
    // call API
    try {
      const userId = (await getSessionId()) + tabId;
      const response = await fetch(
        `http://localhost:3030/api/crud/hisdata/${userId}`
      );
      if (response.status === 404) {
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json().then((data) => data.data);
      console.log(data);
      for (let i = 0; i < data.length; i++) {
        if (data[i].type === 'summary') {
          setGoal(data[i].browsingTarget);
          setMessages([
            { type: 'sent', content: data[i].browsingTarget },
            { type: 'received', content: data[i].result },
          ]);
        } else if (data[i].type === 'request') {
          setMessages((prevMessages) => [
            ...prevMessages,
            { type: 'sent', content: data[i].customizedRequest },
            { type: 'received', content: data[i].response },
          ]);
        }
      }
    } catch (err) {
      console.log(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add new function to send custom request
  const sendCustomRequest = async (customRequest: string) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { type: 'sent', content: customRequest },
      { type: 'received', content: '', loading: true }
    ]);

    setMessageInput('');

    try {
      const currentWebPage = await extractWebpageContent();
      const sessionId = await getSessionId();
      const userId = sessionId + currentTabId;
      const requestBody = {
        userId: userId,
        type: 'request',
        browsingTarget: goal,
        currentWebpage: currentWebPage,
        customizedRequest: customRequest,
      };

      const response = await fetch(
        'http://localhost:3030/api/task/customizedReq',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages.pop();
        newMessages.push({
          type: 'received',
          content: data.ifValid ? 
            data.response : 
            'Based on your current page, I cannot find out the answer.',
        });
        return newMessages;
      });
    } catch (err) {
      setMessages((prevMessages) => {
        const newMessages = [...prevMessages];
        newMessages.pop();
        newMessages.push({
          type: 'received',
          content: err instanceof Error
            ? `Error: ${err.message}`
            : 'Sorry, there was an error processing your request.',
        });
        return newMessages;
      });
    }
  };

  // Add this new function to handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (messageInput.trim()) {
        sendCustomRequest(messageInput);
      }
    }
  };

  // Add goal key press handler
  const handleGoalKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (goal.trim()) {
        sendGoal(goal);
      }
    }
  };

  useEffect(() => {
    const handleMessage = (request: any, sender: any, sendResponse: any) => {
      if (request.action === 'tabChanged') {
        console.log('Tab changed:', request.tabId);
        setCurrentTabId(request.tabId);
        initPanelbyTabId(request.tabId);
      }
      sendResponse({ status: 'Message received' });
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Get current tab id
    getCurrentTabId();

    // Cleanup listener on component unmount
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return (
    <div className="container">
      <div>
        {isLoading ? (
          <div className="loading-spinner">
            <Spin tip="Loading" size="large" />
          </div>
        ) : (
          <div className="main-content">
            <h2 className="section-title">Browsing Goals</h2>
            <div className="input-container">
              <div className="textarea-wrapper">
                <TextArea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={handleGoalKeyPress}
                  placeholder="Let's start browsing! Please let me know your goal."
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  className="custom-textarea"
                />
                <Button
                  type="primary"
                  disabled={!goal.trim() || isGoalLoading}
                  onClick={() => sendGoal(goal)}
                  className="update-button"
                >
                  {isGoalLoading ? 'Updating...' : 'Update'}
                </Button>
              </div>
            </div>

            {messages.length > 0 && (
              <>
                <h2 className="section-title">Ask Gemini</h2>
                <div className="messages-container">
                  <div className="messages-wrapper">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`message-item ${message.type === 'sent' ? 'sent' : 'received'}`}
                      >
                        <div className="message-content">
                          {message.type === 'received' && (
                            <div className="avatar received">
                              <DesktopOutlined />
                            </div>
                          )}
                          <div className="message-bubble">
                            {message.loading ? (
                              <Spin size="small" />
                            ) : (
                              message.content
                            )}
                          </div>
                          {message.type === 'sent' && (
                            <div className="avatar sent">
                              <UserOutlined />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="input-container">
                  <div className="textarea-wrapper">
                    <TextArea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={handleKeyPress}
                      placeholder="Message Gemini"
                      autoSize={{ minRows: 2, maxRows: 5 }}
                      className="custom-textarea"
                    />
                    <Button
                      type="primary"
                      disabled={!messageInput.trim()}
                      onClick={() => sendCustomRequest(messageInput)}
                      className="send-button"
                    >
                      Send
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Panel;
