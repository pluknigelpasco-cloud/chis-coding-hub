import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { formatDateIso } from '@/lib/calculations';
import { MonitoringClaimStatus } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    if (payload.role === 'VIEWER') {
      return NextResponse.json({ ok: false, error: 'Viewer accounts are read-only.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, ids, module } = body;

    if ((!id && (!ids || !ids.length)) || !module) {
      return NextResponse.json({ ok: false, error: 'Record ID(s) and module are required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();

    // Helper to fetch and update MONITORING_STATUS_MAP in app_settings
    async function updateStatusMap(recordId: string, newStatus: MonitoringClaimStatus) {
      const { data: statusRow } = await supabase.from('app_settings').select('value').eq('key', 'MONITORING_STATUS_MAP').maybeSingle();
      let map: Record<string, MonitoringClaimStatus> = {};
      if (statusRow?.value) {
        try {
          map = typeof statusRow.value === 'string' ? JSON.parse(statusRow.value) : statusRow.value;
        } catch (e) {
          map = {};
        }
      }
      map[recordId] = newStatus;

      const { data: existing } = await supabase.from('app_settings').select('key').eq('key', 'MONITORING_STATUS_MAP').maybeSingle();
      if (existing) {
        await supabase.from('app_settings').update({ value: JSON.stringify(map) }).eq('key', 'MONITORING_STATUS_MAP');
      } else {
        await supabase.from('app_settings').insert({
          key: 'MONITORING_STATUS_MAP',
          value: JSON.stringify(map),
          description: 'Mapping of notice record IDs to monitoring status'
        });
      }
    }

    // Helper for batch status update in MONITORING_STATUS_MAP
    async function batchUpdateStatusMap(recordIds: string[], newStatus: MonitoringClaimStatus) {
      const { data: statusRow } = await supabase.from('app_settings').select('value').eq('key', 'MONITORING_STATUS_MAP').maybeSingle();
      let map: Record<string, MonitoringClaimStatus> = {};
      if (statusRow?.value) {
        try {
          map = typeof statusRow.value === 'string' ? JSON.parse(statusRow.value) : statusRow.value;
        } catch (e) {
          map = {};
        }
      }
      recordIds.forEach(rid => {
        map[rid] = newStatus;
      });
      const { data: existing } = await supabase.from('app_settings').select('key').eq('key', 'MONITORING_STATUS_MAP').maybeSingle();
      if (existing) {
        await supabase.from('app_settings').update({ value: JSON.stringify(map) }).eq('key', 'MONITORING_STATUS_MAP');
      } else {
        await supabase.from('app_settings').insert({
          key: 'MONITORING_STATUS_MAP',
          value: JSON.stringify(map),
          description: 'Mapping of notice record IDs to monitoring status'
        });
      }
    }

    // Handle Batch Updates (e.g. from Monitoring View)
    if (Array.isArray(ids) && ids.length > 0) {
      const targetIds = ids as string[];

      if (body.monitoringStatus) {
        const monStatus = body.monitoringStatus as MonitoringClaimStatus;
        await batchUpdateStatusMap(targetIds, monStatus);

        const rthBatchUpdates: any = { updated_at: now.toISOString() };
        const deniedBatchUpdates: any = { updated_at: now.toISOString() };

        if (monStatus === 'WITH CHEQUE' || monStatus === 'IN PROCESS') {
          rthBatchUpdates.refiled = true;
          deniedBatchUpdates.retrieved = true;
          if (body.dateOfRefileReappeal) {
            rthBatchUpdates.refiled_date = formatDateIso(new Date(body.dateOfRefileReappeal));
            deniedBatchUpdates.refiled_date = formatDateIso(new Date(body.dateOfRefileReappeal));
          }
        } else if (monStatus === 'RTH') {
          rthBatchUpdates.refiled = false;
        } else if (monStatus === 'DENIED') {
          deniedBatchUpdates.retrieved = false;
        }

        await Promise.all([
          supabase.from('rth_notices').update(rthBatchUpdates).in('id', targetIds),
          supabase.from('denied_notices').update(deniedBatchUpdates).in('id', targetIds)
        ]);
      }

      if (body.dateOfRefileReappeal !== undefined) {
        const dateVal = body.dateOfRefileReappeal ? formatDateIso(new Date(body.dateOfRefileReappeal)) : null;
        await Promise.all([
          supabase.from('rth_notices').update({ refiled_date: dateVal, updated_at: now.toISOString() }).in('id', targetIds),
          supabase.from('denied_notices').update({ refiled_date: dateVal, updated_at: now.toISOString() }).in('id', targetIds)
        ]);
      }

      await supabase.from('audit_logs').insert({
        username: payload.name,
        action: 'BATCH_UPDATE_MONITORING',
        module: 'MONITORING',
        source_ref: `${targetIds.length} records`,
        details: { count: targetIds.length, monitoringStatus: body.monitoringStatus, dateOfRefileReappeal: body.dateOfRefileReappeal }
      });

      return NextResponse.json({
        ok: true,
        message: `Successfully updated ${targetIds.length} claim(s).`
      });
    }

    // Single Record Update
    let targetTable: 'rth_notices' | 'denied_notices' | 'inpatient_trackers' | 'hd_trackers' = 'rth_notices';
    let targetNoticeType = body.noticeType;

    if (module === 'RTH') {
      targetTable = 'rth_notices';
      targetNoticeType = 'RTH';
    } else if (module === 'DENIED') {
      targetTable = 'denied_notices';
      targetNoticeType = 'DENIED';
    } else if (module === 'MONITORING') {
      if (targetNoticeType === 'DENIED') {
        targetTable = 'denied_notices';
      } else if (targetNoticeType === 'RTH') {
        targetTable = 'rth_notices';
      } else {
        const { data: rthCheck } = await supabase.from('rth_notices').select('id').eq('id', id).maybeSingle();
        targetTable = rthCheck ? 'rth_notices' : 'denied_notices';
        targetNoticeType = rthCheck ? 'RTH' : 'DENIED';
      }
    } else if (module === 'INPATIENT') {
      targetTable = 'inpatient_trackers';
    } else if (module === 'HD') {
      targetTable = 'hd_trackers';
    }

    if (module === 'RTH' || module === 'DENIED' || module === 'MONITORING') {
      const { data: current } = await supabase.from(targetTable).select('*').eq('id', id).single();
      if (!current) return NextResponse.json({ ok: false, error: 'Record not found.' }, { status: 404 });

      // Check ownership if staff
      if (payload.role === 'STAFF' && current.owner_user_id && current.owner_user_id !== payload.u) {
        return NextResponse.json({ ok: false, error: 'This record is assigned to another transmitter.' }, { status: 403 });
      }

      const updates: any = { updated_at: now.toISOString() };

      if (body.retrieved !== undefined) updates.retrieved = Boolean(body.retrieved);

      if (body.completed !== undefined) {
        if (targetTable === 'rth_notices') {
          updates.refiled = Boolean(body.completed);
          if (updates.refiled && !current.refiled_date && body.dateOfRefileReappeal === undefined) {
            updates.refiled_date = formatDateIso(now);
          }
        } else {
          updates.retrieved = Boolean(body.completed);
          if (updates.retrieved && !current.refiled_date && body.dateOfRefileReappeal === undefined) {
            updates.refiled_date = formatDateIso(now);
          }
        }
      }

      // Explicit Date of Refile / Re-Appeal
      if (body.dateOfRefileReappeal !== undefined || body.refiledDate !== undefined) {
        const d = body.dateOfRefileReappeal !== undefined ? body.dateOfRefileReappeal : body.refiledDate;
        updates.refiled_date = d ? formatDateIso(new Date(d)) : null;
      }

      // Explicit Monitoring Status
      if (body.monitoringStatus !== undefined) {
        const newMonStatus = body.monitoringStatus as MonitoringClaimStatus;
        await updateStatusMap(id, newMonStatus);

        if (newMonStatus === 'WITH CHEQUE' || newMonStatus === 'IN PROCESS') {
          if (targetTable === 'rth_notices') updates.refiled = true;
          if (targetTable === 'denied_notices') updates.retrieved = true;

          // If no refiled_date yet, default to today
          if (!updates.refiled_date && !current.refiled_date) {
            updates.refiled_date = formatDateIso(now);
          }
        } else if (newMonStatus === 'RTH' && targetTable === 'rth_notices') {
          updates.refiled = false;
        } else if (newMonStatus === 'DENIED' && targetTable === 'denied_notices') {
          updates.retrieved = false;
        }
      }

      if (body.remarks !== undefined) updates.remarks = String(body.remarks || '').trim();

      if (body.transmittedByUserId !== undefined) {
        if (body.transmittedByUserId) {
          const { data: userRow } = await supabase.from('app_users').select('id, full_name').eq('id', body.transmittedByUserId).single();
          if (userRow) {
            updates.owner_user_id = userRow.id;
            updates.transmitted_by = userRow.full_name;
          }
        } else if (payload.role === 'ADMIN') {
          updates.owner_user_id = null;
          updates.transmitted_by = null;
        }
      } else if (!current.owner_user_id && payload.role === 'STAFF' && (updates.retrieved || updates.refiled || updates.refiled_date)) {
        const { data: selfUser } = await supabase.from('app_users').select('id, full_name').eq('id', payload.u).single();
        if (selfUser) {
          updates.owner_user_id = selfUser.id;
          updates.transmitted_by = selfUser.full_name;
        }
      }

      await supabase.from(targetTable).update(updates).eq('id', id);

      await supabase.from('audit_logs').insert({
        username: payload.name,
        action: 'UPDATE_RECORD',
        module: module,
        source_ref: current.series_number,
        details: updates
      });

      return NextResponse.json({
        ok: true,
        message: 'Record updated successfully.',
        transmittedBy: updates.transmitted_by ?? current.transmitted_by,
        refiledDate: updates.refiled_date ?? current.refiled_date,
        dateOfRefileReappeal: updates.refiled_date ?? current.refiled_date,
        monitoringStatus: body.monitoringStatus
      });
    } else if (module === 'INPATIENT') {
      const updates: any = { updated_at: now.toISOString() };
      if (body.completed !== undefined) {
        updates.completed = Boolean(body.completed);
        updates.transmitted_date = updates.completed ? formatDateIso(now) : null;
      }
      if (body.remarks !== undefined) updates.remarks = String(body.remarks || '').trim();

      await supabase.from('inpatient_trackers').update(updates).eq('id', id);

      await supabase.from('audit_logs').insert({
        username: payload.name,
        action: 'UPDATE_RECORD',
        module: 'INPATIENT',
        source_ref: id,
        details: updates
      });

      return NextResponse.json({ ok: true, message: 'Inpatient tracker updated.' });
    } else if (module === 'HD') {
      const updates: any = { updated_at: now.toISOString() };
      if (body.completed !== undefined) {
        updates.completed = Boolean(body.completed);
        updates.transmitted_date = updates.completed ? formatDateIso(now) : null;
      }
      if (body.remarks !== undefined) updates.remarks = String(body.remarks || '').trim();

      await supabase.from('hd_trackers').update(updates).eq('id', id);

      await supabase.from('audit_logs').insert({
        username: payload.name,
        action: 'UPDATE_RECORD',
        module: 'HD',
        source_ref: id,
        details: updates
      });

      return NextResponse.json({ ok: true, message: 'Hemodialysis tracker updated.' });
    }

    return NextResponse.json({ ok: false, error: 'Unknown module' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || 'Update error' }, { status: 500 });
  }
}
