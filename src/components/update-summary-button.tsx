import { Button, Tooltip, Modal } from 'antd';
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
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [firstStructuredText, setFirstStructuredText] =
    useState<StructuredText | null>(null);

  useEffect(() => {
    if (goal.trim()) {
      setIsButtonDisabled(false);
    }
  }, [goal]);

  //   function extractStructuredText() {
  //     const sections: StructuredText[] = []; // Array to hold the structured content

  //     // Query elements that could have meaningful content
  //     document
  //       .querySelectorAll('section, div, p, article, span')
  //       .forEach((element, index) => {
  //         const text = (element as HTMLElement).innerText.trim(); // Get visible text content
  //         if (text) {
  //           sections.push({
  //             tag: element.tagName.toLowerCase(),
  //             content: text,
  //             id: element.id || null,
  //             className: element.className || null,
  //             index: index,
  //           });
  //         }
  //       });

  //     return sections; // Return the structured data
  //   }
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
                setFirstStructuredText(structuredData[100]);
                setIsModalVisible(true);

                // TODO get indexs of highlighted text
                // here we are assuming that we have highlighted text from index 100 to 120
                const indexs = Array.from({ length: 20 }, (_, i) => i + 100);

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

  const handleModalOk = () => {
    setIsModalVisible(false);
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
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
      <Modal
        title="First Structured Text"
        visible={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
      >
        {firstStructuredText && (
          <div>
            <p>
              <strong>Tag:</strong> {firstStructuredText.tag}
            </p>
            <p>
              <strong>Content:</strong> {firstStructuredText.content}
            </p>
            <p>
              <strong>ID:</strong> {firstStructuredText.id}
            </p>
            <p>
              <strong>Class Name:</strong> {firstStructuredText.className}
            </p>
            <p>
              <strong>Index:</strong> {firstStructuredText.index}
            </p>
          </div>
        )}
      </Modal>
    </>
  );
};
