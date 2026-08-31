const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables from .env.local manually to be dependency-free
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf-8');
    env.split('\n').forEach(line => {
      const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
    console.log('✓ Loaded environment variables from .env.local');
  } else {
    console.warn('⚠️ No .env.local file found. Will use system environment variables.');
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appsScriptUrl = process.env.APPS_SCRIPT_URL;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

if (!appsScriptUrl) {
  console.error('❌ Error: APPS_SCRIPT_URL must be set in .env.local.');
  process.exit(1);
}

// Helper to make HTTPS requests
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle redirect
      if (res.statusCode === 302 || res.statusCode === 301) {
        httpGet(res.headers.location).then(resolve).catch(reject);
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Helper to write to Supabase via REST API
function supabaseRequest(table, method, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(`${supabaseUrl}/rest/v1/${table}`);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      }
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`Supabase Error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function startMigration() {
  console.log('🔗 Fetching data from Google Sheets via Apps Script Web App...');
  const exportUrl = `${appsScriptUrl}?action=export_chis`;
  
  let rawData;
  try {
    const dataStr = await httpGet(exportUrl);
    rawData = JSON.parse(dataStr);
  } catch (err) {
    console.error('❌ Failed to fetch data from Google Sheets. Ensure your Apps Script Web App is deployed with Access: "Anyone" and the action matches.');
    console.error(err.message);
    process.exit(1);
  }

  console.log('✓ Successfully retrieved sheets from Google Sheets!');

  // 1. Migrate ICD-10
  if (rawData.ICD10_DB && rawData.ICD10_DB.length > 1) {
    const headers = rawData.ICD10_DB[0];
    const rows = rawData.ICD10_DB.slice(1);
    console.log(`📦 Preparing ${rows.length} ICD-10 records for Supabase...`);
    
    // Map sheet columns to db columns
    const records = rows.map(r => ({
      code: String(r[0] || '').trim(),
      description: String(r[1] || '').trim(),
      case_rate: parseFloat(r[2]) || 0,
      hospital_fee: parseFloat(r[3]) || 0,
      professional_fee: parseFloat(r[4]) || 0
    })).filter(r => r.code);

    // Batch insert in chunks of 500
    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await supabaseRequest('icd10_db', 'POST', chunk);
      console.log(`  ✓ Inserted ICD-10 records ${i + 1} to ${Math.min(i + chunkSize, records.length)}`);
    }
  }

  // 2. Migrate RVS
  if (rawData.RVS_DB && rawData.RVS_DB.length > 1) {
    const rows = rawData.RVS_DB.slice(1);
    console.log(`📦 Preparing ${rows.length} RVS records for Supabase...`);
    const records = rows.map(r => ({
      code: String(r[0] || '').trim(),
      description: String(r[1] || '').trim(),
      case_rate: parseFloat(r[2]) || 0,
      hospital_fee: parseFloat(r[3]) || 0,
      professional_fee: parseFloat(r[4]) || 0
    })).filter(r => r.code);

    const chunkSize = 500;
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunk = records.slice(i, i + chunkSize);
      await supabaseRequest('rvs_db', 'POST', chunk);
      console.log(`  ✓ Inserted RVS records ${i + 1} to ${Math.min(i + chunkSize, records.length)}`);
    }
  }

  // 3. Migrate Abbreviations
  if (rawData.Abbreviations && rawData.Abbreviations.length > 1) {
    const rows = rawData.Abbreviations.slice(1);
    console.log(`📦 Preparing ${rows.length} Medical Abbreviations for Supabase...`);
    const records = rows.map(r => ({
      abbreviation: String(r[0] || '').trim().toUpperCase(),
      meaning: String(r[1] || '').trim()
    })).filter(r => r.abbreviation);

    if (records.length) {
      await supabaseRequest('abbreviations', 'POST', records);
      console.log(`  ✓ Inserted ${records.length} abbreviations.`);
    }
  }

  // 4. Migrate Diagnosis Index
  if (rawData.Diagnosis_Index && rawData.Diagnosis_Index.length > 1) {
    const rows = rawData.Diagnosis_Index.slice(1);
    console.log(`📦 Preparing ${rows.length} Diagnosis Index rules for Supabase...`);
    const records = rows.map(r => ({
      preferred_code: String(r[0] || '').trim(),
      diagnosis_pattern: String(r[1] || '').trim(),
      qualifiers: String(r[2] || '').trim(),
      weight: parseFloat(r[3]) || 1.0,
      coding_note: String(r[4] || '').trim(),
      active: String(r[5] || '').toLowerCase() !== 'false'
    })).filter(r => r.preferred_code && r.diagnosis_pattern);

    if (records.length) {
      const chunkSize = 200;
      for (let i = 0; i < records.length; i += chunkSize) {
        const chunk = records.slice(i, i + chunkSize);
        await supabaseRequest('diagnosis_index', 'POST', chunk);
      }
      console.log(`  ✓ Inserted ${records.length} diagnosis index rules.`);
    }
  }

  // 5. Migrate Combination Rules
  if (rawData.Combination_Rules && rawData.Combination_Rules.length > 1) {
    const rows = rawData.Combination_Rules.slice(1);
    console.log(`📦 Preparing ${rows.length} Combination Rules for Supabase...`);
    const records = rows.map(r => ({
      connector: String(r[0] || '').trim(),
      left_role: String(r[1] || '').trim(),
      right_role: String(r[2] || '').trim(),
      sequencing_note: String(r[3] || '').trim(),
      active: String(r[4] || '').toLowerCase() !== 'false'
    })).filter(r => r.connector);

    if (records.length) {
      await supabaseRequest('combination_rules', 'POST', records);
      console.log(`  ✓ Inserted ${records.length} combination rules.`);
    }
  }

  console.log('\n🎉 Database Migration and Seeding Completed Successfully!');
}

startMigration().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
