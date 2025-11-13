-- Enforce unique subject names per grade level
ALTER TABLE "Subject"
  ADD CONSTRAINT "Subject_grade_level_id_subject_name_key"
  UNIQUE ("grade_level_id", "subject_name");

-- Enforce unique topic names per subject
ALTER TABLE "Topic"
  ADD CONSTRAINT "Topic_subject_id_topic_name_key"
  UNIQUE ("subject_id", "topic_name");
