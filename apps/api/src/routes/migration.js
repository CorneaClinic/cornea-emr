import { Router } from 'express';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { asyncHandler } from '../core/asyncHandler.js';
import { authenticate } from '../core/middleware/authenticate.js';
import { requireRole } from '../core/middleware/authorize.js';
import {
  runMigration,
  generateMigrationReportMarkdown,
  createExportBundle
} from '../services/migrationService.js';

const router = Router();

/** POST /api/v1/admin/migration/analyze — validate + duplicate scan (dry-run) */
router.post(
  '/analyze',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const report = await runMigration({
      bundle: req.body?.bundle ?? req.body,
      clinicId: req.user.clinicId,
      userId: req.user.sub,
      dryRun: true,
      skipExisting: true
    });
    res.json({ data: report, markdown: generateMigrationReportMarkdown(report) });
  })
);

/** POST /api/v1/admin/migration/import — upload export bundle to PostgreSQL */
router.post(
  '/import',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const dryRun = req.body?.dryRun === true;
    const report = await runMigration({
      bundle: req.body?.bundle ?? req.body,
      clinicId: req.user.clinicId,
      userId: req.user.sub,
      dryRun,
      skipExisting: req.body?.skipExisting !== false,
      forceUpdate: req.body?.forceUpdate === true
    });

    if (!dryRun) {
      const dir = join(process.cwd(), 'migrations', 'reports');
      await mkdir(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      await writeFile(join(dir, `migration-api-${stamp}.json`), JSON.stringify(report, null, 2));
    }

    res.json({
      data: report,
      markdown: generateMigrationReportMarkdown(report)
    });
  })
);

/** POST /api/v1/admin/migration/normalize — add checksums to export bundle */
router.post(
  '/normalize',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const bundle = createExportBundle(req.body?.bundle ?? req.body);
    res.json({ data: bundle });
  })
);

export default router;
