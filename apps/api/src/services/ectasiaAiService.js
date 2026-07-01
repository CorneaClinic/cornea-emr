import { query } from '../db/pool.js';
import { ValidationError } from '../core/errors.js';

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(v) {
  if (v === true || v === 'true' || v === 'Yes' || v === 'yes') return true;
  if (v === false || v === 'false' || v === 'No' || v === 'no') return false;
  return null;
}

function riskTier(score, hardStop) {
  if (hardStop) return 'Contraindicated';
  if (score >= 70) return 'High risk';
  if (score >= 40) return 'Moderate risk';
  if (score >= 20) return 'Borderline';
  return 'Low risk';
}

function cxlRecommendation(score, ctx) {
  if (ctx.keratoconus || ctx.pmd) {
    return {
      action: 'CXL indicated',
      urgency: 'High',
      rationale: 'Established ectatic disease — CXL is standard of care before any refractive procedure.',
      protocolHint: 'Standard Dresden protocol or accelerated per institute protocol'
    };
  }
  if (ctx.progression === 'Confirmed' || score >= 55) {
    return {
      action: 'CXL strongly recommended',
      urgency: 'High',
      rationale: 'Documented progression or high composite ectasia score.',
      protocolHint: 'CXL ± topography-guided PRK after stabilization'
    };
  }
  if (score >= 35 || (ctx.badD != null && ctx.badD >= 1.3)) {
    return {
      action: 'CXL assessment advised',
      urgency: 'Medium',
      rationale: 'Borderline biomechanics — consider prophylactic CXL before LASIK/SMILE.',
      protocolHint: 'Serial topography 3–6 months; CXL if progression'
    };
  }
  if (score >= 20) {
    return {
      action: 'Enhanced surveillance',
      urgency: 'Low',
      rationale: 'Mild risk factors — repeat topography and pachymetry before surgery.',
      protocolHint: 'PRK or SMILE preferred over LASIK if proceeding'
    };
  }
  return {
    action: 'Routine monitoring',
    urgency: 'Low',
    rationale: 'Topography metrics within acceptable limits for refractive screening.',
    protocolHint: 'Standard pre-op work-up'
  };
}

function buildProcedureRanking(score, tier, ctx, registry) {
  const PROC = [
    'No surgery',
    'ICL',
    'PRK',
    'TransPRK',
    'SMILE',
    'Crosslinking plus PRK',
    'Femto LASIK',
    'LASIK'
  ];
  const scores = {};
  PROC.forEach((p) => { scores[p] = 20; });

  if (tier === 'Contraindicated') {
    scores['No surgery'] = 100;
    scores.LASIK = -40;
    scores['Femto LASIK'] = -40;
    scores.SMILE = -30;
    scores.ICL = 35;
    scores['Crosslinking plus PRK'] = 45;
    return rankList(scores, registry);
  }

  if (tier === 'High risk') {
    scores['No surgery'] = 60;
    scores.ICL = 55;
    scores['Crosslinking plus PRK'] = 50;
    scores.PRK = 40;
    scores.TransPRK = 38;
    scores.SMILE = 15;
    scores.LASIK = -20;
    scores['Femto LASIK'] = -15;
  } else if (tier === 'Moderate risk') {
    scores.PRK = 50;
    scores.TransPRK = 48;
    scores.SMILE = 42;
    scores['Crosslinking plus PRK'] = 45;
    scores.ICL = 40;
    scores['Femto LASIK'] = 25;
    scores.LASIK = 18;
  } else if (tier === 'Borderline') {
    scores.SMILE = 48;
    scores.PRK = 46;
    scores.TransPRK = 44;
    scores['Femto LASIK'] = 40;
    scores.LASIK = 35;
    scores.ICL = 38;
  } else {
    scores.SMILE = 50;
    scores['Femto LASIK'] = 48;
    scores.LASIK = 46;
    scores.PRK = 42;
    scores.TransPRK = 40;
    scores.ICL = 35;
  }

  if (ctx.residualStromalBed != null && ctx.residualStromalBed < 280) {
    scores.LASIK -= 15;
    scores['Femto LASIK'] -= 10;
    scores.PRK += 8;
  }
  if (ctx.ptaPercent != null && ctx.ptaPercent > 40) {
    scores.LASIK -= 20;
    scores.SMILE -= 10;
    scores.PRK += 10;
  }

  if (registry?.cxlStableRate != null && registry.cxlStableRate >= 0.7 && score >= 30) {
    scores['Crosslinking plus PRK'] += 12;
  }

  return rankList(scores, registry);
}

