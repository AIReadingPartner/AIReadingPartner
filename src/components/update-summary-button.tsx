import { Button, Tooltip } from 'antd';
import React, { useState, useEffect } from 'react';

interface UpdateSummaryButtonProps {
  goal: string;
}

export interface StructuredText {
  tag: string; // HTML tag of the element, "section"
  content: string; // Visible text content, "This is section 1."
  id: string | null; // Element's ID (if any), "section1"
  className: string | null; // Element's class (if any), "main-section"
  index: number; // Index of the element within its type, 0
}

export const UpdateSummaryButton: React.FC<UpdateSummaryButtonProps> = ({
  goal,
}) => {
  const [updateSummary, setUpdateSummary] = useState(false);
  const [isButtonDisabled, setIsButtonDisabled] = useState(false);

  useEffect(() => {
    if (goal.trim()) {
      setIsButtonDisabled(false);
    }
  }, [goal]);

  const handleUpdateClick = async () => {
    console.log('Update button clicked');
    setUpdateSummary(true);
    setIsButtonDisabled(true);

    // Send a message to the content script to extract structured text
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0].id !== undefined) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'extractText' },
          (response) => {
            if (response && response.structuredData) {
              const structuredData = response.structuredData;
              console.log('Structured Data:', structuredData);
              if (structuredData.length > 0) {
                // TODO get indexs of highlighted text
                // here we are assuming that we have highlighted text from index 100 to 120
                const indexs = Array.from({ length: 50 }, (_, i) => i + 800);

                // highlight text
                chrome.tabs.query(
                  { active: true, currentWindow: true },
                  (tabs) => {
                    if (tabs[0].id !== undefined) {
                      chrome.tabs.sendMessage(
                        tabs[0].id,
                        {
                          action: 'highlightText',
                          indexs,
                          structuredData: structuredData,
                        },
                        (response) => {
                          if (response && response.success) {
                            console.log('Text highlighted successfully');
                          } else {
                            console.error('Error:', response.error);
                          }
                        }
                      );
                    }
                  }
                );
              } else {
                console.error('Error:', response.error);
              }
            }
          }
        );
      }
    });
  };

  return (
    <>
      <Tooltip title="Update reading goal, and highlight all necessary contents in the current page.">
        <Button
          onClick={handleUpdateClick}
          type="primary"
          disabled={!goal.trim() || isButtonDisabled}
        >
          Update
        </Button>
      </Tooltip>
    </>
  );
};
