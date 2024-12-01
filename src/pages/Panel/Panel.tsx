import React, { useState, useEffect } from 'react';
import './Panel.css';
import { Input, Button, Avatar, Card, Space, Spin } from 'antd';
import { UserOutlined, DesktopOutlined } from '@ant-design/icons';
import { extractStructuredText } from './utils/extract-structured-text.js';
import { port, host } from './api';
import { UpdateSummaryButton } from '../../components/update-summary-button';
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
  // const [currentTabId, setCurrentTabId] = useState<string>('');
  const currentTabIdRef = React.useRef<string>('');
  const cannotUpdate = React.useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  // Add this ref for the messages container
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Add this scroll helper function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Add this useEffect to scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
        return tabs[0].id.toString();
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
      return String(result[0].result);
    } catch (err) {
      console.error('Error extracting webpage content:', err);
      return 'An error occurred while analyzing the page.';
    }
  };

  // send goal
  const sendGoal = async (goal: string) => {
    setMessages((prevMessages) => [
      // ...prevMessages, // clear messages when sending a new goal
      { type: 'sent', content: goal },
      { type: 'received', content: '', loading: true },
    ]);
    cannotUpdate.current = true;

    const sessionId = await getSessionId();
    const userId = sessionId + currentTabIdRef.current;
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
        // 'http://localhost:3030/api/task/pageSummarize',
        `http://${host}:${port}/api/task/pageSummarize`,
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
        receivedMessage('Invalid Goal. Please try again.');
      } else if (userId === data.data.userId) {
        receivedMessage(data.data.result);
      }
    } catch (err) {
      console.log(err);
      receivedMessage('Error processing your request. Please try again.');
    } finally {
      cannotUpdate.current = false;
    }
  };

  // received summary
  const receivedMessage = async (message: string) => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages];
      // Remove loading message
      if (
        newMessages.length > 0 &&
        newMessages[newMessages.length - 1].loading
      ) {
        newMessages.pop();
      }
      newMessages.push({ type: 'received', content: message });
      return newMessages;
    });
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
        // `http://localhost:3030/api/crud/hisdata/${userId}`
        `http://${host}:${port}/api/crud/hisdata/${userId}`
      );
      if (response.status === 404) {
        return;
      }
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json().then((data) => data.data);
      console.log(data);
      // sort data by createdAt older to newer
      data.sort((a: any, b: any) => {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      for (let i = 0; i < data.length; i++) {
        if (data[i].type === 'summary') {
          setGoal(data[i].browsingTarget);
          setMessages((prevMessages) => [
            // ...prevMessages, // clear messages when having a new goal
            { type: 'sent', content: data[i].browsingTarget },
            {
              type: 'received',
              content: data[i].ifValid
                ? data[i].result
                : 'Invalid Goal. Please try again.',
            },
          ]);
        } else if (data[i].type === 'request') {
          setMessages((prevMessages) => [
            ...prevMessages,
            { type: 'sent', content: data[i].customizedRequest },
            {
              type: 'received',
              content: data[i].ifValid
                ? data[i].result
                : 'Based on your current page, I cannot find out the answer.',
            },
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
      { type: 'received', content: '', loading: true },
    ]);
    cannotUpdate.current = true;
    setMessageInput('');

    try {
      const currentWebPage = await extractWebpageContent();
      const sessionId = await getSessionId();
      const userId = sessionId + currentTabIdRef.current;
      const requestBody = {
        userId: userId,
        type: 'request',
        browsingTarget: goal,
        currentWebpage: currentWebPage,
        customizedRequest: customRequest,
      };

      const response = await fetch(
        // 'http://localhost:3030/api/task/customizedReq',
        `http://${host}:${port}/api/task/customizedReq`,
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
      if (data.ifValid) {
        receivedMessage(data.response);
      } else {
        receivedMessage(
          'Based on your current page, I cannot find out the answer.'
        );
      }
    } catch (err) {
      if (err instanceof Error) {
        receivedMessage(`Error: ${err.message}`);
      } else {
        receivedMessage('Sorry, there was an error processing your request.');
      }
    } finally {
      cannotUpdate.current = false;
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
        const tabId = String(request.tabId);
        if (currentTabIdRef.current !== tabId) {
          console.log(
            'Tab changed from:',
            currentTabIdRef.current,
            'to:',
            tabId
          );
          currentTabIdRef.current = tabId;
          initPanelbyTabId(tabId);
        }
      }
      sendResponse({ status: 'Message received' });
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Get current tab id on mount
    getCurrentTabId().then((tabId) => {
      if (tabId) {
        currentTabIdRef.current = tabId;
        console.log('Current tab ID:', tabId);
        initPanelbyTabId(tabId);
      }
    });

    // Cleanup listener on unmount
    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return (
    <div className="container">
      <h2>Reading Goals</h2>
      <div className="input-container">
        <div className="textarea-wrapper">
          <TextArea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Type your reading goals here..."
            autoSize={{ minRows: 3, maxRows: 5 }}
          />
          <Button type="primary" disabled={!goal.trim()}>
            Update
          </Button>
        </div>
      </div>
      <h2>Ask AI about anything</h2>
      <div className="messages-container">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message-wrapper ${
              message.type === 'sent' ? 'message-sent' : 'message-received'
            }`}
          >
            <Space align="start">
              {message.type === 'received' && (
                <Avatar style={{ backgroundColor: '#e05656' }} icon={<UserOutlined />} />
              )}
              <Card
                size="small"
                style={{
                  borderRadius:
                    message.type === 'sent' ? '8px 0 8px 8px' : '0 8px 8px 8px',
                  backgroundColor:
                    message.type === 'sent' ? '#1890ff' : '#e05656',
                  color: '#fff',
                }}
              >
                {message.content}
              </Card>
              {message.type === 'sent' && (
                <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
              )}
            </Space>
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
                  disabled={!goal.trim() || cannotUpdate.current}
                  onClick={() => sendGoal(goal)}
                  className="update-button"
                >
                  {!cannotUpdate ? 'Updating...' : 'Update'}
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
                        className={`message-item ${
                          message.type === 'sent' ? 'sent' : 'received'
                        }`}
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
                    {/* Add this div at the end of messages */}
                    <div ref={messagesEndRef} />
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
                      disabled={!messageInput.trim() || cannotUpdate.current}
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
