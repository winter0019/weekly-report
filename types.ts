export enum ReportCategory {
  ABSCONDED = 'Absconded',
  SICK = 'Sick/Hospitalized',
  KIDNAPPED = 'Kidnapped',
  MISSING = 'Missing',
  DECEASED = 'Deceased'
}

export type UserRole = 'ZI' | 'LGI';

export type DauraLga = 
  | 'Daura' 
  | 'Baure' 
  | 'Zango' 
  | 'Sandamu' 
  | 'Mai’Adua' 
  | 'Mashi' 
  | 'Dutsi' 
  | 'Mani' 
  | 'Bindawa';

export interface CorpsMemberEntry {
  id: string;
  name: string;
  stateCode: string;
  dateAdded: string;
  lga: DauraLga;
  category: ReportCategory;
  details?: string;
  dateOfDeath?: string;
}

export interface CIMClearance {
  id: string;
  lga: DauraLga;
  month: string;
  maleCount: number;
  femaleCount: number;
  totalCMs: number;
  clearedCount: number;
  unclearedList: { name: string; code: string; reason: string }[];
  dateAdded: string;
}

export interface SAEDCenter {
  id: string;
  lga: DauraLga;
  centerName: string;
  address: string;
  cmCount: number;
  fee: number;
  dateAdded: string;
}

export type Division = 'CWHS' | 'CIM' | 'SAED';
