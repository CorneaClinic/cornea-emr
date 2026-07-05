import { getMediaAdminStats, verifyMediaIntegrity } from './mediaAdminService.js';
import { env } from '../config/env.js';

/**
 * Cloud-side DR status (media + storage). Database backups are clinic-PC / DO managed.
 * @param {string} clinicId
 */
export async function getDrStatus(clinicId) {
  const [mediaStats, integrity] = await Promise.all([
    getMediaAdminStats(clinicId),
    verifyMediaIntegrity(clinicId, 50)
  ]);

  return {
    generatedAt: new Date().toISOString(),
    storageProvider: env.media.storageProvider,
    bucket: env.media.s3.bucket || null,
    media: {
      totalCount: mediaStats.totalCount,
      totalBytes: mediaStats.totalBytes,
      uploadFailures7d: mediaStats.uploadFailures7d,
      orphanedLinks: mediaStats.orphanedLinks?.length || 0,
      backupNote: mediaStats.backupNote
    },
    mediaIntegritySample: {
      checked: integrity.checked,
      missing: integrity.missing,
      ok: integrity.ok
    },
    databaseBackup: {
      responsibility: 'clinic_pc_and_do_managed',
      clinicScript: 'scripts/backup-production.ps1',
      verifyScript: 'npm run verify:backup-dr',
      doManagedBackups: true
    },
    targets: {
      rpoHours: 24,
      rtoHours: 4,
      drillIntervalDays: 30
    }
  };
}
