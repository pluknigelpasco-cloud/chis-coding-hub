import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { BaseRecord, DashboardMetrics, AppSettings } from '@/lib/types';
import { calendarDaysDiff, computeDeadlineStatus, DEFAULT_SETTINGS, formatDate } from '@/lib/calculations';

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    const supabase = getSupabaseAdmin();

    // 1. Fetch settings
    const { data: settingsRows } = await supabase.from('app_settings').select('*');
    const settings: AppSettings = { ...DEFAULT_SETTINGS };
    settingsRows?.forEach(r => {
      if (r.key in settings) {
        (settings as any)[r.key] = isNaN(Number(r.value)) ? r.value : Number(r.value);
      }
    });

    const today = new Date();
    const expiredQueueDays = Number(settings.EXPIRED_QUEUE_DAYS) || 30;

    // 2. Fetch all modules
    const [rthRes, deniedRes, inpatientRes, hdRes] = await Promise.all([
      supabase.from('rth_notices').select('*'),
      supabase.from('denied_notices').select('*'),
      supabase.from('inpatient_trackers').select('*'),
      supabase.from('hd_trackers').select('*'),
    ]);

    // RTH records
    let rthRecords: BaseRecord[] = (rthRes.data || []).map(r => {
      const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
      const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
      const status = computeDeadlineStatus(daysLeft, r.refiled, settings);
      return {
        id: r.id,
        module: 'RTH',
        reference: r.series_number,
        patientName: r.patient_name,
        memberCategory: r.member_category,
        admittedDate: formatDate(r.admitted_date),
        dischargedDate: formatDate(r.discharged_date),
        claimAmount: Number(r.claim_amount || 0),
        totalCharges: Number(r.total_charges || 0),
        deficiency: r.deficiency,
        claimReceivedDate: formatDate(r.claim_received_date),
        noticeDate: formatDate(r.notice_date),
        expiryDate: formatDate(r.expiry_date),
        baseDate: formatDate(r.claim_received_date),
        controlNumber: r.control_number,
        retrieved: r.retrieved,
        completed: r.refiled,
        refiledDate: formatDate(r.refiled_date),
        transmittedBy: r.transmitted_by,
        ownerUserId: r.owner_user_id,
        remarks: r.remarks,
        daysLeft,
        status,
      };
    });

    // Denied records
    let deniedRecords: BaseRecord[] = (deniedRes.data || []).map(r => {
      const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
      const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
      const status = computeDeadlineStatus(daysLeft, r.retrieved, settings);
      return {
        id: r.id,
        module: 'DENIED',
        reference: r.series_number,
        patientName: r.patient_name,
        memberCategory: r.member_category,
        admittedDate: formatDate(r.admitted_date),
        dischargedDate: formatDate(r.discharged_date),
        claimAmount: Number(r.claim_amount || 0),
        totalCharges: Number(r.total_charges || 0),
        deficiency: r.deficiency,
        claimReceivedDate: formatDate(r.claim_received_date),
        noticeDate: formatDate(r.notice_date),
        expiryDate: formatDate(r.expiry_date),
        baseDate: formatDate(r.claim_received_date),
        controlNumber: r.control_number,
        retrieved: r.retrieved,
        completed: r.retrieved,
        refiledDate: formatDate(r.refiled_date),
        transmittedBy: r.transmitted_by,
        ownerUserId: r.owner_user_id,
        remarks: r.remarks,
        daysLeft,
        status,
      };
    });

    // Filter for STAFF role
    if (payload.role === 'STAFF') {
      const filterMine = (r: BaseRecord) => {
        if (!r.ownerUserId && !r.transmittedBy) return true;
        return r.ownerUserId === payload.u || r.transmittedBy?.toLowerCase().includes(payload.name.toLowerCase());
      };
      rthRecords = rthRecords.filter(filterMine);
      deniedRecords = deniedRecords.filter(filterMine);
    }

    // Inpatient records
    const inpatientRecords: BaseRecord[] = (inpatientRes.data || []).map(r => {
      const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
      const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
      const status = computeDeadlineStatus(daysLeft, r.completed, settings);
      const catList = r.categories && r.categories.length ? r.categories.join(', ') : 'Inpatient';
      return {
        id: r.id,
        module: 'INPATIENT',
        reference: formatDate(r.discharge_date),
        patientName: '',
        memberCategory: catList,
        baseDate: formatDate(r.discharge_date),
        dischargeDate: formatDate(r.discharge_date),
        expiryDate: formatDate(r.expiry_date),
        completed: r.completed,
        transmittedDate: formatDate(r.transmitted_date),
        remarks: r.remarks,
        daysLeft,
        status,
      };
    });

    // HD records
    const hdRecords: BaseRecord[] = (hdRes.data || []).map(r => {
      const expiry = r.expiry_date ? new Date(r.expiry_date) : null;
      const daysLeft = expiry ? calendarDaysDiff(today, expiry) : null;
      const status = computeDeadlineStatus(daysLeft, r.completed, settings);
      return {
        id: r.id,
        module: 'HD',
        reference: formatDate(r.encounter_date),
        patientName: '',
        memberCategory: r.is_hdu ? 'HDU' : 'Hemodialysis',
        baseDate: formatDate(r.encounter_date),
        admittedDate: formatDate(r.encounter_date),
        expiryDate: formatDate(r.expiry_date),
        completed: r.completed,
        transmittedDate: formatDate(r.transmitted_date),
        remarks: r.remarks,
        daysLeft,
        status,
      };
    });

    // Counts
    const rthPending = rthRecords.filter(r => !r.completed).length;
    const rthUrgent = rthRecords.filter(r => r.status === 'CRITICAL' || (r.status === 'EXPIRED' && (r.daysLeft || 0) >= -expiredQueueDays)).length;
    const deniedPending = deniedRecords.filter(r => !r.completed).length;
    const inpatientPending = inpatientRecords.filter(r => !r.completed).length;
    const hdPending = hdRecords.filter(r => !r.completed).length;

    const allUrgent = [...rthRecords, ...deniedRecords, ...inpatientRecords, ...hdRecords]
      .filter(r => r.status === 'WARNING' || r.status === 'CRITICAL' || (r.status === 'EXPIRED' && (r.daysLeft || 0) >= -expiredQueueDays))
      .sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999));

    const metrics: DashboardMetrics = {
      rthPending,
      rthUrgent,
      deniedPending,
      inpatientPending,
      hdPending,
      totalUrgent: allUrgent.length,
      urgentRows: allUrgent.slice(0, 50),
    };

    return NextResponse.json({
      ok: true,
      dashboard: metrics,
      generatedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Dashboard error' }, { status: 500 });
  }
}
