import React, { useState, useEffect } from 'react';
import './Panel.css';
import { Input, Button, Avatar, Card, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { extractStructuredText } from './utils/extract-structured-text.js';
const { TextArea } = Input;

interface Message {
  type: 'sent' | 'received';
  content: string;
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

  // get current tab id
  const getCurrentTabId = async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0].id !== undefined) {
        setCurrentTabId(tabs[0].id.toString());
      }
    } catch (err) {
      console.log(err);
    }
  }

  // New helper function to extract webpage content
  const extractWebpageContent = async (): Promise<string> => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.id || tab.url?.startsWith('chrome://')) {
        return 'This page cannot be analyzed. Please navigate to a regular webpage.';
      }

      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractStructuredText
      });
      return result[0].result;
    } catch (err) {
      console.error('Error extracting webpage content:', err);
      return 'An error occurred while analyzing the page.';
    }
  };

  // send goal
  const sendGoal = async (goal: string) => {
    // Add user's goal message to messages
    setMessages((prevMessages) => [
      ...prevMessages,
      { type: 'sent', content: goal },
    ]);

    const userId = currentTabId;
    const currentWebpage = await extractWebpageContent();
    console.log(currentWebpage);
    
    // Updated request body to match API format
    const requestBody = {
      userId,
      type: 'summary',
      browsingTarget: goal,  // Fixed typo from 'browingTarget'
      currentWebpage        // Fixed property name from 'currentWebPage'
    };

    try {
      const response = await fetch('http://localhost:3030/api/task/pageSummarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

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

      receivedSummary(data.data.result);
    } catch (err) {
      console.log(err);
      receivedSummary('Error processing your request. Please try again.');
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
    // default page
    if (tabId === undefined || tabId === '') {
      // empty message
      setMessages([]);
      setGoal('');
      setMessageInput('');
      return;
    }
    // call API
    try {
      // const response = await fetch(`http://localhost:3030/api/task/task4/${tabId}`);
      // const data = await response.json();
      // if (!response.ok) {
      //   throw new Error(`HTTP error! Status: ${response.status}`);
      // }
      setMessages([{ type: 'sent', content: tabId }]);
      setGoal('test');
      setMessageInput('test');
      setCurrentTabId(tabId);
    } catch (err) {
      console.log(err);
    }
  };

  // Add new function to send custom request
  const sendCustomRequest = async (customRequest: string) => {
    setMessages((prevMessages) => [
      ...prevMessages,
      { type: 'sent', content: customRequest },
    ]);

    setMessageInput('');

    try {
      const currentWebPage = await extractWebpageContent();
      
      const requestBody = {
        userId: currentTabId,
        type: "request",
        browsingTarget: goal,
        currentWebpage: currentWebPage,
        customizedRequest: customRequest,
      };

      const response = await fetch('http://localhost:3030/api/task/customizedReq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      setMessages((prevMessages) => [
        ...prevMessages,
        { type: 'received', content: data.response || 'No response available.' },
      ]);
    } catch (err) {
      console.error('Error in sendCustomRequest:', err);
      setMessages((prevMessages) => [
        ...prevMessages,
        { 
          type: 'received', 
          content: err instanceof Error 
            ? `Error: ${err.message}` 
            : 'Sorry, there was an error processing your request.' 
        },
      ]);
    }
  };

  useEffect(() => {
    const handleMessage = (request: any, sender: any, sendResponse: any) => {
      if (request.action === 'tabChanged') {
        console.log('Tab changed:', request.tabId);
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
      <h2>Browsing Goals</h2>
      <div className="input-container">
        <div className="textarea-wrapper">
          <TextArea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Let's start browsing! Please let me know your goal."
            autoSize={{ minRows: 3, maxRows: 5 }}
          />
          <Button
            type="primary"
            disabled={!goal.trim()}
            onClick={() => sendGoal(goal)}
          >
            Update
          </Button>
        </div>
      </div>
      {messages.length > 0 && <h2>Ask Gemini</h2>}
      {messages.length > 0 && (
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
                  <Avatar
                    style={{ backgroundColor: '#e05656' }}
                    icon={<UserOutlined />}
                  />
                )}
                <Card
                  size="small"
                  style={{
                    borderRadius:
                      message.type === 'sent'
                        ? '8px 0 8px 8px'
                        : '0 8px 8px 8px',
                    backgroundColor:
                      message.type === 'sent' ? '#1890ff' : '#e05656',
                    color: '#fff',
                  }}
                >
                  {message.content}
                </Card>
                {message.type === 'sent' && (
                  <Avatar
                    style={{ backgroundColor: '#1890ff' }}
                    icon={<UserOutlined />}
                  />
                )}
              </Space>
            </div>
          ))}
        </div>
      )}
      {messages.length > 0 && (
        <div className="input-container">
          <div className="textarea-wrapper">
            <TextArea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Message Gemini"
              autoSize={{ minRows: 4, maxRows: 5 }}
            />
            <Button 
              type="primary" 
              disabled={!messageInput.trim()}
              onClick={() => sendCustomRequest(messageInput)}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Panel;
