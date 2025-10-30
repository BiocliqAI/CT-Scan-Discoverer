import React, { useState, useEffect } from 'react';

interface StorageInfoProps {
  data: object;
}

const STORAGE_QUOTA_KB = 5120; // 5 MB quota

const StorageInfo: React.FC<StorageInfoProps> = ({ data }) => {
  const [usedKB, setUsedKB] = useState(0);

  useEffect(() => {
    const calculateSize = () => {
      try {
        const jsonString = JSON.stringify(data);
        // Rough estimate: each character is approx 1 byte. For UTF-16, it can be 2 bytes.
        // This provides a good-enough estimate for user feedback.
        const sizeInBytes = new Blob([jsonString]).size;
        const sizeInKB = parseFloat((sizeInBytes / 1024).toFixed(2));
        setUsedKB(sizeInKB);
      } catch (error) {
        console.error("Could not calculate storage size:", error);
        setUsedKB(0);
      }
    };

    calculateSize();
  }, [data]);

  const remainingKB = Math.max(0, STORAGE_QUOTA_KB - usedKB);
  const usedPercentage = (usedKB / STORAGE_QUOTA_KB) * 100;

  return (
    <div className="absolute top-4 right-4 bg-gray-800 p-3 rounded-lg shadow-lg text-xs text-gray-300 border border-gray-700">
      <h3 className="font-bold text-cyan-400 mb-2 text-sm">Browser Storage</h3>
      <div className="space-y-1">
        <p>
          <span className="font-semibold">Used:</span> {usedKB} KB
        </p>
        <p>
          <span className="font-semibold">Available:</span> {remainingKB.toFixed(2)} KB
        </p>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
        <div 
          className="bg-cyan-600 h-2 rounded-full" 
          style={{ width: `${usedPercentage}%` }}
          title={`${usedPercentage.toFixed(2)}% used`}
        ></div>
      </div>
    </div>
  );
};

export default StorageInfo;
