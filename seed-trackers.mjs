import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jtcaacarwzggscnmftfm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0Y2FhY2Fyd3pnZ3Njbm1mdGZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc5NjU4MSwiZXhwIjoyMTAzMzcyNTgxfQ.YWgspRmFhGM6ghsRgp3dSzpEdW92xv5-QTdFPcM7uKE';

const supabase = createClient(supabaseUrl, supabaseKey);

function addDays(d, days) {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function toIso(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function seedTrackers() {
  console.log('Seeding 60 Days Inpatient and 60 Days Hemodialysis from June 1, 2026...');

  const startDate = new Date(2026, 5, 1); // June 1, 2026
  const endDate = new Date(2026, 11, 31); // Dec 31, 2026

  const inpRows = [];
  const hdRows = [];

  let cur = new Date(startDate);
  while (cur <= endDate) {
    const curIso = toIso(cur);
    const expIso = toIso(addDays(cur, 60));

    // Match exact historical status from user's screenshot:
    // Inpatient: June 1 to June 4 transmitted, June 5 to June 9 transmitted on 08/13/2026
    let inpTransmitted = false;
    let inpTransDate = null;
    if (curIso <= '2026-06-03') {
      inpTransmitted = true;
      inpTransDate = '2026-08-04';
    } else if (curIso === '2026-06-04') {
      inpTransmitted = true;
      inpTransDate = '2026-08-05';
    } else if (curIso <= '2026-06-09') {
      inpTransmitted = true;
      inpTransDate = '2026-08-13';
    }

    // HD: June 1 to June 8 transmitted on 08/07/2026
    let hdTransmitted = false;
    let hdTransDate = null;
    if (curIso <= '2026-06-08') {
      hdTransmitted = true;
      hdTransDate = '2026-08-07';
    }

    inpRows.push({
      discharge_date: curIso,
      expiry_date: expIso,
      categories: ['Inpatient'],
      completed: inpTransmitted,
      transmitted_date: inpTransDate,
      remarks: '60-day discharge tracker',
    });

    hdRows.push({
      encounter_date: curIso,
      expiry_date: expIso,
      is_hdu: false,
      completed: hdTransmitted,
      transmitted_date: hdTransDate,
      remarks: '60-day hemodialysis tracker',
    });

    cur.setDate(cur.getDate() + 1);
  }

  const { error: inpErr } = await supabase.from('inpatient_trackers').upsert(inpRows, {
    onConflict: 'discharge_date',
  });
  if (inpErr) console.error('Inpatient seed error:', inpErr.message);
  else console.log(`✓ Inserted/Upserted ${inpRows.length} Inpatient tracker rows.`);

  const { error: hdErr } = await supabase.from('hd_trackers').upsert(hdRows, {
    onConflict: 'encounter_date',
  });
  if (hdErr) console.error('HD seed error:', hdErr.message);
  else console.log(`✓ Inserted/Upserted ${hdRows.length} HD tracker rows.`);
}

seedTrackers();
