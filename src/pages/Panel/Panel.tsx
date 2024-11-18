import React, { useState } from 'react';
import './Panel.css';
import { Input } from 'antd';
import { Button } from "antd";
import { SearchOutlined } from '@ant-design/icons';


const { TextArea } = Input;
const Panel: React.FC = () => {
  const [value, setValue] = useState('');
  const [position, setPosition] = useState<'start' | 'end'>('end');
  return (
    <div className="container">
      <h1>AI Reading Partner</h1>
      <TextArea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Controlled autosize"
        autoSize={{ minRows: 3, maxRows: 5 }}
      />
      <Button type="primary" icon={<SearchOutlined />} iconPosition={position}> Update </Button>
    </div>
  );
};

export default Panel;