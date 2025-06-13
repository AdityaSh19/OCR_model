import React from 'react';

const StatusPanel = ({ uploadStats }) => {
  // Calculate in progress count
  const inProgressCount = uploadStats.uploaded - uploadStats.completed;
  
  // Don't show the panel if nothing is in progress
  if (inProgressCount <= 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white rounded-lg shadow-lg p-3 flex items-center gap-3 max-w-md animate-slideUp">
        {/* Image Icon */}
        <div className="bg-blue-100 p-2 rounded-full">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        
        {/* Status Text */}
        <div className="flex-1">
          <p className="text-gray-800 font-medium">Processing Images</p>
          <p className="text-sm text-gray-600">
            {uploadStats.completed} of {uploadStats.uploaded} completed
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${(uploadStats.completed / uploadStats.uploaded) * 100}%` }}
            ></div>
          </div>
        </div>
        
        {/* Cancel Button - REMOVED */}
      </div>
    </div>
  );
};

export default StatusPanel;
