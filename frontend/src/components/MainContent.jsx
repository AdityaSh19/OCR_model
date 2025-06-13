import React, { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import MainContent_tabs from './MainContent_tabs';
import { formatTextForDownload } from './utils';   // Fixed path - same directory
import { hasMarkdownTables, extractTablesToCSV, downloadCSV } from './tableUtils';
import ReactDOM from 'react-dom';

import { saveAs } from 'file-saver';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  HeadingLevel,
  BorderStyle,
  VerticalAlign,
  HeightRule,
  WidthType,
  TableLayoutType
} from 'docx';
const MainContent = ({ selectedImage }) => {
  const [activeTab, setActiveTab] = useState('Summary');
  const [isEditing, setIsEditing] = useState(false);
  const [editedOCR, setEditedOCR] = useState('');
  const [isFullView, setIsFullView] = useState(false);
  const tabs = ['Summary', 'Grammar', 'Translation', 'Word Cloud'];

  // Initialize editedOCR when selectedImage changes
  React.useEffect(() => {
    if (selectedImage?.OCR) {
      setEditedOCR(selectedImage.OCR);
    }
  }, [selectedImage]);

  if (!selectedImage) {
    return (
      <div className="flex-1 p-6 text-center text-gray-500">
        Please select an image from the sidebar
      </div>
    );
  }

  // Check if the response has data property and define imageData
  const imageData = selectedImage.data || selectedImage;

  const formatTableRow = (row, rowIndex, tableIndex, isHeader = false) => {
    const cells = row.split('|').filter(cell => cell.trim());
    return (
      <tr key={`table-${tableIndex}-row-${rowIndex}`}>
        {cells.map((cell, cellIndex) => (
          <td
            key={`table-${tableIndex}-row-${rowIndex}-cell-${cellIndex}`}
            className={`border px-4 py-2 ${isHeader ? 'font-bold bg-gray-50' : ''}`}
          >
            {cell.trim()}
          </td>
        ))}
      </tr>
    );
  };

  const formatText = (text) => {
    if (!text) return null;

    const lines = text.split('\n');
    const formattedContent = [];
    let isTable = false;
    let tableContent = [];
    let tableCount = 0;
    let skipNextLine = false;

    lines.forEach((line, index) => {
      if (skipNextLine) {
        skipNextLine = false;
        return;
      }

      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!isTable) {
          isTable = true;
          tableContent = [];
          tableCount++;
        }

        // Skip separator line (contains only | --- |)
        const nextLine = lines[index + 1];
        if (nextLine && nextLine.includes('---')) {
          skipNextLine = true;
        }

        // Don't add separator line to table content
        if (!line.includes('---')) {
          tableContent.push(line);
        }
      } else {
        if (isTable) {
          const currentTableIndex = tableCount;
          formattedContent.push(
            <table key={`table-${currentTableIndex}-${index}`} className="min-w-full border-collapse border my-2">
              <tbody>
                {tableContent.map((tableRow, rowIndex) =>
                  formatTableRow(tableRow, rowIndex, currentTableIndex, rowIndex === 0)
                )}
              </tbody>
            </table>
          );
          isTable = false;
          tableContent = [];
        }

        const parts = line.split(/(\*\*.*?\*\*)/g);
        const formattedLine = (
          <div key={`line-${index}`}>
            {parts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={`line-${index}-bold-${partIndex}`}>
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              return (
                <span key={`line-${index}-text-${partIndex}`}>
                  {part}
                </span>
              );
            })}
          </div>
        );
        formattedContent.push(formattedLine);
      }
    });

    if (isTable && tableContent.length > 0) {
      const finalTableIndex = tableCount;
      formattedContent.push(
        <table key={`table-final-${finalTableIndex}`} className="min-w-full border-collapse border my-2">
          <tbody>
            {tableContent.map((tableRow, rowIndex) =>
              formatTableRow(tableRow, rowIndex, finalTableIndex)
            )}
          </tbody>
        </table>
      );
    }

    return formattedContent;
  };

  const handleCopyOCR = async () => {
    try {
      const textToCopy = isEditing ? editedOCR : imageData.OCR;

      // Create a temporary container to render the formatted content
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      const formattedContent = formatText(textToCopy);

      // Render the React elements to the DOM
      ReactDOM.render(<>{formattedContent}</>, tempDiv);

      // Apply CSS styles to tables in the temporary element
      const tables = tempDiv.querySelectorAll('table');
      tables.forEach(table => {
        table.style.borderCollapse = 'collapse';
        table.style.width = '100%';
        table.style.border = '1px solid #ddd';
        table.style.margin = '8px 0';

        const cells = table.querySelectorAll('td');
        cells.forEach(cell => {
          cell.style.border = '1px solid #ddd';
          cell.style.padding = '8px';
        });

        // Style header cells
        const headerCells = table.querySelectorAll('tr:first-child td');
        headerCells.forEach(cell => {
          cell.style.fontWeight = 'bold';
          cell.style.backgroundColor = '#f2f2f2';
        });
      });

      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.write) {
        try {
          const htmlBlob = new Blob([tempDiv.innerHTML], { type: 'text/html' });
          const textBlob = new Blob([textToCopy], { type: 'text/plain' });

          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': htmlBlob,
              'text/plain': textBlob
            })
          ]);

          // Clean up and return if successful
          ReactDOM.unmountComponentAtNode(tempDiv);
          document.body.removeChild(tempDiv);
          alert('OCR text copied to clipboard with formatting!');
          return;
        } catch (clipboardApiError) {
          console.error('Clipboard API failed:', clipboardApiError);
          // Continue to fallback approach
        }
      }

      // Fallback to selection-based approach
      try {
        const selection = window.getSelection();
        const range = document.createRange();

        selection.removeAllRanges();
        range.selectNodeContents(tempDiv);
        selection.addRange(range);

        const successful = document.execCommand('copy');
        selection.removeAllRanges();

        if (successful) {
          alert('OCR text copied to clipboard with formatting!');
        } else {
          throw new Error('execCommand copy failed');
        }
      } catch (fallbackError) {
        console.error('Selection copy failed:', fallbackError);
        // Final fallback - plain text
        await navigator.clipboard.writeText(textToCopy);
        alert('OCR text copied to clipboard (plain text only)!');
      } finally {
        // Clean up
        ReactDOM.unmountComponentAtNode(tempDiv);
        document.body.removeChild(tempDiv);
      }
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Ultimate fallback
      try {
        const textToCopy = isEditing ? editedOCR : imageData.OCR;
        await navigator.clipboard.writeText(textToCopy);
        alert('OCR text copied to clipboard (plain text only)!');
      } catch (finalError) {
        console.error('All copy methods failed:', finalError);
        alert('Failed to copy text');
      }
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Update the imageData OCR when saving
      imageData.OCR = editedOCR;
    }
    setIsEditing(!isEditing);
  };

  /**
   * Handles downloading tables as CSV files
   */
  const handleDownloadTables = () => {
    const text = isEditing ? editedOCR : imageData.OCR;
    const tables = extractTablesToCSV(text);

    if (tables.length === 1) {
      // Single table - direct download
      downloadCSV(tables[0], `${imageData.filename.split('.')[0]}_table`);
    } else if (tables.length > 1) {
      // Multiple tables - download with index
      tables.forEach((table, index) => {
        downloadCSV(table, `${imageData.filename.split('.')[0]}_table_${index + 1}`);
      });
    }
  };



  const handleDownloadOCR = () => {
    const text = isEditing ? editedOCR : imageData.OCR;
    const doc = new jsPDF();

    // Set title
    doc.setFontSize(16);
    doc.text(imageData.filename, 20, 20);

    let yPos = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;

    const lines = text.split('\n');
    let currentTable = [];
    let isTable = false;

    lines.forEach((line, index) => {
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!isTable) {
          isTable = true;
          currentTable = [];
        }

        // Skip separator lines
        if (!line.includes('---')) {
          const cells = line.split('|')
            .filter(cell => cell.trim())
            .map(cell => cell.trim());
          currentTable.push(cells);
        }
      } else {
        if (isTable && currentTable.length > 0) {
          // Draw the table
          doc.autoTable({
            startY: yPos,
            head: [currentTable[0]], // First row as header
            body: currentTable.slice(1), // Rest of the rows as body
            margin: { left: margin },
            theme: 'grid',
            styles: { fontSize: 10 },
            headStyles: { fillColor: [200, 200, 200] }
          });

          yPos = doc.lastAutoTable.finalY + 10;
          isTable = false;
          currentTable = [];
        }

        // Handle regular text and bold text
        if (line.trim()) {
          const parts = line.split(/(\*\*.*?\*\*)/g);
          let lineText = '';

          parts.forEach(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
              doc.setFont(undefined, 'bold');
              lineText += part.slice(2, -2);
              doc.setFont(undefined, 'normal');
            } else {
              lineText += part;
            }
          });

          // Add text with word wrap
          const splitText = doc.splitTextToSize(lineText, maxWidth);

          // Check if we need a new page
          if (yPos + (5 * splitText.length) > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            yPos = margin;
          }

          doc.setFontSize(10);
          doc.text(splitText, margin, yPos);
          // Reduce line spacing - changed from 10 to 5
          yPos += 5 * splitText.length;
        } else {
          // Reduce empty line spacing - changed from 5 to 3
          yPos += 3;
        }
      }
    });

    // Handle any remaining table
    if (isTable && currentTable.length > 0) {
      doc.autoTable({
        startY: yPos,
        head: [currentTable[0]],
        body: currentTable.slice(1),
        margin: { left: margin },
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [200, 200, 200] }
      });
    }

    // Save the PDF
    doc.save(`${imageData.filename.split('.')[0]}_OCR.pdf`);
  };

  const handleDownloadWord = async () => {
    try {
      const textToCopy = isEditing ? editedOCR : imageData.OCR;

      // Create a temporary container to render the formatted content
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);

      const formattedContent = formatText(textToCopy);

      // Render the React elements to the DOM
      ReactDOM.render(<>{formattedContent}</>, tempDiv);

      // Create document with all children in a single section
      const docChildren = [];

      // Add title as the first child in the same section
      docChildren.push(
        new Paragraph({
          text: imageData.filename,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 200 },
        })
      );

      // Process all elements in the temporary div
      const paragraphs = tempDiv.querySelectorAll('div');
      const tables = tempDiv.querySelectorAll('table');

      // Handle paragraphs
      paragraphs.forEach(para => {
        // Process text and bold elements
        const runs = [];
        Array.from(para.childNodes).forEach(node => {
          if (node.nodeName === 'STRONG') {
            runs.push(new TextRun({
              text: node.textContent,
              bold: true,
              size: 24, // 12pt
            }));
          } else if (node.nodeName === 'SPAN' || node.nodeType === Node.TEXT_NODE) {
            if (node.textContent.trim()) {
              runs.push(new TextRun({
                text: node.textContent,
                size: 24, // 12pt
              }));
            }
          }
        });

        if (runs.length > 0) {
          docChildren.push(new Paragraph({
            children: runs,
            spacing: { after: 120 },
          }));
        }
      });

      // Handle tables with improved formatting
      tables.forEach(table => {
        const rows = [];
        const tableRows = table.querySelectorAll('tr');

        // Find the max number of cells to determine column width
        let maxCells = 0;
        tableRows.forEach(row => {
          const cellCount = row.querySelectorAll('td').length;
          maxCells = Math.max(maxCells, cellCount);
        });

        // Create table rows
        tableRows.forEach((row, rowIndex) => {
          const cells = [];
          const tableCells = row.querySelectorAll('td');

          tableCells.forEach((cell, cellIndex) => {
            cells.push(
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell.textContent.trim(),
                        size: 24, // 12pt
                        bold: rowIndex === 0, // Bold text in header row
                      }),
                    ],
                  }),
                ],
                shading: rowIndex === 0 ? { fill: "F2F2F2" } : undefined,
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                },
                verticalAlign: VerticalAlign.CENTER,
                margins: {
                  top: 100,
                  bottom: 100,
                  left: 150,
                  right: 150,
                },
              })
            );
          });

          rows.push(new TableRow({
            children: cells,
            height: { value: 400, rule: HeightRule.ATLEAST }
          }));
        });

        if (rows.length > 0) {
          // Add the table with even column distribution
          docChildren.push(
            new Table({
              rows,
              width: { size: 100, type: "pct" },
              // Set table properties for better formatting
              tableProperties: {
                tableWidth: { size: 100, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
                },
                // Ensure the table layout uses fixed width columns
                layout: TableLayoutType.FIXED,
              },
              // Make columns equal width
              columnWidths: Array(maxCells).fill(Math.floor(9000 / maxCells)),
            })
          );

          // Add spacing after table
          docChildren.push(
            new Paragraph({
              text: "",
              spacing: { after: 200 },
            })
          );
        }
      });

      // Create document with a single section containing all content
      const doc = new Document({
        sections: [{
          properties: {},
          children: docChildren
        }],
        styles: {
          paragraphStyles: [
            {
              id: "Normal",
              name: "Normal",
              run: {
                size: 24, // 12pt
              },
              paragraph: {
                spacing: {
                  line: 276, // 1.15 line spacing
                  before: 0,
                  after: 0,
                },
              },
            },
          ],
        },
      });

      // Generate and save the document
      console.log('Generating DOCX blob...');
      const blob = await Packer.toBlob(doc);
      console.log('Blob generated, saving file...');
      saveAs(blob, `${imageData.filename.split('.')[0]}_OCR.docx`);

      // Clean up
      ReactDOM.unmountComponentAtNode(tempDiv);
      document.body.removeChild(tempDiv);
    } catch (error) {
      console.error('Failed to generate Word document:', error);
      alert(`Failed to generate Word document: ${error.message}`);
    }
  };

  // Toggle full view popup
  const toggleFullView = () => {
    setIsFullView(!isFullView);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-100 min-h-screen overflow-auto">
      {/* File name header */}
      <div className="sticky top-0 bg-gray-100 p-4 border-b z-10">
        <h2 className="text-xl font-semibold">{imageData.filename}</h2>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col">
        {/* Image and OCR Text */}
        <div className="flex p-4 gap-4">
          <div className="w-1/2">
            <h3 className="text-lg font-medium mb-2">Original Image</h3>
            {imageData.img_base64 ? (
              <img
                src={`data:image/jpeg;base64,${imageData.img_base64}`}
                alt={imageData.filename}
                className="max-w-full h-auto rounded-lg shadow-lg"
              />
            ) : (
              <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-500">
                Image not available
              </div>
            )}
          </div>
          <div className="w-1/2">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">OCR</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadOCR}
                  className="p-2 hover:bg-[#897ec2] hover:text-white rounded-full transition-colors"
                  title="Download OCR as PDF"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>

                {/* Single Word document download button */}
                <button
                  onClick={handleDownloadWord}
                  className="p-2 hover:bg-[#897ec2] hover:text-white rounded-full transition-colors"
                  title="Download OCR as Word document (.docx)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.41a1 1 0 00-.29-.71l-5.7-5.7A1 1 0 0012.3 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 3v6h6" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 12h2M11 16h2M11 8h2" />
                  </svg>
                </button>


                {/* New CSV download button - only shown when tables are present */}
                {hasMarkdownTables(isEditing ? editedOCR : imageData.OCR) && (
                  <button
                    onClick={handleDownloadTables}
                    className="p-2 hover:bg-[#897ec2] hover:text-white rounded-full transition-colors"
                    title="Download tables as CSV"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}

                {/* Full view button */}
                <button
                  onClick={toggleFullView}
                  className="p-2 hover:bg-[#897ec2] hover:text-white rounded-full transition-colors"
                  title="Open full screen view"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                  </svg>
                </button>

                <button
                  onClick={handleCopyOCR}
                  className="p-2 hover:bg-[#897ec2] hover:text-white rounded-full transition-colors"
                  title="Copy OCR text"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={handleEditToggle}
                  className={`p-2 ${isEditing ? 'bg-[#897ec2] text-white' : 'hover:bg-[#897ec2] hover:text-white'} rounded-full transition-colors`}
                  title={isEditing ? "Save changes" : "Edit OCR text"}
                >
                  {isEditing ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-lg">
              {isEditing ? (
                <textarea
                  value={editedOCR}
                  onChange={(e) => setEditedOCR(e.target.value)}
                  className="w-full h-[700px] p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#897ec2]"
                  style={{ minHeight: '700px', resize: 'vertical' }}
                />
              ) : (
                <div className="whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                  {formatText(editedOCR || imageData.OCR)}
                </div>
              )}
            </div>
          </div>
        </div>

        <MainContent_tabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          imageData={imageData}
        />

      </div>

      {/* Fullscreen OCR Text Popup */}
      {isFullView && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg w-11/12 h-5/6 max-w-6xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">OCR Text - {imageData.filename}</h2>
              <button
                onClick={toggleFullView}
                className="p-2 hover:bg-[#897ec2] hover:text-white rounded-full transition-colors"
                title="Close fullscreen view"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 p-6 overflow-auto">
              {isEditing ? (
                <textarea
                  value={editedOCR}
                  onChange={(e) => setEditedOCR(e.target.value)}
                  className="w-full h-full p-4 border rounded focus:outline-none focus:ring-2 focus:ring-[#897ec2]"
                  style={{ resize: 'none' }}
                />
              ) : (
                <div className="whitespace-pre-wrap">
                  {formatText(editedOCR || imageData.OCR)}
                </div>
              )}
            </div>
            <div className="flex justify-end p-4 border-t">
              <button
                onClick={toggleFullView}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md mr-2"
              >
                Close
              </button>
              {isEditing && (
                <button
                  onClick={handleEditToggle}
                  className="px-4 py-2 bg-[#897ec2] text-white hover:bg-[#7b70b3] rounded-md"
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainContent;