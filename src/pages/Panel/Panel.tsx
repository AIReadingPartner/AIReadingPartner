import React, { useState, useEffect } from 'react';
import './Panel.css';
import { Input, Button, Avatar, Card, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
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

  // send goal
  const sendGoal = async (goal: string) => {
    // call API
    let userId = currentTabId;

    const requestBody = {
      browingTarget: goal,
      currentWebPage: 'testString',
      userId: userId,
      type: 'summary',
    };
    try {
      const response = await fetch('http://localhost:3030/api/task/task1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      const data = await response.json();
      console.log(data);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // if (data.result.userId !== userId){
      //   return;
      // }

      if (!data.result.ifValid) {
        receivedSummary('Invalid Goal. Please try again.');
        return;
      }

      receivedSummary(data.result.textBody);
    } catch (err) {
      console.log(err);
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
      {messages.length > 0 && <h2>Ask AI about anything</h2>}
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
            <Button type="primary" disabled={!messageInput.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Panel;