function rankList(scores, registry) {
  return Object.entries(scores)
    .map(([procedure, score]) => ({
      procedure,
      score,
      registryAdjusted: registry?.sampleSize > 10 && procedure === 'Crosslinking plus PRK'
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

export function analyzeEctasiaMetricsV2(body = {}) {
  const v1 = analyzeEctasiaMetrics(body);
  const od = body.od || body.metrics?.od || {};
  const os = body.os || body.metrics?.os || {};
  const shared = body.shared || body.metrics?.shared || {};

  let composite = v1.compositeScore;
  const v2Factors = [];

  const abcdOd = String(od.abcdGrade ?? od.abcd_grade ?? '').toUpperCase();
  const abcdOs = String(os.abcdGrade ?? os.abcd_grade ?? '').toUpperCase();
  const abcdWorst = [abcdOd, abcdOs].includes('D') ? 'D'
    : [abcdOd, abcdOs].includes('C') ? 'C'
      : [abcdOd, abcdOs].includes('B') ? 'B'
        : [abcdOd, abcdOs].includes('A') ? 'A' : '';
  if (abcdWorst === 'D') { composite += 12; v2Factors.push('ABCD grade D'); }
  else if (abcdWorst === 'C') { composite += 8; v2Factors.push('ABCD grade C'); }
  else if (abcdWorst === 'B') { composite += 4; v2Factors.push('ABCD grade B'); }

  const isv = Math.max(num(od.isv ?? od.ISV), num(os.isv ?? os.ISV)) || null;
  if (isv != null && isv > 40) { composite += 6; v2Factors.push(`ISV ${isv}`); }

  const iha = Math.max(num(od.iha ?? od.IHA), num(os.iha ?? os.IHA)) || null;
  if (iha != null && iha > 20) { composite += 5; v2Factors.push(`IHA ${iha}°`); }

  const art = Math.max(num(od.art ?? od.ART), num(os.art ?? os.ART)) || null;
  if (art != null && art < 400) { composite += 8; v2Factors.push(`ART ${art} µm`); }

  if (bool(shared.ocularSurfaceDryEye) === true) {
    composite += 5;
    v2Factors.push('Significant dry eye on work-up');
  }

  composite = Math.min(100, composite);
  const tier = v1.riskTier === 'Contraindicated' ? 'Contraindicated' : riskTier(composite, false);

  return {
    ...v1,
    modelVersion: 'ectasia-v2-topography',
    compositeScore: composite,
    riskTier: tier,
    riskFactors: [...v1.riskFactors, ...v2Factors],
    v2Enhancements: v2Factors,
    disclaimer: 'Ectasia AI v2 — adds ABCD, ISV/IHA/ART and dry-eye modifiers. Clinical decision support only.'
  };
}

export function analyzeEctasiaMetrics(body = {}) {
  const od = body.od || body.metrics?.od || {};
  const os = body.os || body.metrics?.os || {};
  const shared = body.shared || body.metrics?.shared || {};

  const eyes = ['od', 'os'].map((side) => {
    const m = side === 'od' ? od : os;
    const badD = num(m.badD ?? m.bad_d);
    const kmax = num(m.kmax ?? m.k_max);
    const k1 = num(m.k1);
    const k2 = num(m.k2);
    const pachy = num(m.thinnestPachy ?? m.thinnest_pachy ?? m.pachyMin);
    const postElev = num(m.posteriorElevation ?? m.posterior_elevation);
    const keratoconus = bool(m.keratoconus) === true;
    const pmd = bool(m.pmd) === true;
    const progression = String(m.progression ?? m.progressionFlag ?? 'None');
    const factors = [];
    let score = 0;

    if (keratoconus || pmd) {
      return {
        eye: side.toUpperCase(),
        score: 100,
        tier: 'Contraindicated',
        factors: [keratoconus ? 'Keratoconus confirmed' : 'PMD confirmed'],
        metrics: { badD, kmax, pachy, k1, k2 }
      };
    }

    if (badD != null) {
      if (badD >= 2.0) { score += 25; factors.push(`BAD-D ${badD} (very high)`); }
      else if (badD >= 1.6) { score += 20; factors.push(`BAD-D ${badD} (high)`); }
      else if (badD >= 1.3) { score += 12; factors.push(`BAD-D ${badD} (borderline)`); }
      else if (badD >= 1.0) { score += 6; factors.push(`BAD-D ${badD}`); }
    }
    if (kmax != null) {
      if (kmax >= 48) { score += 20; factors.push(`Kmax ${kmax} D`); }
      else if (kmax >= 47) { score += 15; factors.push(`Kmax ${kmax} D`); }
      else if (kmax >= 45) { score += 8; factors.push(`Kmax ${kmax} D`); }
    }
    if (pachy != null) {
      if (pachy < 450) { score += 20; factors.push(`Thinnest pachymetry ${pachy} µm`); }
      else if (pachy < 480) { score += 15; factors.push(`Thinnest pachymetry ${pachy} µm`); }
      else if (pachy < 500) { score += 8; factors.push(`Thinnest pachymetry ${pachy} µm`); }
    }
    if (k1 != null && k2 != null && Math.abs(k1 - k2) >= 2) {
      score += 8;
      factors.push(`K asymmetry ${Math.abs(k1 - k2).toFixed(1)} D`);
    }
    if (postElev != null && postElev > 20) {
      score += 8;
      factors.push(`Posterior elevation ${postElev} µm`);
    }
    if (/confirmed/i.test(progression)) {
      score += 15;
      factors.push('Topographic progression confirmed');
    } else if (/suspect/i.test(progression)) {
      score += 8;
      factors.push('Topographic progression suspect');
    }

    return {
      eye: side.toUpperCase(),
      score: Math.min(100, score),
      tier: riskTier(score, false),
      factors,
      metrics: { badD, kmax, pachy, k1, k2, postElev }
    };
  });

  const age = num(shared.age ?? body.age);
  const familyKc = bool(shared.familyKc ?? shared.familyHistoryKc) === true;
  const rsb = num(shared.residualStromalBed ?? body.residualStromalBed);
  const pta = num(shared.ptaPercent ?? body.ptaPercent);
  const keratoconus = eyes.some((e) => e.tier === 'Contraindicated');
  const worst = eyes.reduce((a, b) => (b.score > a.score ? b : a), eyes[0]);

  let composite = worst.score;
  const globalFactors = [...worst.factors];
  if (age != null && age < 25) { composite += 10; globalFactors.push(`Age ${age} (<25)`); }
  else if (age != null && age < 30) { composite += 6; globalFactors.push(`Age ${age} (<30)`); }
  if (familyKc) { composite += 5; globalFactors.push('Family history of KC'); }
  if (rsb != null && rsb < 220) { composite += 25; globalFactors.push(`RSB ${rsb} µm critically low`); }
  else if (rsb != null && rsb < 250) { composite += 15; globalFactors.push(`RSB ${rsb} µm low`); }
  if (pta != null && pta > 40) { composite += 15; globalFactors.push(`PTA ${pta}% high`); }

  composite = Math.min(100, composite);
  const tier = keratoconus ? 'Contraindicated' : riskTier(composite, false);

  const ctx = {
    keratoconus,
    pmd: bool(shared.pmd) === true,
    progression: worst.factors.find((f) => /progression/i.test(f)) ? 'Confirmed' : 'None',
    badD: Math.max(num(od.badD), num(os.badD)) || null,
    residualStromalBed: rsb,
    ptaPercent: pta
  };

  return {
    generatedAt: new Date().toISOString(),
    modelVersion: 'ectasia-v1-topography',
    compositeScore: composite,
    riskTier: tier,
    riskFactors: globalFactors,
    perEye: eyes,
    cxl: cxlRecommendation(composite, ctx),
    disclaimer: 'Clinical decision support — surgeon makes final decision. Not a validated ML classifier.'
  };
}

export async function getRegistryInsights(clinicId) {
  const { rows: topoRows } = await query(
    `
      SELECT
        COUNT(*)::int AS total_readings,
        COUNT(*) FILTER (WHERE bad_d >= 1.3)::int AS elevated_bad_d,
        COUNT(*) FILTER (WHERE progression_flag IN ('Suspect', 'Confirmed'))::int AS progression_flagged,
        AVG(bad_d)::float AS avg_bad_d,
        AVG(kmax)::float AS avg_kmax
      FROM kc_topography_readings
     WHERE clinic_id = $1
    `,
    [clinicId]
  );

  const { rows: cxlRows } = await query(
    `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE outcome IN ('Stable', 'Halted progression', 'Improved'))::int AS stable,
        COUNT(*) FILTER (WHERE outcome = 'Progression')::int AS progressed,
        COUNT(*) FILTER (WHERE outcome = 'Pending')::int AS pending
      FROM kc_cxl_procedures
     WHERE clinic_id = $1
    `,
    [clinicId]
  );

  const topo = topoRows[0] || {};
  const cxl = cxlRows[0] || {};
  const decided = (cxl.total || 0) - (cxl.pending || 0);
  const cxlStableRate = decided > 0 ? (cxl.stable || 0) / decided : null;

  return {
    topographyReadings: topo.total_readings || 0,
    elevatedBadDCount: topo.elevated_bad_d || 0,
    progressionFlagged: topo.progression_flagged || 0,
    avgBadD: topo.avg_bad_d != null ? Math.round(topo.avg_bad_d * 100) / 100 : null,
    avgKmax: topo.avg_kmax != null ? Math.round(topo.avg_kmax * 10) / 10 : null,
    cxlProcedures: cxl.total || 0,
    cxlStableRate,
    cxlProgressionRate: decided > 0 ? (cxl.progressed || 0) / decided : null,
    sampleSize: topo.total_readings || 0,
    note: decided >= 10
      ? `Institute CXL stability rate ${Math.round((cxlStableRate || 0) * 100)}% (${decided} completed outcomes) informs CXL-plus-PRK ranking.`
      : 'Limited CXL outcome data — procedure ranking uses literature-based weights.'
  };
}

export async function analyzeWithRegistry(clinicId, body) {
  const useV2 = String(body.modelVersion || '').includes('v2') || body.useV2 === true;
  const base = useV2 ? analyzeEctasiaMetricsV2(body) : analyzeEctasiaMetrics(body);
  const registry = await getRegistryInsights(clinicId);
  const ctx = {
    keratoconus: base.riskTier === 'Contraindicated',
    pmd: false,
    progression: base.perEye?.some((e) => e.factors?.some((f) => /confirmed/i.test(f))) ? 'Confirmed' : 'None',
    badD: Math.max(
      num(body.od?.badD),
      num(body.os?.badD)
    ) || null,
    residualStromalBed: num(body.shared?.residualStromalBed ?? body.residualStromalBed),
    ptaPercent: num(body.shared?.ptaPercent ?? body.ptaPercent)
  };
  const ranked = buildProcedureRanking(
    base.compositeScore,
    base.riskTier,
    ctx,
    registry
  );
  return {
    ...base,
    registryInsights: registry,
    procedureRanking: ranked
  };
}

export function validateAnalyzeBody(body) {
  if (!body || typeof body !== 'object') {
    throw new ValidationError('Request body required');
  }
  return body;
}
