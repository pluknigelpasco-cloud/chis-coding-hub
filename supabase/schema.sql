-- =========================================================================
-- CPH-Balamban Transmittal & Deadline Monitor
-- Supabase PostgreSQL Database Schema
-- =========================================================================

-- Enable UUID & Crypto extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -------------------------------------------------------------------------
-- 1. APP USERS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'STAFF' CHECK (role IN ('ADMIN', 'STAFF', 'VIEWER')),
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    profile_photo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_app_users_username ON app_users(username);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- -------------------------------------------------------------------------
-- 2. APP SESSIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_sessions (
    token_hash VARCHAR(64) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON app_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires_at ON app_sessions(expires_at);

-- -------------------------------------------------------------------------
-- 3. APP SETTINGS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);

INSERT INTO app_settings (key, value, description) VALUES
    ('CRITICAL_DAYS', '7', 'Red alert days threshold (0 through this many days)'),
    ('WARNING_DAYS', '15', 'Orange alert days threshold'),
    ('RTH_DEADLINE_DAYS', '60', 'Fallback days from claim received when PDF deadline is absent'),
    ('INPATIENT_DEADLINE_DAYS', '60', 'Days from discharge date'),
    ('HD_DEADLINE_DAYS', '60', 'Days from encounter date'),
    ('EXPIRED_QUEUE_DAYS', '30', 'Show recently expired items in dashboard urgent queue'),
    ('SESSION_HOURS', '24', 'Session login validity hours'),
    ('ALERT_RECIPIENTS', '', 'Comma-separated emails for notifications'),
    ('WEB_APP_URL', '', 'Deployed Vercel URL'),
    ('DAILY_ALERT_HOUR', '7', '0 to 23 Asia/Manila')
ON CONFLICT (key) DO NOTHING;

-- -------------------------------------------------------------------------
-- 4. RTH NOTICES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rth_notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notice_row_no INT,
    series_number VARCHAR(20) NOT NULL,
    member_category VARCHAR(10),
    patient_name VARCHAR(200) NOT NULL,
    admitted_date DATE,
    discharged_date DATE,
    claim_amount NUMERIC(12, 2) DEFAULT 0,
    total_charges NUMERIC(12, 2) DEFAULT 0,
    deficiency TEXT,
    claim_received_date DATE,
    notice_date DATE,
    expiry_date DATE,
    control_number VARCHAR(100),
    retrieved BOOLEAN NOT NULL DEFAULT FALSE,
    refiled BOOLEAN NOT NULL DEFAULT FALSE,
    refiled_date DATE,
    remarks TEXT,
    transmitted_by VARCHAR(150),
    owner_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_rth_series_expiry UNIQUE (series_number, expiry_date)
);

CREATE INDEX IF NOT EXISTS idx_rth_series_number ON rth_notices(series_number);
CREATE INDEX IF NOT EXISTS idx_rth_patient_name ON rth_notices(patient_name);
CREATE INDEX IF NOT EXISTS idx_rth_expiry_date ON rth_notices(expiry_date);
CREATE INDEX IF NOT EXISTS idx_rth_refiled ON rth_notices(refiled);
CREATE INDEX IF NOT EXISTS idx_rth_owner_user_id ON rth_notices(owner_user_id);

-- -------------------------------------------------------------------------
-- 5. DENIED NOTICES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS denied_notices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notice_row_no INT,
    series_number VARCHAR(20) NOT NULL,
    member_category VARCHAR(10),
    patient_name VARCHAR(200) NOT NULL,
    admitted_date DATE,
    discharged_date DATE,
    claim_amount NUMERIC(12, 2) DEFAULT 0,
    total_charges NUMERIC(12, 2) DEFAULT 0,
    deficiency TEXT,
    claim_received_date DATE,
    notice_date DATE,
    expiry_date DATE,
    control_number VARCHAR(100),
    retrieved BOOLEAN NOT NULL DEFAULT FALSE,
    refiled_date DATE,
    remarks TEXT,
    transmitted_by VARCHAR(150),
    owner_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_denied_series_expiry UNIQUE (series_number, expiry_date)
);

CREATE INDEX IF NOT EXISTS idx_denied_series_number ON denied_notices(series_number);
CREATE INDEX IF NOT EXISTS idx_denied_patient_name ON denied_notices(patient_name);
CREATE INDEX IF NOT EXISTS idx_denied_expiry_date ON denied_notices(expiry_date);
CREATE INDEX IF NOT EXISTS idx_denied_retrieved ON denied_notices(retrieved);
CREATE INDEX IF NOT EXISTS idx_denied_owner_user_id ON denied_notices(owner_user_id);

-- -------------------------------------------------------------------------
-- 6. 60-DAYS INPATIENT TRACKER TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inpatient_trackers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discharge_date DATE NOT NULL,
    categories TEXT[] DEFAULT ARRAY['Admitted'],
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    transmitted_date DATE,
    expiry_date DATE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_inpatient_discharge UNIQUE (discharge_date)
);

