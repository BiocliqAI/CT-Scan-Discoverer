export interface ScanCenter {
  centerName: string;
  address: string;
  contactDetails: string;
  doctorDetails: string[];
  googleMapsLink: string;
  reasoning: string;
}

export type PincodeStatus = 'pending' | 'scanning' | 'scanned' | 'error' | 'retrying';

export interface Pincode {
  code: string;
  status: PincodeStatus;
}

export type CityDiscoveryStatus = 'idle' | 'running' | 'stopped' | 'completed' | 'error';

export interface CityData {
  name: string;
  stateName: string;
  pincodes: Pincode[];
  status: CityDiscoveryStatus;
  results: ScanCenter[];
  currentPincodeIndex: number;
  centersFound: number;
  population: number;
  error?: string;
}
