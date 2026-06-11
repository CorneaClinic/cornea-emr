-- 011: Keyset-pagination indexes for sync pull on keratoplasty tables.
-- Sync pull filters WHERE clinic_id = $1 AND (updated_at, id) > (...) ORDER BY
-- updated_at, id — visits already have idx_visits_clinic_updated, but the KP
-- tables were missing an equivalent.

CREATE INDEX IF NOT EXISTS idx_keratoplasty_patients_clinic_updated
    ON keratoplasty_patients (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS idx_corneal_tissues_clinic_updated
    ON corneal_tissues (clinic_id, updated_at, id);
