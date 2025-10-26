import React, { useState, useRef, useCallback } from 'react';
import { CityData } from '../types';
import { findAndAnalyzeCTScans } from '../services/geminiService';
import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, DoctorIcon, LocationIcon, PhoneIcon, StopIcon, MapLinkIcon, ReasoningIcon } from './Icons';

interface CityTileProps {
  initialCityData: CityData;
}

const CityTile: React.FC<CityTileProps> = ({ initialCityData }) => {
  const [city, setCity] = useState<CityData>(initialCityData);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isResultsVisible, setIsResultsVisible] = useState(false);
  const isCancelled = useRef(false);

  const { name, pincodes, status, currentPincodeIndex, centersFound, results, error, population } = city;
  const totalPincodes = pincodes.length;
  const progress = totalPincodes > 0 ? (currentPincodeIndex / totalPincodes) * 100 : 0;
  
  const runDiscovery = useCallback(async () => {
    isCancelled.current = false;
    setCity(prev => ({ ...prev, status: 'running', currentPincodeIndex: 0, centersFound: 0, results: [], error: undefined }));

    for (let i = 0; i < totalPincodes; i++) {
      if (isCancelled.current) {
        setCity(prev => ({ ...prev, status: 'stopped' }));
        return;
      }

      const currentPincode = pincodes[i];
      setCity(prev => ({
        ...prev,
        currentPincodeIndex: i,
        pincodes: prev.pincodes.map((p, idx) => idx === i ? { ...p, status: 'scanning' } : p),
      }));

      try {
        const newCenters = await findAndAnalyzeCTScans(currentPincode.code);
        
        if (isCancelled.current) {
          setCity(prev => ({ ...prev, status: 'stopped' }));
          return;
        }
        
        setCity(prev => ({
          ...prev,
          results: [...prev.results, ...newCenters],
          centersFound: prev.centersFound + newCenters.length,
          pincodes: prev.pincodes.map((p, idx) => idx === i ? { ...p, status: 'scanned' } : p),
        }));

      } catch(err) {
         if (isCancelled.current) {
            setCity(prev => ({ ...prev, status: 'stopped' }));
            return;
         }
         console.error(`Error processing pincode ${currentPincode.code}:`, err);
         setCity(prev => ({
             ...prev,
             pincodes: prev.pincodes.map((p, idx) => idx === i ? { ...p, status: 'error' } : p),
             error: `Failed on pincode ${currentPincode.code}.`,
         }));
      }
    }
    
    if (!isCancelled.current) {
      setCity(prev => ({ ...prev, status: 'completed', currentPincodeIndex: totalPincodes }));
    }
  }, [totalPincodes, pincodes]);

  const handleStop = () => {
    isCancelled.current = true;
  };

  const getStatusInfo = () => {
    switch (status) {
      case 'idle':
        return <p className="text-gray-400">Ready to start discovery.</p>;
      case 'running':
        return <p className="text-cyan-400 animate-pulse">Scanning pincode {pincodes[currentPincodeIndex]?.code}... ({currentPincodeIndex + 1}/{totalPincodes})</p>;
      case 'stopped':
        return <p className="text-yellow-400">Search stopped by user.</p>;
      case 'completed':
        return <p className="text-green-400 flex items-center gap-1"><CheckCircleIcon/> Discovery complete.</p>;
      case 'error':
        return <p className="text-red-500">An error occurred: {error}</p>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-5 flex flex-col transition-all duration-300">
      <header className="flex justify-between items-start cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          <div>
              <h2 className="text-2xl font-bold text-white">{name}</h2>
              <div className="text-gray-400 text-sm flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <span>{totalPincodes} pincodes</span>
                  {population > 0 && <span>Pop: {population.toLocaleString()}</span>}
              </div>
          </div>
          <button className="p-1 text-gray-400 hover:text-white flex-shrink-0">
            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
      </header>
      
      {isExpanded && (
        <main className="mt-4 animate-fade-in">
            <div className="mb-2">
                <div className="flex justify-between mb-1">
                    <span className="text-base font-medium text-cyan-400">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    <span className="text-sm font-medium text-cyan-400">{centersFound} centers found</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                    <div className="bg-cyan-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
            <div className="h-6 text-sm mb-4">{getStatusInfo()}</div>
            
            <div className="mt-4">
              {status === 'running' ? (
                <button onClick={handleStop} className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                  <StopIcon/> Stop
                </button>
              ) : (
                <button onClick={runDiscovery} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                  {status === 'completed' || status === 'stopped' ? 'Discover Again' : 'Discover Now'}
                </button>
              )}
            </div>

            {results.length > 0 && (
                <div className="mt-4 border-t border-gray-700 pt-4">
                  <button onClick={() => setIsResultsVisible(!isResultsVisible)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-200 hover:text-white">
                    <span>View {results.length} Found Centers</span>
                    {isResultsVisible ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </button>
                  {isResultsVisible && (
                    <div className="mt-4 space-y-4 max-h-80 overflow-y-auto pr-2 animate-fade-in">
                      {results.map((center, index) => (
                        <div key={index} className="bg-gray-700 p-4 rounded-lg">
                          <div className="flex justify-between items-start gap-2">
                              <h4 className="font-bold text-cyan-400 text-lg">{center.centerName}</h4>
                              <a href={center.googleMapsLink} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 inline-flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1 px-2 rounded-md transition-colors">
                                  Map <MapLinkIcon />
                              </a>
                          </div>
                          <p className="flex items-start gap-2 mt-2 text-sm text-gray-300"><LocationIcon />{center.address}</p>
                          <p className="flex items-center gap-2 mt-1 text-sm text-gray-300"><PhoneIcon />{center.contactDetails || 'Not available'}</p>
                          {center.doctorDetails && center.doctorDetails.length > 0 && (
                              <div className="mt-2 text-sm text-gray-300">
                                 <p className="flex items-center gap-2 font-semibold"><DoctorIcon/> Associated Doctors:</p>
                                 <ul className="list-disc list-inside ml-4 text-gray-400">
                                      {center.doctorDetails.map((doc, i) => <li key={i}>{doc}</li>)}
                                 </ul>
                              </div>
                          )}
                           <div className="mt-3 pt-3 border-t border-gray-600">
                                <p className="flex items-start gap-2 text-sm text-gray-400">
                                    <ReasoningIcon />
                                    <span className="italic">"{center.reasoning}"</span>
                                </p>
                            </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            )}
        </main>
      )}
    </div>
  );
};

export default CityTile;