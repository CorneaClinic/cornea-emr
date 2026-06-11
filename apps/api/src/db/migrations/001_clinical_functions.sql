-- Cornea EMR — shared database functions and tenant-integrity triggers (v1.0)
-- Applied after 000_foundation.sql
--
-- Note: This schema uses clinics / visits naming (production architecture).
-- Legacy v0.1 tables (organizations, encounters, kp_*) live in src/legacy/migrations/
-- and must not coexist with these tables on the same database.

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Multi-tenant integrity: child rows must share the visit's clinic_id
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_visit_patient_clinic()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  patient_clinic_id UUID;
BEGIN
  SELECT clinic_id
    INTO patient_clinic_id
    FROM patients
   WHERE id = NEW.patient_id;

  IF patient_clinic_id IS NULL THEN
    RAISE EXCEPTION 'patient % not found', NEW.patient_id;
  END IF;

  IF NEW.clinic_id IS DISTINCT FROM patient_clinic_id THEN
    RAISE EXCEPTION 'visit clinic_id must match patient clinic_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_child_clinic_matches_visit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  visit_clinic_id UUID;
BEGIN
  SELECT clinic_id
    INTO visit_clinic_id
    FROM visits
   WHERE id = NEW.visit_id;

  IF visit_clinic_id IS NULL THEN
    RAISE EXCEPTION 'visit % not found', NEW.visit_id;
  END IF;

  IF NEW.clinic_id IS DISTINCT FROM visit_clinic_id THEN
    RAISE EXCEPTION '% clinic_id must match visit clinic_id', TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Audit log immutability (append-only)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION audit_logs_deny_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; % operations are not permitted', TG_OP;
END;
$$;
