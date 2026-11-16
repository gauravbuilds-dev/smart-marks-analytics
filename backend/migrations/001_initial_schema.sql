CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'hod', 'teacher')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  roll_number VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  department VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  subject_code VARCHAR(20) NOT NULL UNIQUE,
  subject_name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_terms (
  id SERIAL PRIMARY KEY,
  academic_year VARCHAR(20) NOT NULL,
  semester_number SMALLINT NOT NULL CHECK (semester_number BETWEEN 1 AND 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (academic_year, semester_number)
);

CREATE TABLE IF NOT EXISTS student_enrollments (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  term_id INTEGER NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  section VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, term_id)
);

CREATE TABLE IF NOT EXISTS subject_assignments (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  term_id INTEGER NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, subject_id, term_id)
);

CREATE TABLE IF NOT EXISTS examinations (
  id SERIAL PRIMARY KEY,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  term_id INTEGER NOT NULL REFERENCES academic_terms(id) ON DELETE RESTRICT,
  exam_type VARCHAR(10) NOT NULL CHECK (exam_type IN ('CT-1', 'CT-2')),
  max_marks NUMERIC(6, 2) NOT NULL CHECK (max_marks > 0),
  passing_marks NUMERIC(6, 2) NOT NULL CHECK (passing_marks >= 0 AND passing_marks <= max_marks),
  exam_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subject_id, term_id, exam_type)
);

CREATE TABLE IF NOT EXISTS upload_batches (
  id SERIAL PRIMARY KEY,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  upload_mode VARCHAR(10) NOT NULL CHECK (upload_mode IN ('single', 'bulk')),
  total_files INTEGER NOT NULL CHECK (total_files >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id SERIAL PRIMARY KEY,
  batch_id INTEGER NOT NULL REFERENCES upload_batches(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL CHECK (file_size > 0),
  examination_id INTEGER REFERENCES examinations(id) ON DELETE SET NULL,
  processing_status VARCHAR(30) NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS extracted_marks (
  id SERIAL PRIMARY KEY,
  uploaded_file_id INTEGER NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  extracted_roll_number VARCHAR(50),
  extracted_name VARCHAR(150),
  extracted_marks NUMERIC(6, 2),
  attendance_status VARCHAR(20) CHECK (attendance_status IN ('present', 'absent', 'missing')),
  ocr_confidence NUMERIC(4, 3) CHECK (ocr_confidence >= 0 AND ocr_confidence <= 1),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'needs_resolution')),
  raw_extraction_ref JSONB,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marks (
  id SERIAL PRIMARY KEY,
  examination_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  marks_obtained NUMERIC(6, 2),
  attendance_status VARCHAR(20) NOT NULL CHECK (attendance_status IN ('present', 'absent', 'missing')),
  verified_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_upload_file_id INTEGER REFERENCES uploaded_files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (examination_id, student_id),
  CHECK (
    (attendance_status = 'present' AND marks_obtained IS NOT NULL AND marks_obtained >= 0)
    OR
    (attendance_status IN ('absent', 'missing') AND marks_obtained IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS marks_audit_logs (
  id SERIAL PRIMARY KEY,
  mark_id INTEGER NOT NULL REFERENCES marks(id) ON DELETE RESTRICT,
  examination_id INTEGER NOT NULL REFERENCES examinations(id) ON DELETE RESTRICT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE')),
  old_marks NUMERIC(6, 2),
  new_marks NUMERIC(6, 2),
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  upload_file_id INTEGER REFERENCES uploaded_files(id) ON DELETE SET NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS processing_events (
  id SERIAL PRIMARY KEY,
  uploaded_file_id INTEGER NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_term ON student_enrollments(term_id);
CREATE INDEX IF NOT EXISTS idx_subject_assignments_teacher ON subject_assignments(teacher_id, term_id);
CREATE INDEX IF NOT EXISTS idx_examinations_term ON examinations(term_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_batch ON uploaded_files(batch_id);
CREATE INDEX IF NOT EXISTS idx_extracted_marks_file ON extracted_marks(uploaded_file_id);
CREATE INDEX IF NOT EXISTS idx_marks_exam ON marks(examination_id);
CREATE INDEX IF NOT EXISTS idx_marks_student ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_audit_mark ON marks_audit_logs(mark_id);
CREATE INDEX IF NOT EXISTS idx_processing_events_file ON processing_events(uploaded_file_id);