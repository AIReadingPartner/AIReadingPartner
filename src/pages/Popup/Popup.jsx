// import React from 'react';
import React, { useState } from 'react';
import logo from '../../assets/img/logo.svg';
import Greetings from '../../containers/Greetings/Greetings';
import './Popup.css';
import config from '../../config';

const Popup = () => {
  const [data, setData] = useState(''); 

  // example click handler to fetch data from server
  const testSummary = async () => {
    try {
      const data = { userId:"123", browsingTarget:"123", currentWebpage:"123", type:"123" };
      const response = await fetch(`${config.API_URL}/task/pageSummarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };
  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({
     active: true,
     lastFocusedWindow: true
    });
    const tabId = tab.id;
    await chrome.sidePanel.open({ tabId });
    await chrome.sidePanel.setOptions({
     tabId,
     path: 'panel.html',
     enabled: true
    });
   };

  //testRequest
  const testRequest = async () => {
    console.log("request testing")
    try {
      const data = { userId:"123", browsingTarget:"123", currentWebpage:"123", type:"123" };
      const response = await fetch(`${config.API_URL}/task/customizedReq`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  //testExplain
  const testExplain = async () => {
    console.log("request testing")
    try {
      const data = { userId:"123", browsingTarget:"123", currentWebpage:"123", type:"123" };
      const response = await fetch(`${config.API_URL}/task/sentenceExplain`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      const result = await response.json();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  //testGetAll
  const testGetAllHistory = async () => {
    console.log("GetAllHistory testing")
    try {
      const response = await fetch(`${config.API_URL}/crud//hisdata/1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
      console.log(result)
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
        <button onClick={testSummary} className="fetch-button">
          test Summary
        </button>
        <button onClick={testRequest} className="fetch-button">
          test Request
        </button>
        <button onClick={testExplain} className="fetch-button">
          test Explain
        </button>
        <button onClick={testGetAllHistory} className="fetch-button">
          test Get All
        </button>
        <button onClick={openSidePanel} className="fetch-button">
          Open Side Panel
        </button>
        {/* 显示从后端获取的数据 */}
        {data && <p>Server Response: {data}</p>}
      </header>
    </div>
  );
};


export default Popup;
