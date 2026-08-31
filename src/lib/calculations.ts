import { DeadlineStatus, AppSettings, BaseRecord } from './types';

export const DEFAULT_SETTINGS: AppSettings = {
  CRITICAL_DAYS: 7,
  WARNING_DAYS: 15,
  RTH_DEADLINE_DAYS: 60,
  INPATIENT_DEADLINE_DAYS: 60,
  HD_DEADLINE_DAYS: 60,
  EXPIRED_QUEUE_DAYS: 30,
  SESSION_HOURS: 24,
  ALERT_RECIPIENTS: '',
  WEB_APP_URL: '',
  DAILY_ALERT_HOUR: 7,
};

export function startOfDay(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(d) : new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
}

export function parseDate(val?: string | Date | null): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : startOfDay(val);
  const s = String(val).trim();
  
  // Format MM/dd/yyyy
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m1) return new Date(Number(m1[3]), Number(m1[1]) - 1, Number(m1[2]));

  // Format yyyy-MM-dd
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : startOfDay(parsed);
}

export function formatDate(d?: Date | string | null): string {
  const date = parseDate(d);
  if (!date) return '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function formatDateIso(d?: Date | string | null): string {
  const date = parseDate(d);
  if (!date) return '';
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

export function addDays(d: Date | string, days: number): Date {
  const date = parseDate(d) || new Date();
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

export function calendarDaysDiff(a: Date | string, b: Date | string): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

export function computeDeadlineStatus(
  daysLeft: number | null | undefined,
  completed: boolean,
  settings: Partial<AppSettings> = DEFAULT_SETTINGS
): DeadlineStatus {
  if (completed) return 'COMPLETED';
  if (daysLeft === null || daysLeft === undefined || isNaN(daysLeft)) return 'NO_DATE';
  if (daysLeft < 0) return 'EXPIRED';
  const crit = Number(settings.CRITICAL_DAYS ?? DEFAULT_SETTINGS.CRITICAL_DAYS);
  const warn = Number(settings.WARNING_DAYS ?? DEFAULT_SETTINGS.WARNING_DAYS);
  if (daysLeft <= crit) return 'CRITICAL';
  if (daysLeft <= warn) return 'WARNING';
  return 'SAFE';
}

export function formatCurrency(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00';
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function isDateInRange(recordDate?: string | null, from?: string | null, to?: string | null): boolean {
  if (!from && !to) return true;
  const d = parseDate(recordDate);
  if (!d) return false;
  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  if (fromDate && d < fromDate) return false;
  if (toDate && d > toDate) return false;
  return true;
}
