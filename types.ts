
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

export interface BaseMember {
  id: string;
  name: string;
  stateCode: string;
  dateAdded: string;
  lga: DauraLga;
}

export interface AbscondedMember extends BaseMember {
  category: ReportCategory.ABSCONDED;
  period: string;
}

export interface SickMember extends BaseMember {
  category: ReportCategory.SICK;
  illness: string;
  hospitalized: boolean;
}

export interface KidnappedMember extends BaseMember {
  category: ReportCategory.KIDNAPPED;
  dateKidnapped: string;
}

export interface MissingMember extends BaseMember {
  category: ReportCategory.MISSING;
  dateMissing: string;
}

export interface DeceasedMember extends BaseMember {
  category: ReportCategory.DECEASED;
  dateOfDeath: string;
  reason: string;
}

export type CorpsMemberEntry = 
  | AbscondedMember 
  | SickMember 
  | KidnappedMember 
  | MissingMember 
  | DeceasedMember;

export interface WeeklyReportState {
  entries: CorpsMemberEntry[];
  secretariatName: string;
  reportDate: string;
}
