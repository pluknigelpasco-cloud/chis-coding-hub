/**
 * CHIS → Supabase One-Time Seeder (Auto-Deduplicated)
 * ----------------------------------------------------
 * Paste this file into your CHIS Google Apps Script project.
 * Then run:  exportCHISToSupabase()
 */

var SUPABASE_URL = 'https://jtcaacarwzggscnmftfm.supabase.co';
var SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0Y2FhY2Fyd3pnZ3Njbm1mdGZtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzc5NjU4MSwiZXhwIjoyMTAzMzcyNTgxfQ.YWgspRmFhGM6ghsRgp3dSzpEdW92xv5-QTdFPcM7uKE';

// ─── Main entry point ────────────────────────────────────────────────────────

function exportCHISToSupabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = [];

  log.push('=== CHIS → Supabase Export Started ===');
  log.push(new Date().toISOString());

  // 1. ICD10_DB
  var icdCount = exportSheetToSupabase_(ss, 'ICD10_DB', 'icd10_db', log);
  log.push('ICD10_DB: ' + icdCount + ' unique codes uploaded');

  // 2. RVS_DB
  var rvsCount = exportSheetToSupabase_(ss, 'RVS_DB', 'rvs_db', log);
  log.push('RVS_DB: ' + rvsCount + ' unique codes uploaded');

  // 3. Abbreviations
  var abbrevCount = exportAbbreviations_(ss, log);
  log.push('Abbreviations: ' + abbrevCount + ' rows verified');

  // 4. Diagnosis Index
  var diagCount = exportDiagnosisIndex_(ss, log);
  log.push('Diagnosis Index: ' + diagCount + ' rows verified');

  // 5. Combination Rules
  var rulesCount = exportCombinationRules_(ss, log);
  log.push('Combination Rules: ' + rulesCount + ' rows verified');

  log.push('=== Done ===');
  Logger.log(log.join('\n'));
  Browser.msgBox('Export Complete!\n\nICD-10 codes: ' + icdCount + '\nRVS codes: ' + rvsCount +
    '\nAbbreviations: ' + abbrevCount + '\nDiagnosis Index: ' + diagCount +
    '\nCombination Rules: ' + rulesCount + '\n\nNa-upload na tanan sa Supabase!');
}

// ─── ICD10 / RVS export (With in-memory deduplication) ─────────────────────────

function exportSheetToSupabase_(ss, sheetName, tableName, log) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    log.push('WARNING: Sheet "' + sheetName + '" not found. Skipping.');
    return 0;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    log.push('WARNING: Sheet "' + sheetName + '" has no data rows.');
    return 0;
  }

  // Read all data rows
  var data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var rowsMap = {};

  data.forEach(function(row) {
    var code = String(row[0] || '').trim();
    var description = String(row[1] || '').trim();
    if (!code || !description) return;

    // Deduplicate by code
    rowsMap[code] = {
      code: code,
      description: description,
      case_rate: toNumber_(row[2]),
      hospital_fee: toNumber_(row[3]),
      professional_fee: toNumber_(row[4])
    };
  });

  var rows = [];
  for (var k in rowsMap) {
    if (rowsMap.hasOwnProperty(k)) {
      rows.push(rowsMap[k]);
    }
  }

  if (rows.length === 0) {
    log.push('No valid rows found in ' + sheetName);
    return 0;
  }

  // Batch upsert in chunks of 500
  var CHUNK = 500;
  var sent = 0;
  for (var i = 0; i < rows.length; i += CHUNK) {
    var chunk = rows.slice(i, i + CHUNK);
    var result = supabaseUpsert_(tableName, chunk, 'code');
    if (result.error) {
      log.push('ERROR in ' + tableName + ' chunk ' + i + ': ' + result.error);
    } else {
      sent += chunk.length;
    }
  }
  return sent;
}

// ─── Abbreviations ───────────────────────────────────────────────────────────

