import React from 'react';

const MainContent_tabs = ({ activeTab, setActiveTab, imageData }) => {
  const tabs = ['Summary', 'Grammar', /* 'Translation' */, 'Word Cloud'];

  return (
    <div className="flex-1 p-4">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Tab Headers */}
        <div className="flex bg-gray-50 p-2 gap-2">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-200
                ${activeTab === tab
                  ? 'bg-white text-[#897ec2] shadow-md transform -translate-y-0.5'
                  : 'text-gray-600 hover:bg-gray-100'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                {/* Tab Icons */}
                {tab === 'Summary' && (
                  <svg className={`w-5 h-5 ${activeTab === tab ? 'text-[#897ec2]' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                {tab === 'Grammar' && (
                  <svg className={`w-5 h-5 ${activeTab === tab ? 'text-[#897ec2]' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                )}
                { /*tab === 'Translation' && (
                  <svg className={`w-5 h-5 ${activeTab === tab ? 'text-[#897ec2]' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                )*/}
                {tab === 'Word Cloud' && (
                  <svg className={`w-5 h-5 ${activeTab === tab ? 'text-[#897ec2]' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                )}
                <span>{tab}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6 bg-white">
          <div className={`transition-all duration-300 ${activeTab ? 'opacity-100' : 'opacity-0'}`}>
            {/* Summary Content */}
            {activeTab === 'Summary' && (
              <div className="prose max-w-none">
                <div className="bg-white p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Document Summary</h3>
                  <div className="text-gray-700">
                    {imageData.Summary || "No summary available"}
                  </div>
                </div>
              </div>
            )}

            {/* Grammar Content */}
            {activeTab === 'Grammar' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Grammar Analysis</h3>
                  <div className="text-gray-700">
                    {imageData.Grammar || "No grammar corrections needed"}
                  </div>
                </div>
              </div>
            )}

            {/* Translation Content */}
            {/*activeTab === 'Translation' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Translation</h3>
                  <div className="text-gray-700">
                    {imageData.Translation || "No translation available"}
                  </div>
                </div>
              </div>
            )*/}

            {/* Word Cloud Content */}
            {activeTab === 'Word Cloud' && (
              <div className="flex flex-col items-center">
                <h3 className="text-lg font-medium mb-4">Word Frequency Visualization</h3>
                {imageData.word_cloud ? (
                  <div className="max-w-2xl w-full">
                    <img
                      src={`data:image/png;base64,${imageData.word_cloud}`}
                      alt="Word Cloud"
                      className="w-full h-auto rounded-lg shadow-lg"
                    />
                  </div>
                ) : (
                  <div className="text-center text-gray-500 p-8">
                    No word cloud available for this document
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainContent_tabs;