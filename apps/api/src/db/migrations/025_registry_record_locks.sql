-- Cornea EMR — extend record edit locks to registry entities (Project 4)

ALTER TABLE record_edit_locks
  DROP CONSTRAINT IF EXISTS record_edit_locks_entity_type_check;

ALTER TABLE record_edit_locks
  ADD CONSTRAINT record_edit_locks_entity_type_check
  CHECK (entity_type IN (
    'visit',
    'kp_patient',
    'kp_tissue',
    'kc_patient',
    'keratitis_case',
    'dry_eye_case'
  ));
