// Create new file: src/components/utils.js

/**
 * Formats text for download by converting markdown-style formatting to plain text
 * Handles the following conversions:
 * - Tables: Preserves table structure while removing markdown syntax
 * - Bold text: Converts **text** to UPPERCASE
 * - Line breaks: Maintains proper spacing between elements
 * 
 * Example conversions:
 * 1. Tables:
 *    | Header | Header2 |        ->  Header  Header2
 *    |--------|---------|        ->  
 *    | Cell   | Cell2   |        ->  Cell    Cell2
 * 
 * 2. Bold:
 *    **bold text**                ->  BOLD TEXT
 * 
 * @param {string} text - Raw text containing markdown formatting
 * @returns {string} Formatted plain text suitable for download
 */
export const formatTextForDownload = (text) => {
    if (!text) return '';
  
    const lines = text.split('\n');
    let formattedText = '';
    let isTable = false;
    let tableContent = [];
    let skipNextLine = false;
  
    lines.forEach((line, index) => {
      // Skip separator lines in tables (lines with |---|)
      if (skipNextLine) {
        skipNextLine = false;
        return;
      }
  
      // Table handling: Detect start of table
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!isTable) {
          isTable = true;
          tableContent = [];
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
        // Handle end of table and add accumulated table content
        if (isTable) {
          formattedText += tableContent.join('\n') + '\n\n';
          isTable = false;
          tableContent = [];
        }
  
        // Convert bold text (**text**) to uppercase
        const parts = line.split(/(\*\*.*?\*\*)/g);
        const formattedLine = parts.map(part => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return part.slice(2, -2).toUpperCase(); // Use uppercase for bold in txt
          }
          return part;
        }).join('');
  
        formattedText += formattedLine + '\n';
      }
    });
  
    // Handle any remaining table content at the end of text
    if (isTable && tableContent.length > 0) {
      formattedText += tableContent.join('\n') + '\n';
    }
  
    return formattedText;
};