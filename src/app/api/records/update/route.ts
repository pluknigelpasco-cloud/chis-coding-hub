import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { formatDateIso } from '@/lib/calculations';

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req);
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ ok: false, error: 'SESSION_EXPIRED' }, { status: 401 });

    if (payload.role === 'VIEWER') {
      return NextResponse.json({ ok: false, error: 'Viewer accounts are read-only.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, module } = body;
    if (!id || !module) {
      return NextResponse.json({ ok: false, error: 'Record ID and module are required.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();

    if (module === 'RTH') {
      const { data: current } = await supabase.from('rth_notices').select('*').eq('id', id).single();
      if (!current) return NextResponse.json({ ok: false, error: 'Record not found.' }, { status: 404 });

      // Check ownership if staff
      if (payload.role === 'STAFF' && current.owner_user_id && current.owner_user_id !== payload.u) {
        return NextResponse.json({ ok: false, error: 'This record is assigned to another transmitter.' }, { status: 403 });
      }

      const updates: any = { updated_at: now.toISOString() };
      if (body.retrieved !== undefined) updates.retrieved = Boolean(body.retrieved);
      if (body.completed !== undefined) {
        updates.refiled = Boolean(body.completed);
        updates.refiled_date = updates.refiled ? formatDateIso(now) : null;
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
      } else if (!current.owner_user_id && payload.role === 'STAFF' && (updates.retrieved || updates.refiled)) {
        // Auto-assign to staff who performs action
        const { data: selfUser } = await supabase.from('app_users').select('id, full_name').eq('id', payload.u).single();
        if (selfUser) {
          updates.owner_user_id = selfUser.id;
          updates.transmitted_by = selfUser.full_name;
        }
      }

      await supabase.from('rth_notices').update(updates).eq('id', id);

      await supabase.from('audit_logs').insert({
        username: payload.name,
        action: 'UPDATE_RECORD',
        module: 'RTH',
        source_ref: current.series_number,
        details: updates
      });

      return NextResponse.json({
        ok: true,
        message: 'RTH record updated successfully.',
        transmittedBy: updates.transmitted_by ?? current.transmitted_by,
        refiledDate: updates.refiled_date ?? current.refiled_date,
      });
    } else if (module === 'DENIED') {
      const { data: current } = await supabase.from('denied_notices').select('*').eq('id', id).single();
      if (!current) return NextResponse.json({ ok: false, error: 'Record not found.' }, { status: 404 });

      if (payload.role === 'STAFF' && current.owner_user_id && current.owner_user_id !== payload.u) {
        return NextResponse.json({ ok: false, error: 'This record is assigned to another transmitter.' }, { status: 403 });
      }

      const updates: any = { updated_at: now.toISOString() };
      if (body.retrieved !== undefined) {
        updates.retrieved = Boolean(body.retrieved);
        updates.refiled_date = updates.retrieved ? formatDateIso(now) : null;
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
      } else if (!current.owner_user_id && payload.role === 'STAFF' && updates.retrieved) {
        const { data: selfUser } = await supabase.from('app_users').select('id, full_name').eq('id', payload.u).single();
        if (selfUser) {
          updates.owner_user_id = selfUser.id;
          updates.transmitted_by = selfUser.full_name;
        }
      }

      await supabase.from('denied_notices').update(updates).eq('id', id);

      await supabase.from('audit_logs').insert({
        username: payload.name,
        action: 'UPDATE_RECORD',
        module: 'DENIED',
        source_ref: current.series_number,
        details: updates
      });

      return NextResponse.json({
        ok: true,
        message: 'Denied record updated successfully.',
        transmittedBy: updates.transmitted_by ?? current.transmitted_by,
        transmittedDate: updates.refiled_date ?? current.refiled_date,
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
