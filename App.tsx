import React, { useState, useEffect, useRef } from 'react';
import { CityData } from './types';
import { GithubIcon } from './components/Icons';
import StateGroup from './components/StateGroup';
import StorageInfo from './components/StorageInfo';

const STORAGE_KEY = 'ctScanDiscovererData';

// Helper function to parse CSV text
const parseCSV = (csvText: string): CityData[] => {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map(h => h.trim().toLowerCase());
  const pincodeIndex = header.indexOf('pincode');
  const districtIndex = header.indexOf('district');
  const populationIndex = header.indexOf('population');
  const stateIndex = header.indexOf('statename');

  if (pincodeIndex === -1 || districtIndex === -1 || populationIndex === -1 || stateIndex === -1) {
    console.error("CSV header is missing one of 'pincode', 'district', 'statename', 'population'");
    return [];
  }

  const cityMap = new Map<string, { population: number; pincodes: Set<string>; stateName: string }>();

  for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map(item => item.trim());
      if (parts.length <= Math.max(pincodeIndex, districtIndex, populationIndex, stateIndex)) continue;

      const pincode = parts[pincodeIndex];
      const district = parts[districtIndex];
      const populationStr = parts[populationIndex];
      const stateName = parts[stateIndex];

      if (!pincode || !district || !populationStr || !stateName) continue;

      const population = parseInt(populationStr.replace(/,/g, ''), 10);
      if (isNaN(population)) continue;

      if (!cityMap.has(district)) {
          cityMap.set(district, { population, pincodes: new Set(), stateName });
      }
      
      const cityInfo = cityMap.get(district)!;
      cityInfo.pincodes.add(pincode);
  }
  
  const citiesData: CityData[] = [];
  for (const [name, data] of cityMap.entries()) {
      if (data.pincodes.size > 0) {
          const pincodesArray = Array.from(data.pincodes).sort();
          citiesData.push({
              name,
              stateName: data.stateName,
              population: data.population,
              pincodes: pincodesArray.map(p => ({ code: p, status: 'pending' })),
              status: 'idle',
              results: [],
              currentPincodeIndex: 0,
              centersFound: 0,
          });
      }
  }
  
  // Sort by StateName, then by District name
  citiesData.sort((a, b) => {
    if (a.stateName < b.stateName) return -1;
    if (a.stateName > b.stateName) return 1;
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  });

  return citiesData;
};