CREATE INDEX IF NOT EXISTS idx_inpatient_discharge_date ON inpatient_trackers(discharge_date);
CREATE INDEX IF NOT EXISTS idx_inpatient_expiry_date ON inpatient_trackers(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inpatient_completed ON inpatient_trackers(completed);

-- -------------------------------------------------------------------------
-- 7. 60-DAYS HEMODIALYSIS TRACKER TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hd_trackers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    encounter_date DATE NOT NULL,
    is_hdu BOOLEAN NOT NULL DEFAULT FALSE,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    transmitted_date DATE,
    expiry_date DATE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_hd_encounter UNIQUE (encounter_date)
);

CREATE INDEX IF NOT EXISTS idx_hd_encounter_date ON hd_trackers(encounter_date);
CREATE INDEX IF NOT EXISTS idx_hd_expiry_date ON hd_trackers(expiry_date);
CREATE INDEX IF NOT EXISTS idx_hd_completed ON hd_trackers(completed);

-- -------------------------------------------------------------------------
-- 8. AUDIT LOGS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    username VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    module VARCHAR(30),
    source_ref VARCHAR(100),
    details JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);

-- -------------------------------------------------------------------------
-- 9. PDF IMPORT LOGS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS import_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    username VARCHAR(50) NOT NULL,
    notice_type VARCHAR(20) NOT NULL CHECK (notice_type IN ('RTH', 'DENIED')),
    original_filename VARCHAR(255) NOT NULL,
    storage_path TEXT,
    file_hash VARCHAR(64),
    control_numbers TEXT,
    extracted_rows INT NOT NULL DEFAULT 0,
    imported_rows INT NOT NULL DEFAULT 0,
    duplicate_rows INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_import_logs_timestamp ON import_logs(timestamp DESC);

-- -------------------------------------------------------------------------
-- 10. CHIS ICD-10 DATABASE TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS icd10_db (
    code VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    case_rate NUMERIC(12, 2) DEFAULT 0,
    hospital_fee NUMERIC(12, 2) DEFAULT 0,
    professional_fee NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_icd10_desc_trgm ON icd10_db USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_icd10_code ON icd10_db(code);

-- -------------------------------------------------------------------------
-- 11. CHIS RVS DATABASE TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rvs_db (
    code VARCHAR(50) PRIMARY KEY,
    description TEXT NOT NULL,
    case_rate NUMERIC(12, 2) DEFAULT 0,
    hospital_fee NUMERIC(12, 2) DEFAULT 0,
    professional_fee NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rvs_desc_trgm ON rvs_db USING gin(to_tsvector('english', description));
CREATE INDEX IF NOT EXISTS idx_rvs_code ON rvs_db(code);

-- -------------------------------------------------------------------------
-- 12. USER FAVORITES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('ICD', 'RVS')),
    description TEXT NOT NULL,
    case_rate NUMERIC(12, 2) DEFAULT 0,
    hospital_fee NUMERIC(12, 2) DEFAULT 0,
    professional_fee NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_user_code_fav ON favorites(username, code);
CREATE INDEX IF NOT EXISTS idx_favorites_username ON favorites(username);

-- -------------------------------------------------------------------------
-- 13. SEARCH HISTORY TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    code VARCHAR(50),
    type VARCHAR(10) CHECK (type IN ('ICD', 'RVS')),
    description TEXT,
    case_rate NUMERIC(12, 2) DEFAULT 0,
    hospital_fee NUMERIC(12, 2) DEFAULT 0,
    professional_fee NUMERIC(12, 2) DEFAULT 0,
    source VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_history_username ON search_history(username);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at DESC);

-- -------------------------------------------------------------------------
-- 14. ABBREVIATIONS TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS abbreviations (
    abbreviation VARCHAR(100) PRIMARY KEY,
    meaning TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 15. DIAGNOSIS INDEX TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS diagnosis_index (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    preferred_code VARCHAR(50) NOT NULL,
    diagnosis_pattern TEXT NOT NULL,
    qualifiers TEXT,
    weight NUMERIC(5, 2) DEFAULT 1.0,
    coding_note TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diagnosis_pattern ON diagnosis_index(diagnosis_pattern);

-- -------------------------------------------------------------------------
-- 16. COMBINATION RULES TABLE
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS combination_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector VARCHAR(50) NOT NULL,
    left_role VARCHAR(100) NOT NULL,
    right_role VARCHAR(100) NOT NULL,
    sequencing_note TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------------------
-- 17. DEFAULT ADMIN SEED
-- Default password: Admin!Balamban2026
-- -------------------------------------------------------------------------
DO $$
DECLARE
    admin_exists BOOLEAN;
    salt_val TEXT;
    pwd_val TEXT;
    i INT;
BEGIN
    SELECT EXISTS (SELECT 1 FROM app_users WHERE username = 'admin') INTO admin_exists;
    IF NOT admin_exists THEN
        salt_val := encode(gen_random_bytes(18), 'base64');
        pwd_val := 'Admin!Balamban2026' || '|' || salt_val;
        FOR i IN 1..900 LOOP
            pwd_val := encode(digest(pwd_val || '|' || salt_val, 'sha256'), 'base64');
        END LOOP;
        
        INSERT INTO app_users (username, full_name, role, password_hash, salt, active, must_change_password)
        VALUES ('admin', 'System Administrator', 'ADMIN', pwd_val, salt_val, TRUE, TRUE);
    END IF;
END $$;
