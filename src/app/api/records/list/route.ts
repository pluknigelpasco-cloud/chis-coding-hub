import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { verifyToken, getTokenFromRequest } from '@/lib/auth';
import { ModuleType, BaseRecord, MonitoringClaimStatus, MonitoringStats } from '@/lib/types';
import {
  formatDate,
  calendarDaysDiff,
  computeDeadlineStatus,
  isDateInRange,
  DEFAULT_SETTINGS
} from '@/lib/calculations';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Unauthorized session' }, { status: 401 });
    }

    const body = await req.json();
    const module = (body.module || 'RTH') as ModuleType;
    const search = String(body.search || '').trim().toLowerCase();
    const status = String(body.status || 'ALL').toUpperCase();
    const noticeTypeFilter = String(body.noticeType || 'ALL').toUpperCase();
    const monitoringStatusFilter = String(body.monitoringStatus || 'ALL').toUpperCase();
    const offset = Math.max(0, Number(body.offset) || 0);
    const limit = Math.min(500, Math.max(10, Number(body.limit) || 250));
    const sortKey = String(body.sortKey || (module === 'MONITORING' ? 'dateOfRefileReappeal' : 'daysLeft'));
    const sortDir = String(body.sortDir || 'asc').toLowerCase();

    const supabase = getSupabaseAdmin();

    // Fetch settings
    const { data: settingsRows } = await supabase.from('app_settings').select('*');
    const settings = { ...DEFAULT_SETTINGS };
    let statusMap: Record<string, MonitoringClaimStatus> = {};

    if (settingsRows) {
      settingsRows.forEach(r => {
        if (r.key === 'MONITORING_STATUS_MAP') {
          try {
            statusMap = typeof r.value === 'string' ? JSON.parse(r.value) : (r.value || {});
          } catch (e) {
            statusMap = {};
          }
        } else {
          (settings as any)[r.key] = isNaN(Number(r.value)) ? r.value : Number(r.value);
        }
      });
    }

    const today = new Date();
    let records: BaseRecord[] = [];

    if (module === 'RTH') {
      const { data } = await supabase.from('rth_notices').select('*').order('created_at', { ascending: false });
      records = (data || []).map(r => {
        const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
        const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
        const s = computeDeadlineStatus(daysLeft, r.refiled, settings);
        const admitted = formatDate(r.admitted_date);
        const discharged = formatDate(r.discharged_date);
        const refileDate = formatDate(r.refiled_date);
        // dateOfRefileReappeal must be YYYY-MM-DD so <input type="date"> can read it
        const refileDateIso: string = r.refiled_date ? String(r.refiled_date).substring(0, 10) : '';
        const monStatus: MonitoringClaimStatus = statusMap[r.id] || (r.refiled ? 'IN PROCESS' : 'RTH');

        return {
          id: r.id,
          module: 'RTH',
          noticeType: 'RTH',
          reference: r.series_number,
          patientName: r.patient_name,
          memberCategory: r.member_category,
          admittedDate: admitted,
          admissionDate: admitted,
          dischargedDate: discharged,
          dischargeDate: discharged,
          claimAmount: Number(r.claim_amount || 0),
          totalCharges: Number(r.total_charges || 0),
          deficiency: r.deficiency,
          claimReceivedDate: formatDate(r.claim_received_date),
          noticeDate: formatDate(r.notice_date),
          expiryDate: formatDate(r.expiry_date),
          baseDate: formatDate(r.notice_date || r.claim_received_date),
          controlNumber: r.control_number,
          retrieved: r.retrieved,
          completed: r.refiled,
          refiledDate: refileDate,
          dateOfRefileReappeal: refileDateIso,
          monitoringStatus: monStatus,
          transmittedDate: refileDate,
          transmittedBy: r.transmitted_by,
          ownerUserId: r.owner_user_id,
          remarks: r.remarks && !r.remarks.startsWith('Historical Import') ? r.remarks : '',
          daysLeft,
          status: s,
        };
      });
    } else if (module === 'DENIED') {
      const { data } = await supabase.from('denied_notices').select('*').order('created_at', { ascending: false });
      records = (data || []).map(r => {
        const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
        const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
        const s = computeDeadlineStatus(daysLeft, r.retrieved, settings);
        const admitted = formatDate(r.admitted_date);
        const discharged = formatDate(r.discharged_date);
        const refileDate = formatDate(r.refiled_date);
        // dateOfRefileReappeal must be YYYY-MM-DD so <input type="date"> can read it
        const refileDateIso: string = r.refiled_date ? String(r.refiled_date).substring(0, 10) : '';
        const monStatus: MonitoringClaimStatus = statusMap[r.id] || (r.retrieved ? 'IN PROCESS' : 'DENIED');

        return {
          id: r.id,
          module: 'DENIED',
          noticeType: 'DENIED',
          reference: r.series_number,
          patientName: r.patient_name,
          memberCategory: r.member_category,
          admittedDate: admitted,
          admissionDate: admitted,
          dischargedDate: discharged,
          dischargeDate: discharged,
          claimAmount: Number(r.claim_amount || 0),
          totalCharges: Number(r.total_charges || 0),
          deficiency: r.deficiency,
          claimReceivedDate: formatDate(r.claim_received_date),
          noticeDate: formatDate(r.notice_date),
          expiryDate: formatDate(r.expiry_date),
          baseDate: formatDate(r.claim_received_date || r.notice_date),
          controlNumber: r.control_number,
          retrieved: r.retrieved,
          completed: r.retrieved,
          refiledDate: refileDate,
          dateOfRefileReappeal: refileDateIso,
          monitoringStatus: monStatus,
          transmittedDate: refileDate,
          transmittedBy: r.transmitted_by,
          ownerUserId: r.owner_user_id,
          remarks: r.remarks && !r.remarks.startsWith('Historical Import') ? r.remarks : '',
          daysLeft,
          status: s,
        };
      });
    } else if (module === 'MONITORING') {
      // Fetch both RTH and DENIED notices
      const [rthRes, deniedRes] = await Promise.all([
        supabase.from('rth_notices').select('*').order('created_at', { ascending: false }),
        supabase.from('denied_notices').select('*').order('created_at', { ascending: false }),
      ]);

      const rthRecords: BaseRecord[] = (rthRes.data || []).map(r => {
        const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
        const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
        const s = computeDeadlineStatus(daysLeft, r.refiled, settings);
        const admitted = formatDate(r.admitted_date);
        const discharged = formatDate(r.discharged_date);
        const refileDate = formatDate(r.refiled_date);
        // dateOfRefileReappeal must be YYYY-MM-DD so <input type="date"> can read it
        const refileDateIso: string = r.refiled_date ? String(r.refiled_date).substring(0, 10) : '';
        const monStatus: MonitoringClaimStatus = statusMap[r.id] || (r.refiled ? 'IN PROCESS' : 'RTH');

        return {
          id: r.id,
          module: 'MONITORING',
          noticeType: 'RTH',
          reference: r.series_number,
          patientName: r.patient_name,
          memberCategory: r.member_category,
          admittedDate: admitted,
          admissionDate: admitted,
          dischargedDate: discharged,
          dischargeDate: discharged,
          claimAmount: Number(r.claim_amount || 0),
          totalCharges: Number(r.total_charges || 0),
          deficiency: r.deficiency,
          claimReceivedDate: formatDate(r.claim_received_date),
          noticeDate: formatDate(r.notice_date),
          expiryDate: formatDate(r.expiry_date),
          baseDate: formatDate(r.notice_date || r.claim_received_date),
          controlNumber: r.control_number,
          retrieved: r.retrieved,
          completed: r.refiled,
          refiledDate: refileDate,
          dateOfRefileReappeal: refileDateIso,
          monitoringStatus: monStatus,
          transmittedDate: refileDate,
          transmittedBy: r.transmitted_by,
          ownerUserId: r.owner_user_id,
          remarks: r.remarks && !r.remarks.startsWith('Historical Import') ? r.remarks : '',
          daysLeft,
          status: s,
        };
      });

      const deniedRecords: BaseRecord[] = (deniedRes.data || []).map(r => {
        const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
        const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
        const s = computeDeadlineStatus(daysLeft, r.retrieved, settings);
        const admitted = formatDate(r.admitted_date);
        const discharged = formatDate(r.discharged_date);
        const refileDate = formatDate(r.refiled_date);
        // dateOfRefileReappeal must be YYYY-MM-DD so <input type="date"> can read it
        const refileDateIso: string = r.refiled_date ? String(r.refiled_date).substring(0, 10) : '';
        const monStatus: MonitoringClaimStatus = statusMap[r.id] || (r.retrieved ? 'IN PROCESS' : 'DENIED');

        return {
          id: r.id,
          module: 'MONITORING',
          noticeType: 'DENIED',
          reference: r.series_number,
          patientName: r.patient_name,
          memberCategory: r.member_category,
          admittedDate: admitted,
          admissionDate: admitted,
          dischargedDate: discharged,
          dischargeDate: discharged,
          claimAmount: Number(r.claim_amount || 0),
          totalCharges: Number(r.total_charges || 0),
          deficiency: r.deficiency,
          claimReceivedDate: formatDate(r.claim_received_date),
          noticeDate: formatDate(r.notice_date),
          expiryDate: formatDate(r.expiry_date),
          baseDate: formatDate(r.claim_received_date || r.notice_date),
          controlNumber: r.control_number,
          retrieved: r.retrieved,
          completed: r.retrieved,
          refiledDate: refileDate,
          dateOfRefileReappeal: refileDateIso,
          monitoringStatus: monStatus,
          transmittedDate: refileDate,
          transmittedBy: r.transmitted_by,
          ownerUserId: r.owner_user_id,
          remarks: r.remarks && !r.remarks.startsWith('Historical Import') ? r.remarks : '',
          daysLeft,
          status: s,
        };
      });

      records = [...rthRecords, ...deniedRecords];
    } else if (module === 'INPATIENT') {
      const { data } = await supabase.from('inpatient_trackers').select('*').order('discharge_date', { ascending: false });
      records = (data || []).map(r => {
        const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
        const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
        const s = computeDeadlineStatus(daysLeft, r.completed, settings);
        const catList = r.categories && r.categories.length ? r.categories.join(', ') : 'Inpatient';
        const dDate = formatDate(r.discharge_date);
        return {
          id: r.id,
          module: 'INPATIENT',
          reference: dDate,
          patientName: '',
          memberCategory: catList,
          deficiency: catList,
          baseDate: dDate,
          dischargeDate: dDate,
          dischargedDate: dDate,
          expiryDate: formatDate(r.expiry_date),
          completed: r.completed,
          transmittedDate: formatDate(r.transmitted_date),
          remarks: r.remarks,
          daysLeft,
          status: s,
        };
      });
    } else if (module === 'HD') {
      const { data } = await supabase.from('hd_trackers').select('*').order('encounter_date', { ascending: false });
      records = (data || []).map(r => {
        const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
        const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
        const s = computeDeadlineStatus(daysLeft, r.completed, settings);
        const encDate = formatDate(r.encounter_date);
        return {
          id: r.id,
          module: 'HD',
          reference: encDate,
          patientName: '',
          memberCategory: r.is_hdu ? 'HDU' : 'Hemodialysis',
          deficiency: r.is_hdu ? 'HDU' : 'Hemodialysis',
          baseDate: encDate,
          admittedDate: encDate,
          admissionDate: encDate,
          expiryDate: formatDate(r.expiry_date),
          completed: r.completed,
          transmittedDate: formatDate(r.transmitted_date),
          remarks: r.remarks,
          daysLeft,
          status: s,
        };
      });
    }

    // Role-based filtering for staff on notice/monitoring modules
    if (payload.role === 'STAFF' && (module === 'RTH' || module === 'DENIED' || module === 'MONITORING')) {
      records = records.filter(r => {
        if (!r.ownerUserId && !r.transmittedBy) return true;
        return r.ownerUserId === payload.u || r.transmittedBy?.toLowerCase().includes(payload.name.toLowerCase());
      });
    }

    // Notice Type filter (for MONITORING)
    if (module === 'MONITORING' && noticeTypeFilter !== 'ALL') {
      records = records.filter(r => r.noticeType === noticeTypeFilter);
    }

    // Compute monitoringStats on the records before status filtering so KPI counts are always accurate
    let monitoringStats: MonitoringStats | undefined = undefined;
    if (module === 'MONITORING') {
      monitoringStats = {
        total: records.length,
        totalAmount: records.reduce((acc, r) => acc + (r.claimAmount || 0), 0),
        inProcess: records.filter(r => r.monitoringStatus === 'IN PROCESS').length,
        inProcessAmount: records.filter(r => r.monitoringStatus === 'IN PROCESS').reduce((acc, r) => acc + (r.claimAmount || 0), 0),
        rth: records.filter(r => r.monitoringStatus === 'RTH').length,
        rthAmount: records.filter(r => r.monitoringStatus === 'RTH').reduce((acc, r) => acc + (r.claimAmount || 0), 0),
        denied: records.filter(r => r.monitoringStatus === 'DENIED').length,
        deniedAmount: records.filter(r => r.monitoringStatus === 'DENIED').reduce((acc, r) => acc + (r.claimAmount || 0), 0),
        withCheque: records.filter(r => r.monitoringStatus === 'WITH CHEQUE').length,
        withChequeAmount: records.filter(r => r.monitoringStatus === 'WITH CHEQUE').reduce((acc, r) => acc + (r.claimAmount || 0), 0),
      };
    }

    // Monitoring Status filter (for MONITORING module or general status filter)
    if (module === 'MONITORING' && monitoringStatusFilter !== 'ALL') {
      records = records.filter(r => r.monitoringStatus === monitoringStatusFilter);
    }

    // Search filter
    if (search) {
      records = records.filter(r => {
        const haystack = [
          r.reference,
          r.patientName,
          r.memberCategory,
          r.deficiency,
          r.remarks,
          r.transmittedBy,
          r.admittedDate,
          r.dischargedDate,
          r.transmittedDate,
          r.baseDate,
          r.expiryDate,
          r.controlNumber,
          r.noticeType,
          r.monitoringStatus,
          r.dateOfRefileReappeal
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(search);
      });
    }

    // Date range filters
    records = records.filter(r => {
      const matchAdm = isDateInRange(r.admittedDate || r.admissionDate, body.admissionFrom, body.admissionTo);
      const matchDis = isDateInRange(r.dischargedDate || r.dischargeDate, body.dischargeFrom, body.dischargeTo);
      const matchTrn = isDateInRange(r.transmittedDate, body.transmittedFrom, body.transmittedTo);
      const matchExp = isDateInRange(r.expiryDate, body.expiryFrom, body.expiryTo);
      const matchRef = isDateInRange(r.dateOfRefileReappeal, body.refileFrom, body.refileTo);
      return matchAdm && matchDis && matchTrn && matchExp && matchRef;
    });

    // Deadline Status filter (for RTH/DENIED/INPATIENT/HD)
    if (status !== 'ALL') {
      records = records.filter(r => {
        if (status === 'PENDING') return r.status !== 'COMPLETED';
        return r.status === status;
      });
    }

    // Sorting
    const dir = sortDir === 'desc' ? -1 : 1;
    records.sort((a, b) => {
      let av: any = (a as any)[sortKey];
      let bv: any = (b as any)[sortKey];

      if (sortKey === 'daysLeft') {
        av = a.daysLeft ?? 99999;
        bv = b.daysLeft ?? 99999;
      }

      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;

      if (typeof av === 'number' && typeof bv === 'number') {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });

    const total = records.length;
    const paginated = records.slice(offset, offset + limit);

    return NextResponse.json({
      ok: true,
      module,
      total,
      offset,
      limit,
      records: paginated,
      monitoringStats,
      hasMore: offset + limit < total,
      generatedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Error fetching records' }, { status: 500 });
  }
}