function exportAbbreviations_(ss, log) {
  var sheet = ss.getSheetByName('Abbreviations');
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var rowsMap = {};
  data.forEach(function(row) {
    var abbrev = String(row[0] || '').trim().toUpperCase();
    var meaning = String(row[1] || '').trim();
    if (!abbrev || !meaning) return;
    rowsMap[abbrev] = { abbreviation: abbrev, meaning: meaning };
  });

  var rows = [];
  for (var k in rowsMap) {
    if (rowsMap.hasOwnProperty(k)) rows.push(rowsMap[k]);
  }

  if (!rows.length) return 0;
  var result = supabaseUpsert_('abbreviations', rows, 'abbreviation');
  if (result.error) log.push('ERROR abbreviations: ' + result.error);
  return rows.length;
}

// ─── Diagnosis Index ─────────────────────────────────────────────────────────

function exportDiagnosisIndex_(ss, log) {
  var sheet = ss.getSheetByName('Diagnosis_Index');
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
  var rows = [];
  data.forEach(function(row) {
    var preferredCode = String(row[0] || '').trim();
    var pattern = String(row[1] || '').trim();
    if (!preferredCode || !pattern) return;
    rows.push({
      preferred_code: preferredCode,
      diagnosis_pattern: pattern,
      qualifiers: String(row[2] || '').trim(),
      weight: toNumber_(row[3]) || 50,
      coding_note: String(row[4] || '').trim(),
      active: row[5] !== false && row[5] !== 'FALSE' && row[5] !== 0
    });
  });

  if (!rows.length) return 0;
  var result = supabaseClearAndInsert_('diagnosis_index', rows);
  if (result.error) log.push('ERROR diagnosis_index: ' + result.error);
  return rows.length;
}

// ─── Combination Rules ───────────────────────────────────────────────────────

function exportCombinationRules_(ss, log) {
  var sheet = ss.getSheetByName('Combination_Rules');
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();
  var rows = [];
  data.forEach(function(row) {
    var connector = String(row[0] || '').trim().toUpperCase();
    if (!connector) return;
    rows.push({
      connector: connector,
      left_role: String(row[1] || '').trim(),
      right_role: String(row[2] || '').trim(),
      sequencing_note: String(row[3] || '').trim(),
      active: row[4] !== false && row[4] !== 'FALSE' && row[4] !== 0
    });
  });

  if (!rows.length) return 0;
  var result = supabaseClearAndInsert_('combination_rules', rows);
  if (result.error) log.push('ERROR combination_rules: ' + result.error);
  return rows.length;
}

// ─── Supabase helpers ────────────────────────────────────────────────────────

function supabaseUpsert_(table, rows, onConflict) {
  var url = SUPABASE_URL + '/rest/v1/' + table + '?on_conflict=' + onConflict;
  var options = {
    method: 'POST',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
      'Prefer': 'resolution=merge-duplicates'
    },
    payload: JSON.stringify(rows),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true };
    } else {
      return { error: 'HTTP ' + code + ': ' + response.getContentText().substring(0, 200) };
    }
  } catch (e) {
    return { error: e.message };
  }
}

function supabaseClearAndInsert_(table, rows) {
  try {
    var delUrl = SUPABASE_URL + '/rest/v1/' + table + '?id=not.is.null';
    UrlFetchApp.fetch(delUrl, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
      },
      muteHttpExceptions: true
    });

    var insUrl = SUPABASE_URL + '/rest/v1/' + table;
    var response = UrlFetchApp.fetch(insUrl, {
      method: 'POST',
      contentType: 'application/json',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
      },
      payload: JSON.stringify(rows),
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true };
    } else {
      return { error: 'HTTP ' + code + ': ' + response.getContentText().substring(0, 200) };
    }
  } catch (e) {
    return { error: e.message };
  }
}

function toNumber_(val) {
  if (typeof val === 'number') return isFinite(val) ? val : 0;
  var n = Number(String(val || '').replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : 0;
}
