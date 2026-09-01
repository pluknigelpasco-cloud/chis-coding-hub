export type UserRole = 'ADMIN' | 'STAFF' | 'VIEWER';
export type ModuleType = 'RTH' | 'DENIED' | 'INPATIENT' | 'HD';
export type DeadlineStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'EXPIRED' | 'COMPLETED' | 'NO_DATE';

export interface AppUser {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  mustChangePassword?: boolean;
  profilePhoto?: string | null;
  lastLogin?: string | null;
  lockedUntil?: string | null;
  failedAttempts?: number;
}

export interface AppSettings {
  CRITICAL_DAYS: number;
  WARNING_DAYS: number;
  RTH_DEADLINE_DAYS: number;
  INPATIENT_DEADLINE_DAYS: number;
  HD_DEADLINE_DAYS: number;
  EXPIRED_QUEUE_DAYS: number;
  SESSION_HOURS: number;
  ALERT_RECIPIENTS: string;
  WEB_APP_URL: string;
  DAILY_ALERT_HOUR: number;
}

export interface BaseRecord {
  id: string;
  module: ModuleType;
  reference: string;
  patientName: string;
  memberCategory?: string;
  admittedDate?: string;
  admissionDate?: string;
  dischargedDate?: string;
  dischargeDate?: string;
  claimAmount?: number;
  totalCharges?: number;
  deficiency?: string;
  claimReceivedDate?: string;
  noticeDate?: string;
  expiryDate?: string;
  baseDate?: string;
  controlNumber?: string;
  retrieved?: boolean;
  completed?: boolean;
  refiledDate?: string;
  transmittedDate?: string;
  transmittedBy?: string;
  ownerUserId?: string;
  remarks?: string;
  daysLeft?: number | null;
  status?: DeadlineStatus;
}

export interface NoticePdfMeta {
  page: number;
  expectedCount: number | null;
  controlNumber: string;
  noticeDate: string;
  deadline: string;
}

export interface NoticePdfRow {
  noticeRowNo: number;
  seriesNumber: string;
  memberCategory: string;
  patientName: string;
  admitted: string;
  discharged: string;
  claimAmount: number;
  totalCharges: number;
  deficiency: string;
  claimReceived: string;
  controlNumber: string;
  noticeDate: string;
  deadline: string;
  page: number;
  duplicate?: boolean;
}

export interface NoticePdfPreviewResult {
  importToken: string;
  type: 'RTH' | 'DENIED';
  filename: string;
  notices: NoticePdfMeta[];
  rows: NoticePdfRow[];
  warnings: string[];
  duplicateCount: number;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  module?: string;
  row_ref?: string;
  source_ref?: string;
  details?: Record<string, any>;
}

export interface DashboardMetrics {
  rthPending: number;
  rthUrgent: number;
  deniedPending: number;
  inpatientPending: number;
  hdPending: number;
  totalUrgent: number;
  urgentRows: BaseRecord[];
}

// ---- CHIS Types ----

export interface CHISRecord {
  code: string;
  description: string;
  case_rate: number;
  hospital_fee: number;
  professional_fee: number;
  type: 'ICD' | 'RVS';
  effectivity_date?: string;
}

export interface Favorite {
  id: string;
  username: string;
  code: string;
  type: 'ICD' | 'RVS';
  description: string;
  case_rate: number;
  hospital_fee: number;
  professional_fee: number;
  effectivity_date?: string;
  created_at: string;
}

export interface SearchHistoryItem {
  id: string;
  keyword: string;
  code?: string;
  type?: 'ICD' | 'RVS';
  description?: string;
  case_rate?: number;
  hospital_fee?: number;
  professional_fee?: number;
  effectivity_date?: string;
  created_at: string;
}

export interface AICodingCandidate {
  code: string;
  description: string;
  caseRate: number;
  hospitalFee: number;
  professionalFee: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  note?: string;
  effectivityDate?: string;
}

export interface AICodingResult {
  success: boolean;
  version: string;
  facilityType: string;
  disclaimer: string;
  statementsReviewed: number;
  conditionsDetected: number;
  combinations: Array<{
    originalStatement: string;
    relation: string;
    sequencingNote: string;
    claimRule: string;
  }>;
  results: Array<{
    diagnosis: string;
    diagnosisType: string;
    status: string;
    candidates: AICodingCandidate[];
    message?: string;
    codingQuestions?: string[];
  }>;
}
