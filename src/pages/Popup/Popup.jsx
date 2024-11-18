// import React from 'react';
import React, { useState } from 'react';
import logo from '../../assets/img/logo.svg';
import Greetings from '../../containers/Greetings/Greetings';
import './Popup.css';

const Popup = () => {
  const [data, setData] = useState(''); 

  // example click handler to fetch data from server
  const fetchData = async () => {
    console.log("123456789")
    try {
      //const response = await fetch('http://localhost:3030/api/task/task1');
      const data = { userId:"123", browsingTarget:"123", currentWebpage:"123", type:"123" };
      const response = await fetch('http://localhost:3030/api/task/task1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const result = await response.json(); 
      setData(result.message); 
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/pages/Popup/Popup.jsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React!
        </a>
        {/* 新增按钮，用于获取后端数据 */}
        <button onClick={fetchData} className="fetch-button">
          Fetch Data from Server
        </button>
        {/* 显示从后端获取的数据 */}
        {data && <p>Server Response: {data}</p>}
      </header>
    </div>
  );
};

export default Popup;
