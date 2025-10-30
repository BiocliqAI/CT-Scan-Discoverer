import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CityData, ScanCenter, PincodeStatus } from '../types';
import { findAndAnalyzeCTScans } from '../services/geminiService';
import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon, DoctorIcon, LocationIcon, PhoneIcon, StopIcon, MapLinkIcon, ReasoningIcon, DownloadIcon } from './Icons';

interface CityTileProps {
  cityData: CityData;
  onUpdate: (updater: (city: CityData) => CityData) => void;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const MAX_CONCURRENT_PINCODES = 2;

const CityTile: React.FC<CityTileProps> = ({ cityData, onUpdate }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResultsVisible, setIsResultsVisible] = useState(false);
  const isCancelled = useRef(false);
  const latestCityRef = useRef(cityData);

  useEffect(() => {
    latestCityRef.current = cityData;
  }, [cityData]);

  const applyUpdate = useCallback(
    (updater: (prevCity: CityData) => CityData) => {
      onUpdate(prevCity => {
        const nextCity = updater(prevCity);
        latestCityRef.current = nextCity;
        return nextCity;
      });
    },
    [onUpdate]
  );

  const { name, pincodes, status, centersFound, results, error, population } = cityData;
  const totalPincodes = pincodes.length;
  const progress = totalPincodes > 0 ? (pincodes.filter(p => p.status === 'scanned').length / totalPincodes) * 100 : 0;

  useEffect(() => {
    if (cityData.status !== 'running' || isCancelled.current) {
      return;
    }

    const activeScans = cityData.pincodes.filter(
      p => p.status === 'scanning' || p.status === 'retrying'
    ).length;

    const nextPincode = cityData.pincodes.find(
      p => p.status === 'pending' || p.status === 'error'
    );

    if (!nextPincode) {
      if (activeScans === 0 && cityData.pincodes.every(p => p.status === 'scanned')) {
        applyUpdate(prevCity =>
          prevCity.status === 'completed' ? prevCity : { ...prevCity, status: 'completed' }
        );
      }
      return;
    }

    if (activeScans >= MAX_CONCURRENT_PINCODES) {
      return;
    }

    const processPincode = async (pincodeCode: string) => {
      let success = false;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (isCancelled.current) break;

        applyUpdate(prevCity => ({
          ...prevCity,
          pincodes: prevCity.pincodes.map(p =>
            p.code === pincodeCode
              ? { ...p, status: attempt > 1 ? 'retrying' : 'scanning' }
              : p
          ),
        }));

        try {
          const currentResults = latestCityRef.current?.results ?? [];
          const centers = await findAndAnalyzeCTScans(pincodeCode, currentResults);
          if (isCancelled.current) break;

          applyUpdate(prevCity => ({
            ...prevCity,
            results: [...prevCity.results, ...centers],
            centersFound: prevCity.centersFound + centers.length,
            pincodes: prevCity.pincodes.map(p =>
              p.code === pincodeCode ? { ...p, status: 'scanned' } : p
            ),
            error: undefined,
          }));
          success = true;
          break;
        } catch (err) {
          console.error(`Attempt ${attempt} failed for pincode ${pincodeCode}:`, err);
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }

      if (!success && !isCancelled.current) {
        applyUpdate(prevCity => ({
          ...prevCity,
          pincodes: prevCity.pincodes.map(p =>
            p.code === pincodeCode ? { ...p, status: 'error' } : p
          ),
          error: `Failed on pincode ${pincodeCode}.`,
        }));
      }
    };

    processPincode(nextPincode.code);
  }, [applyUpdate, cityData]);

  const handleDiscover = () => {
    isCancelled.current = false;
    setIsExpanded(true);

    applyUpdate(prevCity => {
      const hasScannedPincodes = prevCity.pincodes.some(p => p.status === 'scanned');

      if (prevCity.status === 'completed' || !hasScannedPincodes) {
        return {
          ...prevCity,
          status: 'running',
          currentPincodeIndex: 0,
          centersFound: 0,
          results: [],
          error: undefined,
          pincodes: prevCity.pincodes.map(p => ({ ...p, status: 'pending' })),
        };
      }

      return {
        ...prevCity,
        status: 'running',
        error: undefined,
      };
    });
  };

  const handleManualRetry = (pincodeCode: string) => {
    applyUpdate(prevCity => ({
      ...prevCity,
      status: 'running',
      pincodes: prevCity.pincodes.map(p =>
        p.code === pincodeCode ? { ...p, status: 'pending' } : p
      ),
      error: undefined,
    }));
  };

  const handleStop = () => {
    isCancelled.current = true;
    applyUpdate(prevCity => ({
      ...prevCity,
      status: 'stopped',
      pincodes: prevCity.pincodes.map(p =>
        p.status === 'scanning' || p.status === 'retrying' ? { ...p, status: 'pending' } : p
      ),
    }));
  };

