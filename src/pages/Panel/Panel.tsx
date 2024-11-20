import React, { useState } from 'react';
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
          <Button type="primary" disabled={!goal.trim()}>
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
