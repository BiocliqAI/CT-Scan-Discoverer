import React, { useState } from 'react';
import { CityData } from './types';
import FileUpload from './components/FileUpload';
import CityTile from './components/CityTile';
import { GithubIcon } from './components/Icons';

const App: React.FC = () => {
  const [cities, setCities] = useState<CityData[]>([]);

  const handleFileProcessed = (data: CityData[]) => {
    setCities(data);
  };

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
          {cities.length === 0 ? (
            <FileUpload onFileProcessed={handleFileProcessed} />
          ) : (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {cities.map((city) => (
                  <CityTile key={city.name} initialCityData={city} />
                ))}
              </div>
               <div className="text-center mt-8">
                <button
                    onClick={() => setCities([])}
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