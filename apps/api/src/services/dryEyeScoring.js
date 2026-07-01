/**
 * OSD composite index (0–100) — aligns with laser refractive dry-eye CDS weights (P7).
 * @param {object} input
 */
export function computeOsdIndexScore(input = {}) {
  const tbut = Math.min(
    num(input.tbutOd) ?? 99,
    num(input.tbutOs) ?? 99
  );
  const schirmer = Math.min(
    num(input.schirmerOd) ?? 99,
    num(input.schirmerOs) ?? 99
  );
  const osdi = num(input.osdiScore) ?? 0;
  const deq5 = num(input.deq5Score) ?? 0;
  const severity = String(input.severity || '').toLowerCase();

  let score = 0;
  if (severity === 'severe') score += 25;
  else if (severity === 'moderate') score += 15;
  else if (severity === 'mild') score += 8;

  if (osdi >= 33) score += 20;
  else if (osdi >= 23) score += 12;
  else if (osdi >= 13) score += 6;

  if (deq5 >= 12) score += 10;
  else if (deq5 >= 6) score += 5;

  if (tbut < 5) score += 18;
  else if (tbut < 8) score += 10;
  else if (tbut < 10) score += 5;

  if (schirmer < 5) score += 18;
  else if (schirmer < 10) score += 10;
  else if (schirmer < 15) score += 5;

  const mgd = String(input.mgdGrade || '').toLowerCase();
  if (mgd.includes('severe')) score += 8;
  else if (mgd.includes('moderate')) score += 5;

  const bleph = String(input.blepharitis || '').toLowerCase();
  if (bleph.includes('moderate') || bleph.includes('severe')) score += 5;

  return Math.min(100, Math.round(score));
}

/**
 * @param {number} osdIndex
 */
export function osdIndexToSeverity(osdIndex) {
  if (osdIndex >= 50) return 'Severe';
  if (osdIndex >= 30) return 'Moderate';
  if (osdIndex >= 15) return 'Mild';
  return 'Normal';
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