const App: React.FC = () => {
  const [groupedCities, setGroupedCities] = useState<Record<string, CityData[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Check localStorage first
        const storedData = localStorage.getItem(STORAGE_KEY);
        if (storedData) {
          setGroupedCities(JSON.parse(storedData));
          setIsLoading(false);
          return;
        }

        // If no stored data, fetch from CSV
        const response = await fetch('/Selected_centers.csv');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const csvText = await response.text();
        const citiesData = parseCSV(csvText);
        
        const grouped = citiesData.reduce((acc, city) => {
          const { stateName } = city;
          if (!acc[stateName]) {
            acc[stateName] = [];
          }
          acc[stateName].push(city);
          return acc;
        }, {} as Record<string, CityData[]>);

        setGroupedCities(grouped);
      } catch (error) {
        console.error("Failed to load or parse city data", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (isLoading) {
      return; // Don't save to storage while the initial data is loading
    }
    try {
      if (Object.keys(groupedCities).length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(groupedCities));
      } else {
        // This is used by the "Reset" button to clear storage
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to save data to localStorage", error);
    }
  }, [groupedCities, isLoading]);

  const handleUpdateCity = (stateName: string, cityName: string, updater: (city: CityData) => CityData) => {
    setGroupedCities(prevGroupedCities => {
      const citiesInState = prevGroupedCities[stateName];
      if (!citiesInState) return prevGroupedCities;

      const cityIndex = citiesInState.findIndex(c => c.name === cityName);
      if (cityIndex === -1) return prevGroupedCities;

      const updatedCity = updater(citiesInState[cityIndex]);
      const updatedCitiesInState = [...citiesInState];
      updatedCitiesInState[cityIndex] = updatedCity;

      return {
        ...prevGroupedCities,
        [stateName]: updatedCitiesInState,
      };
    });
  };
  
  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsLoading(true); // Trigger reload from CSV
    // This will cause the useEffect to re-run and fetch the CSV
    setGroupedCities({}); 
  };

  const mergeAdditionalCities = (existingGrouped: Record<string, CityData[]>, newCities: CityData[]) => {
    if (newCities.length === 0) {
      return existingGrouped;
    }

    const clonedGrouped: Record<string, CityData[]> = {};
    for (const [stateName, cities] of Object.entries(existingGrouped)) {
      clonedGrouped[stateName] = cities.map(city => ({
        ...city,
        pincodes: city.pincodes.map(p => ({ ...p })),
      }));
    }

    for (const additionalCity of newCities) {
      const stateName = additionalCity.stateName;
      const clonedAdditionalCity: CityData = {
        ...additionalCity,
        pincodes: additionalCity.pincodes.map(p => ({ ...p })),
      };

      if (!clonedGrouped[stateName]) {
        clonedGrouped[stateName] = [clonedAdditionalCity];
        continue;
      }

      const citiesInState = clonedGrouped[stateName];
      const cityIndex = citiesInState.findIndex(city => city.name === clonedAdditionalCity.name);

      if (cityIndex === -1) {
        clonedGrouped[stateName] = [...citiesInState, clonedAdditionalCity];
        continue;
      }

      const existingCity = citiesInState[cityIndex];
      const existingPincodes = new Set(existingCity.pincodes.map(p => p.code));
      const mergedPincodes = [...existingCity.pincodes];
      let addedNewPincode = false;

      for (const newPincode of clonedAdditionalCity.pincodes) {
        if (!existingPincodes.has(newPincode.code)) {
          mergedPincodes.push({ ...newPincode, status: 'pending' });
          addedNewPincode = true;
        }
      }

      if (addedNewPincode || clonedAdditionalCity.population > existingCity.population) {
        const updatedCity: CityData = {
          ...existingCity,
          population: Math.max(existingCity.population, clonedAdditionalCity.population),
          pincodes: mergedPincodes,
        };

        const updatedCities = [...citiesInState];
        updatedCities[cityIndex] = updatedCity;
        clonedGrouped[stateName] = updatedCities;
      }
    }

    const sortedStateNames = Object.keys(clonedGrouped).sort();
    const result: Record<string, CityData[]> = {};

    for (const stateName of sortedStateNames) {
      result[stateName] = clonedGrouped[stateName]
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  };

  const handleAdditionalDataUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const fileText = await file.text();
      const additionalCities = parseCSV(fileText);

      if (additionalCities.length === 0) {
        console.warn('No valid city data found in uploaded file.');
        return;
      }

      setGroupedCities(prevGrouped => mergeAdditionalCities(prevGrouped, additionalCities));
    } catch (error) {
      console.error('Failed to process the uploaded data file', error);
    } finally {
      input.value = '';
    }
  };

  const handleAddDataClick = () => {
    fileInputRef.current?.click();
  };

  const hasData = Object.keys(groupedCities).length > 0;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <StorageInfo data={groupedCities} />
      <div className="container mx-auto p-4 md:p-8">
        <header className="text-center mb-8 border-b border-gray-700 pb-4">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-400 tracking-tight">
            CT Scan Discoverer
          </h1>
          <p className="text-gray-400 mt-2 max-w-2xl mx-auto">
            Districts and pincodes are loaded from the local CSV. Click "Discover Now" on any district to begin.
          </p>
        </header>

        <main>
          {isLoading ? (
            <div className="text-center">
              <p className="text-lg text-cyan-400">Loading city data...</p>
            </div>
          ) : hasData ? (
            <div>
              <div className="space-y-6 animate-fade-in">
                {Object.keys(groupedCities).sort().map((stateName) => (
                  <StateGroup 
                    key={stateName} 
                    stateName={stateName} 
                    cities={groupedCities[stateName]} 
                    onUpdateCity={(cityName, updater) => handleUpdateCity(stateName, cityName, updater)}
                  />
                ))}
              </div>
               <div className="text-center mt-8">
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <button
                      onClick={handleAddDataClick}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
                  >
                      Add Additional Data
                  </button>
                  <button
                      onClick={handleReset}
                      className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
                  >
                      Reset & Reload Data
                  </button>
                  <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleAdditionalDataUpload}
                  />
                </div>
              </div>
            </div>
          ) : (
             <div className="text-center">
                <p className="text-lg text-red-500">No city data found. Please ensure 'Selected_centers.csv' is in the public directory and formatted correctly.</p>
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
