INSERT INTO subjects (subject_code, subject_name)
VALUES
  ('WD', 'Web Development'),
  ('DM', 'Discrete Mathematics'),
  ('DELD', 'Digital Electronics and Logic Design'),
  ('OS', 'Operating System'),
  ('JAVA', 'Java Programming'),
  ('BG', 'Bhagwad Gita')
ON CONFLICT (subject_code) DO NOTHING;