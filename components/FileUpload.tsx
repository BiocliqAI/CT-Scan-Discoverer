import React, { useState, useCallback } from 'react';
import { CityData } from '../types';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onFileProcessed: (data: CityData[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileProcessed }) => {
  const [error, setError] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  const processFile = async (file: File) => {
    setError(null);
    setIsDisabled(true);

    try {
      const text = await file.text();
      const citiesData = parseCSV(text);
      if (citiesData.length === 0) {
        // The error is set inside parseCSV if headers are wrong
        if (!error) {
            setError("No valid city data found in the file.");
        }
        return;
      }
      
      citiesData.sort((a, b) => b.population - a.population);
      onFileProcessed(citiesData);

    } catch (err) {
      setError('Failed to parse file. Please check the format.');
      console.error(err);
    } finally {
        setIsDisabled(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFile(file);
    event.target.value = ''; // Reset file input
  };

  const parseCSV = (csvText: string): CityData[] => {
    const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) return []; // Must have header and at least one data row

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    const pincodeIndex = header.indexOf('pincode');
    const districtIndex = header.indexOf('district');
    const populationIndex = header.indexOf('population');
    const stateIndex = header.indexOf('statename');

    if (pincodeIndex === -1 || districtIndex === -1 || populationIndex === -1 || stateIndex === -1) {
      console.error("CSV header is missing one of 'pincode', 'district', 'statename', 'population'");
      setError("Could not parse file. Required columns: 'Pincode', 'District', 'StateName', 'Population'.");
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
            citiesData.push({
                name,
                stateName: data.stateName,
                population: data.population,
                pincodes: Array.from(data.pincodes).map(p => ({ code: p, status: 'pending' })),
                status: 'idle',
                results: [],
                currentPincodeIndex: 0,
                centersFound: 0,
            });
        }
    }
    return citiesData;
  };

  const onDragOver = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
  }, []);

  const onDrop = useCallback((event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (isDisabled) return;
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  }, [isDisabled]);

  return (
    <div className="max-w-xl mx-auto">
        <label
          onDragOver={onDragOver}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center w-full h-64 border-2 border-gray-600 border-dashed rounded-lg bg-gray-800 transition-colors ${isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-gray-700'}`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <UploadIcon />
            <p className="mb-2 text-sm text-gray-400"><span className="font-semibold text-cyan-400">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-gray-500">CSV with columns: Pincode, District, StateName, Population</p>
          </div>
          <input id="dropzone-file" type="file" className="hidden" accept=".csv" onChange={handleFileChange} disabled={isDisabled} />
        </label>
      {error && <p className="mt-2 text-sm text-red-500 text-center">{error}</p>}
    </div>
  );
};

export default FileUpload;