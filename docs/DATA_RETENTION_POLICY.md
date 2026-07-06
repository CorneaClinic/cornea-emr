# Data Retention Policy

**Cornea Clinic EMR — VisionEMR**  
**Version:** 1.0 (Project 9)  
**Effective:** 2026-07-06  
**Owner:** Clinical Governance Committee / CMIO

---

## Purpose

Define how long clinical and operational data is retained, archived, and destroyed to meet medicolegal obligations and operational needs.

---

## Clinical records

| Data type | Retention | Storage | Notes |
|-----------|-----------|---------|-------|
| Patient demographics & visits | **10 years** minimum from last encounter | PostgreSQL (cloud) + encrypted local IndexedDB | Align with institutional medical records policy |
| Prescriptions & clinical notes | Same as parent visit | Visit JSONB + audit trail | Immutable audit on mutations |
| Registry entries (KC, keratitis, dry eye, KP) | **10 years** from case closure | PostgreSQL | Export before archival |
| Drawings & clinical media | Same as linked visit/patient | S3/Spaces + `media_assets` | Checksum dedup; soft delete only |

**Legal hold:** Suspend routine deletion when litigation, complaint, or regulatory inquiry is active.

---

## Audit logs

| Data type | Retention | Storage |
|-----------|-----------|---------|
| `audit_logs` (cloud) | **7 years** | PostgreSQL append-only |
| Local device audit (IndexedDB) | Until next cloud sync + **90 days** local | Clinic workstation |

Review cadence: see `docs/AUDIT_REVIEW_PROCESS.md`.

---

## Backups

| Data type | Retention | Reference |
|-----------|-----------|-----------|
| Production PostgreSQL dumps | **35 days** on-site + off-site encrypted copy | `docs/BACKUP_RECOVERY.md`, Project 5 |
| DigitalOcean managed DB snapshots | Per DO plan | Operator dashboard |
| Media object storage | Indefinite while clinical record retained | Bucket lifecycle optional after record destruction |

---

## Media

- Clinical images, PDFs, and DICOM linked to visits follow **clinical record** retention.
- Teaching library assets require **documented patient consent** before publication (`docs/CONSENT_MANAGEMENT.md`).
- Deleted media: soft delete in DB; hard delete from object storage only after retention period and governance approval.

---

## Sync and operational logs

| Data type | Retention |
|-----------|-----------|
| `sync_logs` / `client_mutations` | **90 days** online; archive to cold storage if needed |
| Application logs (API) | **90 days** (DigitalOcean); export to SIEM if required |

---

## Destruction

1. Governance Committee approves destruction schedule annually.
2. Database rows: anonymise or purge per approved list; verify backups rotated.
3. Object storage: delete keys after DB references removed.
4. Local clinic PCs: `cornea-offline-security.js` idle timeout; recommend disk encryption.

---

## Operator

```powershell
# Verify backup retention (Project 5)
npm run verify:backup-dr

# Audit sample for retention compliance review
npm run medicolegal:audit-review
```

**Sign-off:** Clinical Governance Committee (annual review).

---

## Related

- `docs/CLINICAL_GOVERNANCE.md`
- `docs/BACKUP_RECOVERY.md`
- `docs/projects/PROJECT_05_BACKUP_DR.md`
