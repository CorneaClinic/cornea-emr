import { seedDefaultClinicAndAdmin } from '../services/authService.js';
import { closePool } from '../db/pool.js';
import { logger } from '../core/logger.js';

async function main() {
  const result = await seedDefaultClinicAndAdmin();
  if (result.seeded) {
    logger.info(
      { clinicId: result.clinicId, adminEmail: result.adminEmail },
      'Seeded default clinic and admin user'
    );
    if (result.generatedPassword) {
      console.log('\n=== ONE-TIME ADMIN PASSWORD (save now, change on first login) ===');
      console.log(result.generatedPassword);
      console.log('================================================================\n');
    }
  } else {
    logger.info({ reason: result.reason }, 'Seed skipped');
  }
  await closePool();
}

main().catch((err) => {
  logger.error({ err }, 'Seed failed');
  process.exit(1);
});
