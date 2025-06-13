import React, { useState, useRef, useEffect } from 'react';
import ImageUploader from './components/ImageUploader';
import MainContent from './components/MainContent';
import StatusPanel from './components/StatusPanel';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function App() {
  const [uploadedImages, setUploadedImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadStats, setUploadStats] = useState({
    uploaded: 0,
    completed: 0
  });
  const imageUploaderRef = useRef(null);

  // Calculate in progress count
  const inProgressCount = uploadStats.uploaded - uploadStats.completed;

  const handleUpload = (newImages, fileCount, requestId) => {
    // Update uploaded count when files are selected
    if (fileCount) {
      setUploadStats(prev => ({
        ...prev,
        uploaded: prev.uploaded + fileCount
      }));
    }

    // Process completed files from API
    if (newImages?.length > 0) {
      const processedImages = newImages.map(img => {
        if (img?.status === "success" && img?.data) {
          return {
            ...img.data,
            status: img.status
          };
        }
        return null;
      }).filter(Boolean);

      if (processedImages.length > 0) {
        setUploadStats(prev => ({
          ...prev,
          completed: prev.completed + 1
        }));

        setUploadedImages(prev => [...prev, ...processedImages]);
        if (!selectedImage) {
          setSelectedImage(processedImages[0]);
        }
      }
    }
  };

  // Add animation class to Tailwind config (via style tag)
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .animate-slideUp {
        animation: slideUp 0.3s ease-out forwards;
      }
    `;
    document.head.appendChild(styleElement);
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-72 bg-white border-r flex flex-col">
        <ImageUploader 
          ref={imageUploaderRef} 
          onUpload={handleUpload} 
        />

        {/* Upload Stats */}
        <div className="p-4 bg-gray-50 border-t">
          <h3 className="text-sm font-semibold mb-3">Upload Statistics</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-100 p-3 rounded text-center">
              <p className="text-blue-600 text-xs">Uploaded</p>
              <p className="text-blue-800 font-bold text-lg mt-1">{uploadStats.uploaded}</p>
            </div>
            <div className="bg-yellow-100 p-3 rounded text-center">
              <p className="text-yellow-600 text-xs">In Progress</p>
              <p className="text-yellow-800 font-bold text-lg mt-1">{inProgressCount}</p>
            </div>
            <div className="bg-green-100 p-3 rounded text-center">
              <p className="text-green-600 text-xs">Completed</p>
              <p className="text-green-800 font-bold text-lg mt-1">{uploadStats.completed}</p>
            </div>
          </div>
        </div>

        {/* Files List */}
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Files</h2>
          {uploadedImages.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setUploadedImages([]);
                  setSelectedImage(null);
                  setUploadStats({
                    uploaded: 0,
                    completed: 0
                  });
                  if (imageUploaderRef.current) {
                    imageUploaderRef.current.resetFileInput();
                  }
                }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Clear All"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <div className="relative">
                <button
                onClick={() => {
                  if (uploadedImages.length === 0) {
                  alert('No files to download');
                  return;
                  }
                  const downloadAsSeparatePDFs = () => {
                  uploadedImages.forEach(image => {
                    const text = image.OCR;
                    const doc = new jsPDF();
                    
                    // Set title
                    doc.setFontSize(16);
                    doc.text(image.filename, 20, 20);
                    
                    let yPos = 40;
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const margin = 20;
                    const maxWidth = pageWidth - 2 * margin;

                    const lines = text.split('\n');
                    let currentTable = [];
                    let isTable = false;

                    lines.forEach((line) => {
                    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                      if (!isTable) {
                      isTable = true;
                      currentTable = [];
                      }

                      if (!line.includes('---')) {
                      const cells = line.split('|')
                        .filter(cell => cell.trim())
                        .map(cell => cell.trim());
                      currentTable.push(cells);
                      }
                    } else {
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

                      yPos = doc.lastAutoTable.finalY + 10;
                      isTable = false;
                      currentTable = [];
                      }

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

                      const splitText = doc.splitTextToSize(lineText, maxWidth);

                      if (yPos + (5 * splitText.length) > doc.internal.pageSize.getHeight() - margin) {
                        doc.addPage();
                        yPos = margin;
                      }

                      doc.setFontSize(10);
                      doc.text(splitText, margin, yPos);
                      yPos += 5 * splitText.length;
                      } else {
                      yPos += 3;
                      }
                    }
                    });

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

                    doc.save(`${image.filename.split('.')[0]}_OCR.pdf`);
                  });
                  };

                  const downloadAsSinglePDF = () => {
                  const doc = new jsPDF();
                  
                  uploadedImages.forEach((image, index) => {
                    const text = image.OCR;
                    
                    // Add new page if not first document
                    if (index > 0) {
                    doc.addPage();
                    }
                    
                    // Set title for each document
                    doc.setFontSize(16);
                    doc.text(image.filename, 20, 20);
                    
                    let yPos = 40;
                    const pageWidth = doc.internal.pageSize.getWidth();
                    const margin = 20;
                    const maxWidth = pageWidth - 2 * margin;

                    const lines = text.split('\n');
                    let currentTable = [];
                    let isTable = false;

                    lines.forEach((line) => {
                    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                      if (!isTable) {
                      isTable = true;
                      currentTable = [];
                      }

                      if (!line.includes('---')) {
                      const cells = line.split('|')
                        .filter(cell => cell.trim())
                        .map(cell => cell.trim());
                      currentTable.push(cells);
                      }
                    } else {
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

                      yPos = doc.lastAutoTable.finalY + 10;
                      isTable = false;
                      currentTable = [];
                      }

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

                      const splitText = doc.splitTextToSize(lineText, maxWidth);

                      if (yPos + (5 * splitText.length) > doc.internal.pageSize.getHeight() - margin) {
                        doc.addPage();
                        yPos = margin;
                      }

                      doc.setFontSize(10);
                      doc.text(splitText, margin, yPos);
                      yPos += 5 * splitText.length;
                      } else {
                      yPos += 3;
                      }
                    }
                    });

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
                  });

                  doc.save('OCR_Documents.pdf');
                  };

                  // Create dropdown menu
                  const menu = document.createElement('div');
                  menu.className = 'absolute top-full right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50';

                  menu.innerHTML = `
                  <div class="py-1" role="menu" aria-orientation="vertical">
                    <button class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" id="separate-pdfs">
                    Download as Separate PDFs
                    </button>
                    <button class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" id="single-pdf">
                    Download as Single PDF
                    </button>
                  </div>
                  `;
                  const button = document.querySelector('[title="Download OCR"]');
                  button.parentNode.appendChild(menu);

                  
                  const separateButton = menu.querySelector('#separate-pdfs');
                  const singleButton = menu.querySelector('#single-pdf');
                  
                  separateButton.addEventListener('click', () => {
                    downloadAsSeparatePDFs();
                      menu.remove();

                  });
                  
                  singleButton.addEventListener('click', () => {
                    downloadAsSinglePDF();
                      menu.remove();

                  });
                  
                  // Close menu and overlay when clicking outside
                  const closeMenu = (e) => {
                    if (!menu.contains(e.target)) {
                      menu.remove();

                    document.removeEventListener('click', closeMenu);
                    }
                  };
                  
                  setTimeout(() => {
                  document.addEventListener('click', closeMenu);
                  }, 0);
                }}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                title="Download OCR"
                >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {uploadedImages.length > 0 ? (
            uploadedImages.map((image, index) => (
              <div
                key={index}
                className={`flex items-center p-4 cursor-pointer hover:bg-gray-100 ${
                  selectedImage === image ? 'bg-[#897ec2]/10' : ''
                }`}
                onClick={() => setSelectedImage(image)}
              >
                <div className="mr-3">
                  <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 truncate flex-1">{image.filename}</p>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500">
              No files uploaded yet
            </div>
          )}
        </div>
      </div>

      <MainContent selectedImage={selectedImage} />
      
      {/* Floating Status Panel */}
      <StatusPanel 
        uploadStats={uploadStats}
      />
    </div>
  );
}

export default App;