  const handleDownload = () => {
    if (results.length === 0) return;
    const headers = ['Center Name', 'Address', 'Contact Details', 'Doctor Details', 'Google Maps Link', 'Reasoning'];
    const escapeCsvField = (field: string) => `"${String(field).replace(/"/g, '""')}"`;
    const rows = results.map(center => [
      escapeCsvField(center.centerName),
      escapeCsvField(center.address),
      escapeCsvField(center.contactDetails || ''),
      escapeCsvField(center.doctorDetails?.join('; ') || ''),
      escapeCsvField(center.googleMapsLink),
      escapeCsvField(center.reasoning)
    ].join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `CT_Scan_Results_${name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusInfo = () => {
    const scannedCount = pincodes.filter(p => p.status === 'scanned').length;
    switch (status) {
      case 'idle': return <p className="text-gray-400">Ready to start discovery.</p>;
      case 'running': return <p className="text-cyan-400 animate-pulse">Scanning... ({scannedCount}/{totalPincodes} complete)</p>;
      case 'stopped': return <p className="text-yellow-400">Search stopped. ({scannedCount}/{totalPincodes} complete)</p>;
      case 'completed': return <p className="text-green-400 flex items-center gap-1"><CheckCircleIcon/> Discovery complete.</p>;
      case 'error': return <p className="text-red-500">An error occurred: {error}</p>;
      default: return null;
    }
  };

  const getPincodeColor = (pincodeStatus: PincodeStatus) => {
    switch (pincodeStatus) {
      case 'scanning': return 'bg-yellow-500 text-black animate-pulse';
      case 'retrying': return 'bg-orange-500 text-black animate-pulse';
      case 'scanned': return 'bg-green-600 text-white';
      case 'error': return 'bg-red-600 text-white cursor-pointer hover:bg-red-500';
      default: return 'bg-gray-600 text-gray-300';
    }
  };

  const getButtonText = () => {
    const hasScannedPincodes = pincodes.some(p => p.status === 'scanned');
    if (status === 'completed') return 'Discover Again';
    if (hasScannedPincodes && status !== 'running') return 'Resume';
    return 'Discover Now';
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg p-5 flex flex-col transition-all duration-300">
      <header className="flex justify-between items-start">
          <div>
              <h2 className="text-2xl font-bold text-white">{name}</h2>
              <div className="text-gray-400 text-sm flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <span>{totalPincodes} pincodes</span>
                  {population > 0 && <span>Pop: {population.toLocaleString()}</span>}
              </div>
          </div>
          <div className="flex-shrink-0">
            {status === 'running' ? (
              <button onClick={handleStop} className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                <StopIcon/> Stop
              </button>
            ) : (
              <button id={`discover-btn-${name}`} onClick={handleDiscover} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                {getButtonText()}
              </button>
            )}
          </div>
      </header>
      
      <main className="mt-4">
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
          
          {(status !== 'idle' || isExpanded) && (
            <div className="mt-4 border-t border-gray-700 pt-4">
              <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex justify-between items-center text-left text-lg font-semibold text-gray-200 hover:text-white mb-3">
                <span>{isExpanded ? 'Hide' : 'Show'} Pincodes ({pincodes.length})</span>
                {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </button>
              {isExpanded && (
                <div className="flex flex-wrap gap-2 animate-fade-in">
                  {pincodes.map(p => (
                    <div 
                      key={p.code} 
                      className={`px-2 py-1 rounded-md text-xs font-mono transition-colors duration-500 ${getPincodeColor(p.status)}`}
                      onClick={p.status === 'error' ? () => handleManualRetry(p.code) : undefined}
                      title={p.status === 'error' ? 'Click to retry this pincode' : ''}
                    >
                      {p.code}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {results.length > 0 && (
              <div className="mt-4 border-t border-gray-700 pt-4">
                <div className="flex justify-between items-center">
                  <button onClick={() => setIsResultsVisible(!isResultsVisible)} className="flex-grow flex justify-between items-center text-left text-lg font-semibold text-gray-200 hover:text-white">
                    <span>View {results.length} Found Centers</span>
                    {isResultsVisible ? <ChevronUpIcon /> : <ChevronDownIcon />}
                  </button>
                  <button 
                    onClick={handleDownload}
                    className="ml-4 flex-shrink-0 inline-flex items-center gap-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold py-2 px-3 rounded-lg transition-colors"
                    title="Download Results as CSV"
                  >
                      <DownloadIcon />
                      Download
                  </button>
                </div>
                {isResultsVisible && (
                  <div className="mt-4 space-y-4 max-h-80 overflow-y-auto pr-2 animate-fade-in">
                    {results.map((center, index) => (
                      <div key={`${center.centerName}-${index}`} className="bg-gray-700 p-4 rounded-lg">
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
    </div>
  );
};

export default CityTile;
