
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

export interface CIMBatchDisposition {
  batch: string;
  males: number;
  females: number;
}

export interface StationDisposition {
  id: string;
  lga: DauraLga;
  totalMales: number;
  totalFemales: number;
  lastUpdated: string;
  batches: CIMBatchDisposition[];
}

export interface CIMDefaulterLog {
  action: string;
  timestamp: string;
  role: string;
}

export interface CIMClearance {
  id: string;
  lga: DauraLga;
  month: string;
  maleCount: number;
  femaleCount: number;
  totalCMs: number;
  clearedCount: number;
  unclearedList: { 
    name: string; 
    code: string; 
    reason: string;
    ppa?: string;
    logs?: CIMDefaulterLog[];
  }[];
  batchClearance: CIMBatchDisposition[];
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

export interface CDSGroup {
  id: string;
  lga: DauraLga;
  groupName: string;
  meetingDay: string;
  dateAdded: string;
}

export interface CDSPersonalProject {
  id: string;
  lga: DauraLga;
  cmName: string;
  stateCode: string;
  projectName: string;
  description: string;
  status: 'Ongoing' | 'Completed';
  dateAdded: string;
}

export type CDRStatus = 'Pending' | 'Responded' | 'Forwarded_to_ZI' | 'Minuted_to_CIM' | 'Forwarded_to_CDR';

export interface CDRCase {
  id: string;
  name: string;
  stateCode: string;
  lga: DauraLga;
  ppa: string;
  misconduct: string;
  dateOfInfraction: string;
  dateAdded: string;
  status?: CDRStatus;
  responseContent?: string;
  lgiMinute?: string;
  ziMinute?: string;
  responseImage?: string; // Base64 string
  evidenceDocuments?: string[]; // Array of Base64 strings
  month?: string; // Month for query context
}

export type Division = 'CWHS' | 'CIM' | 'CDR' | 'CDS' | 'SAED';
