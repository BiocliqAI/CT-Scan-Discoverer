import React, { useState } from 'react';
import { CityData } from './types';
import FileUpload from './components/FileUpload';
import { GithubIcon } from './components/Icons';
import StateGroup from './components/StateGroup';

const App: React.FC = () => {
  const [groupedCities, setGroupedCities] = useState<Record<string, CityData[]>>({});

  const handleFileProcessed = (data: CityData[]) => {
    const grouped = data.reduce((acc, city) => {
      const { stateName } = city;
      if (!acc[stateName]) {
        acc[stateName] = [];
      }
      acc[stateName].push(city);
      return acc;
    }, {} as Record<string, CityData[]>);
    
    setGroupedCities(grouped);
  };

  const hasData = Object.keys(groupedCities).length > 0;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <div className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8 border-b border-gray-700 pb-4">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-400 tracking-tight">
            CT Scan Discoverer
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl mx-auto">
            Upload a CSV of Indian cities and pincodes to find CT scan centers using Gemini's advanced analysis with Google Maps & Search.
          </p>
        </header>

        <main>
          {!hasData ? (
            <FileUpload onFileProcessed={handleFileProcessed} />
          ) : (
            <div>
              <div className="space-y-6 animate-fade-in">
                {Object.keys(groupedCities).sort().map((stateName) => (
                  <StateGroup 
                    key={stateName} 
                    stateName={stateName} 
                    cities={groupedCities[stateName]} 
                  />
                ))}
              </div>
               <div className="text-center mt-8">
                <button
                    onClick={() => setGroupedCities({})}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
                >
                    Upload New File
                </button>
              </div>
            </div>
          )}
        </main>
        
        <footer className="text-center mt-12 text-gray-500 text-sm">
            <a href="https://github.com/google/generative-ai-docs/tree/main/site/en/gemini-api/docs/integrations/google_search" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-cyan-400 transition-colors">
                <GithubIcon />
                Powered by Gemini with Google Search Grounding
            </a>
        </footer>
      </div>
    </div>
  );
};

export default App;