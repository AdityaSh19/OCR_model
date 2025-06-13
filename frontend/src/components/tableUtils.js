// src/components/tableUtils.js

/**
 * Checks if text contains markdown tables
 * @param {string} text - Text to check for tables
 * @returns {boolean} True if text contains tables
 */
export const hasMarkdownTables = (text) => {
    const lines = text.split('\n');
    return lines.some(line => 
      line.trim().startsWith('|') && 
      line.trim().endsWith('|') &&
      !line.includes('---')
    );
  };
  
  /**
   * Extracts tables from markdown text and converts to CSV format
   * @param {string} text - Markdown text containing tables
   * @returns {Array<string>} Array of CSV formatted tables
   */
  export const extractTablesToCSV = (text) => {
    const lines = text.split('\n');
    const tables = [];
    let currentTable = [];
    let isTable = false;
  
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
        // Skip separator lines
        if (trimmedLine.includes('---')) {
          return;
        }
  
        if (!isTable) {
          isTable = true;
        }
  
        // Process table row
        const cells = trimmedLine
          .slice(1, -1) // Remove outer pipes
          .split('|')
          .map(cell => {
            // Clean cell content and handle quotes for CSV
            const cleaned = cell.trim().replace(/"/g, '""');
            return `"${cleaned}"`; // Wrap in quotes for CSV format
          });
  
        currentTable.push(cells.join(','));
      } else if (isTable) {
        // End of table reached
        if (currentTable.length > 0) {
          tables.push(currentTable.join('\n'));
          currentTable = [];
        }
        isTable = false;
      }
    });
  
    // Handle last table if exists
    if (currentTable.length > 0) {
      tables.push(currentTable.join('\n'));
    }
  
    return tables;
  };
  
  /**
   * Downloads table data as a CSV file
   */
  export const downloadCSV = (csvContent, filename) => {
    // Process the CSV content to only quote when necessary
    const processedContent = csvContent.split('\n').map(line => {
      return line.split(',').map(value => {
        // Remove any existing quotes
        value = value.replace(/^"(.*)"$/, '$1');
        
        // Only quote if the value contains commas, quotes, or newlines
        if (/[",\n\r]/.test(value) || value.trim() !== value) {
          // Escape any quotes within the value by doubling them
          value = value.replace(/"/g, '""');
          return `"${value}"`;
        }
        return value;
      }).join(',');
    }).join('\n');
  
    const blob = new Blob([processedContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };