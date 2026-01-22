export enum ReportCategory {
  ABSCONDED = 'Absconded',
  SICK = 'Sick/Hospitalized',
  KIDNAPPED = 'Kidnapped',
  MISSING = 'Missing',
  DECEASED = 'Deceased'
}

export type UserRole = 'ZI' | 'LGI';

export type Division = 'CWHS' | 'CIM' | 'CDR' | 'CDS' | 'SAED' | 'PERSONNEL';

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

export interface PersonnelEntry {
  id: string;
  name: string;
  stateCode: string;
  batch: string;
  lga: string;
  ppa: string;
  gender: string;
  dateAdded: string;
}

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

export interface CIMClearance {
  id: string;
  lga: DauraLga;
  month: string;
  maleCount: number;
  femaleCount: number;
  totalCMs: number;
  clearedCount: number;
  dateAdded: string;
  ziMinute?: string;
  unclearedList: { 
    name: string; 
    code: string; 
    reason: string;
    gender: 'Male' | 'Female';
    ppa?: string;
    ziMinute?: string;
  }[];
}

export interface SAEDCenter {
  id: string;
  centerName: string;
  address: string;
  cmCount: number;
  fee: number;
  lga: DauraLga;
  dateAdded: string;
}

export type CDRStatus = 'Pending' | 'Responded' | 'Forwarded_to_ZI' | 'Minuted_back_to_LGI' | 'Forwarded_to_CDR' | 'Minuted_to_CIM';

export interface CDRCase {
  id: string;
  name: string;
  stateCode: string;
  lga: DauraLga;
  ppa: string;
  misconduct: string;
  status: CDRStatus;
  dateOfInfraction: string;
  lgiMinute?: string;
  ziMinute?: string;
  responseImage?: string;
  responseContent?: string;
  dateAdded: string;
  evidenceDocuments?: string[];
}

export interface CDSGroup {
  id: string;
  groupName: string;
  meetingDay: string;
  lga: DauraLga;
  dateAdded: string;
}

export interface CDSPersonalProject {
  id: string;
  cmName: string;
  stateCode: string;
  projectName: string;
  projectType: string;
  location: string;
  description: string;
  status: 'Ongoing' | 'Completed';
  lga: DauraLga;
  dateAdded: string;
}

export interface AppSettings {
  id: string;
  googleFormUrl: string;
  lastUpdatedBy: string;
}