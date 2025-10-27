import React, { useState } from 'react';
import { CityData } from '../types';
import CityTile from './CityTile';
import { ChevronDownIcon, ChevronUpIcon } from './Icons';

interface StateGroupProps {
  stateName: string;
  cities: CityData[];
}

const StateGroup: React.FC<StateGroupProps> = ({ stateName, cities }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-gray-800/50 rounded-lg mb-6 border border-gray-700">
      <header 
        className="p-4 cursor-pointer flex justify-between items-center"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-2xl font-bold text-cyan-300">{stateName}</h2>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">{cities.length} {cities.length === 1 ? 'City' : 'Cities'}</span>
          <button className="p-1 text-gray-400 hover:text-white">
            {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
        </div>
      </header>
      {isExpanded && (
        <div className="p-4 border-t border-gray-700 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cities.map((city) => (
              <CityTile key={city.name} initialCityData={city} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StateGroup;
