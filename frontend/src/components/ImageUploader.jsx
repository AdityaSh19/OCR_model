import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';

const ImageUploader = forwardRef(({ onUpload }, ref) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    resetFileInput: () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }));

  const handleFiles = async (files) => {
    if (files.length > 0 && !isUploading) {
      setIsUploading(true);
      
      // Track the initial request ID for cancellation
      let requestId = null;
      
      // Notify parent about number of files being uploaded
      onUpload(null, files.length);
      
      try {
        const formData = new FormData();
        files.forEach(file => {
          formData.append('files', file);
        });

        const response = await fetch('http://localhost:8000/rag_doc/OCR/upload/', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6).trim();
                const data = JSON.parse(jsonStr);
                
                // Extract request ID from the first response
                if (!requestId && data?.request_id) {
                  requestId = data.request_id;
                  // Pass requestId to parent
                  onUpload(null, null, requestId);
                }
                
                if (data?.status === "success" && data?.data) {
                  onUpload([data]);
                } else if (data?.status === "completed") {
                  console.log('Processing completed:', data);
                }
              } catch (e) {
                console.error('Error parsing chunk:', e);
              }
            }
          }
        }

        if (buffer.startsWith('data: ')) {
          try {
            const jsonStr = buffer.slice(6).trim();
            const data = JSON.parse(jsonStr);
            if (data?.status === "success" && data?.data) {
              onUpload([data]);
            }
          } catch (e) {
            console.error('Error parsing final chunk:', e);
          }
        }

      } catch (error) {
        console.error('File upload error:', error);
        alert('Error uploading files: ' + error.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // File input change handler
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  return (
    <div className="p-4 border-b">
      <label 
        className={`flex flex-col items-center p-4 bg-opacity-10 border-2 border-dashed 
          rounded-lg cursor-pointer transition-colors 
          ${isUploading ? 'opacity-50' : ''} 
          ${isDragging ? 'bg-opacity-20 border-opacity-100' : ''}
          bg-[#897ec2] border-[#897ec2] hover:bg-opacity-20`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const files = Array.from(e.dataTransfer.files);
          handleFiles(files);
        }}
      >
        <svg className="w-8 h-8 text-[#897ec2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="mt-2 text-sm font-medium text-[#897ec2]">
          {isUploading ? 'Processing...' : 'Upload Images'}
        </span>
        <span className="mt-1 text-xs text-gray-500">Click or drag files here</span>
        <input 
          ref={fileInputRef}
          type="file" 
          className="hidden" 
          onChange={handleFileChange} 
          multiple 
          accept="image/*"
          disabled={isUploading}
        />
      </label>
    </div>
  );
});

export default ImageUploader;