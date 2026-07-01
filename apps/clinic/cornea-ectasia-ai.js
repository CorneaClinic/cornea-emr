/**
 * Topography-integrated ectasia AI (Project 9)
 * Enhances laser refractive advisor + KC registry with Pentacam/KC registry metrics.
 */
(function (global) {
  'use strict';

  const MODEL_VERSION = 'ectasia-v1-topography';

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function num(v) {
    if (v == null || v === '') return null;
    const n = parseFloat(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function bool(v) {
    if (v === true || v === 'true' || v === 'Yes') return true;
    if (v === false || v === 'false' || v === 'No') return false;
    return null;
  }

  function apiOn() {
    return global.__corneaCloudMode && global.CorneaApi?.isEnabled?.();
  }

  function ev(workup, sec, key, eye) {
    return global.CorneaLaserRefractiveTaxonomy?.eyeVal?.(workup, sec, key, eye);
  }

  function eyeMetricsFromWorkup(workup, eye) {
    const side = eye.toLowerCase();
    return {
      badD: num(ev(workup, 'topography', 'badD', side)),
      kmax: num(ev(workup, 'corneal', 'kmax', side)) || num(ev(workup, 'topography', 'kmax', side)),
      k1: num(ev(workup, 'corneal', 'k1', side)),
      k2: num(ev(workup, 'corneal', 'k2', side)),
      thinnestPachy: num(ev(workup, 'corneal', 'pachymetry', side)) || num(ev(workup, 'topography', 'pachyMin', side)),
      posteriorElevation: num(ev(workup, 'topography', 'posteriorElevation', side)),
      keratoconus: ev(workup, 'corneal', 'keratoconus', side) === 'Yes',
      pmd: ev(workup, 'corneal', 'pmd', side) === 'Yes',
      progression: ev(workup, 'topography', 'progression', side) || 'None'
    };
  }

  function metricsFromWorkup(workup) {
    const planning = global.CorneaLaserRefractiveTaxonomy?.computePlanning?.(workup) || {};
    return {
      od: eyeMetricsFromWorkup(workup, 'od'),
      os: eyeMetricsFromWorkup(workup, 'os'),
      shared: {
        age: num(global.document?.getElementById?.('age')?.value),
        familyKc: ev(workup, 'assessment', 'familyKc', 'shared') === 'Yes',
        residualStromalBed: planning.residualStromalBed,
        ptaPercent: planning.ptaPercent
      }
    };
  }

  function latestTopoForEye(topoRows, eye) {
    const list = (topoRows || []).filter((t) => String(t.kcTopoEye || t.eye || '').toUpperCase() === eye);
    list.sort((a, b) => String(b.kcTopoCapturedAt || b.capturedAt || '').localeCompare(String(a.kcTopoCapturedAt || a.capturedAt || '')));
    return list[0] || null;
  }

  function metricsFromKcPatient(patient, topoRows) {
    const od = latestTopoForEye(topoRows, 'OD');
    const os = latestTopoForEye(topoRows, 'OS');
    const mapEye = (t) => t ? ({
      badD: num(t.kcTopoBadD ?? t.badD),
      kmax: num(t.kcTopoKmax ?? t.kmax),
      k1: num(t.kcTopoK1 ?? t.k1),
      k2: num(t.kcTopoK2 ?? t.k2),
      thinnestPachy: num(t.kcTopoThinnestPachy ?? t.thinnestPachy),
      posteriorElevation: num(t.kcTopoPosteriorElevation ?? t.posteriorElevation),
      keratoconus: /keratoconus/i.test(patient?.kcDiagnosis || ''),
      pmd: /pellucid/i.test(patient?.kcDiagnosis || ''),
      progression: t.kcTopoProgressionFlag || t.progressionFlag || 'None'
    }) : {};

    return {
      od: mapEye(od),
      os: mapEye(os),
      shared: {
        age: num(patient?.kcAge),
        familyKc: patient?.kcFamilyHistoryKc === 'Yes' || patient?.kcFamilyHistoryKc === true,
        familyHistoryKc: patient?.kcFamilyHistoryKc === 'Yes'
      }
    };
  }

  function metricsFromPentacamRow(row) {
    const eye = String(row.eye || 'OD').toLowerCase();
    const m = {
      badD: num(row.badD),
      kmax: num(row.kmax),
      k1: num(row.k1),
      k2: num(row.k2),
      thinnestPachy: num(row.thinnestPachy ?? row.pachyMin),
      posteriorElevation: num(row.posteriorElevation)
    };
    return {
      od: eye === 'od' ? m : {},
      os: eye === 'os' ? m : {},
      shared: {}
    };
  }

  function analyzeLocal(body) {
    const od = body.od || {};
    const os = body.os || {};
    const shared = body.shared || {};
    const scoreEye = (m, label) => {
      if (m.keratoconus || m.pmd) {
        return { eye: label, score: 100, tier: 'Contraindicated', factors: [m.keratoconus ? 'Keratoconus' : 'PMD'] };
      }
      let score = 0;
      const factors = [];
      const badD = num(m.badD);
      const kmax = num(m.kmax);
      const pachy = num(m.thinnestPachy);
      if (badD >= 2) { score += 25; factors.push(`BAD-D ${badD}`); }
      else if (badD >= 1.6) { score += 20; factors.push(`BAD-D ${badD}`); }
      else if (badD >= 1.3) { score += 12; factors.push(`BAD-D ${badD}`); }
      if (kmax >= 48) { score += 20; factors.push(`Kmax ${kmax} D`); }
      else if (kmax >= 47) { score += 15; factors.push(`Kmax ${kmax} D`); }
      else if (kmax >= 45) { score += 8; factors.push(`Kmax ${kmax} D`); }
      if (pachy < 450) { score += 20; factors.push(`Pachy ${pachy} µm`); }
      else if (pachy < 480) { score += 15; factors.push(`Pachy ${pachy} µm`); }
      else if (pachy < 500) { score += 8; factors.push(`Pachy ${pachy} µm`); }
      if (/confirmed/i.test(m.progression || '')) { score += 15; factors.push('Progression confirmed'); }
      return { eye: label, score: Math.min(100, score), tier: score >= 70 ? 'High risk' : score >= 40 ? 'Moderate risk' : score >= 20 ? 'Borderline' : 'Low risk', factors };
    };

    const perEye = [scoreEye(od, 'OD'), scoreEye(os, 'OS')];
    const worst = perEye.reduce((a, b) => (b.score > a.score ? b : a));
    let composite = worst.score;
    const riskFactors = [...worst.factors];
    const age = num(shared.age);
    if (age != null && age < 25) { composite += 10; riskFactors.push(`Age ${age}`); }
    if (shared.familyKc || shared.familyHistoryKc) { composite += 5; riskFactors.push('Family history KC'); }
    if (num(shared.residualStromalBed) < 250) riskFactors.push(`RSB ${shared.residualStromalBed} µm`);
    if (num(shared.ptaPercent) > 40) riskFactors.push(`PTA ${shared.ptaPercent}%`);
    composite = Math.min(100, composite);
    const riskTier = perEye.some((e) => e.tier === 'Contraindicated') ? 'Contraindicated'
      : composite >= 70 ? 'High risk'
      : composite >= 40 ? 'Moderate risk'
      : composite >= 20 ? 'Borderline' : 'Low risk';

    let cxlAction = 'Routine monitoring';
    let cxlUrgency = 'Low';
    if (riskTier === 'Contraindicated') { cxlAction = 'CXL indicated'; cxlUrgency = 'High'; }
    else if (composite >= 55) { cxlAction = 'CXL strongly recommended'; cxlUrgency = 'High'; }
    else if (composite >= 35) { cxlAction = 'CXL assessment advised'; cxlUrgency = 'Medium'; }
    else if (composite >= 20) { cxlAction = 'Enhanced surveillance'; cxlUrgency = 'Low'; }

    return {
      generatedAt: new Date().toISOString(),
      modelVersion: MODEL_VERSION,
      source: 'local',
      compositeScore: composite,
      riskTier,
      riskFactors,
      perEye,
      cxl: { action: cxlAction, urgency: cxlUrgency, rationale: riskFactors.join('; ') || 'Within limits', protocolHint: '' },
      disclaimer: 'Clinical decision support — surgeon makes final decision.'
    };
  }

  async function analyze(metrics, options) {
    options = options || {};
    if (apiOn() && !options.localOnly) {
      try {
        const res = await global.CorneaApi.request('/api/v1/ectasia-ai/analyze', {
          method: 'POST',
          body: JSON.stringify({ ...metrics, modelVersion: 'ectasia-v2-topography' })
        });
        return { ...res?.data, source: 'cloud' };
      } catch (err) {
        console.warn('[EctasiaAI] Cloud analyze failed, using local:', err.message);
      }
    }
    return analyzeLocal(metrics);
  }

  async function fetchRegistryInsights() {
    if (!apiOn()) return null;
    try {
      const res = await global.CorneaApi.request('/api/v1/ectasia-ai/registry-insights');
      return res?.data || null;
    } catch (_) {
      return null;
    }
  }

  function tierClass(tier) {
    if (tier === 'Contraindicated' || tier === 'High risk') return 'ectasia-tier-high';
    if (tier === 'Moderate risk' || tier === 'Borderline') return 'ectasia-tier-moderate';
    return 'ectasia-tier-low';
  }

  function renderPanel(analysis, options) {
    options = options || {};
    if (!analysis) return '<p class="form-hint">No topography metrics available for analysis.</p>';

    const rankHtml = (analysis.procedureRanking || []).map((r) =>
      `<li><strong>#${r.rank} ${escapeHtml(r.procedure)}</strong> (score ${r.score})${r.registryAdjusted ? ' <span class="ectasia-registry-badge">registry-informed</span>' : ''}</li>`
    ).join('');

    const perEyeHtml = (analysis.perEye || []).map((e) =>
      `<div class="ectasia-eye-row"><strong>${escapeHtml(e.eye)}</strong>: ${escapeHtml(e.tier)} (${e.score}/100)
        ${e.factors?.length ? `<ul>${e.factors.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>` : ''}</div>`
    ).join('');

    const reg = analysis.registryInsights;
    const regHtml = reg ? `<div class="ectasia-registry-insights">
      <strong>Institute registry context</strong>
      <p>${escapeHtml(reg.note || '')}</p>
      <p class="form-hint">${reg.topographyReadings || 0} topography readings · ${reg.cxlProcedures || 0} CXL procedures
        ${reg.cxlStableRate != null ? ` · CXL stability ${Math.round(reg.cxlStableRate * 100)}%` : ''}</p>
    </div>` : '';

    return `<div class="ectasia-ai-panel ${tierClass(analysis.riskTier)}" id="ectasiaAiPanel">
      <div class="ectasia-ai-header">
        <h4><i class="fa-solid fa-chart-area"></i> Topography Ectasia AI</h4>
        <span class="ectasia-score-badge">${analysis.compositeScore}/100</span>
      </div>
      <p class="ectasia-ai-disclaimer">${escapeHtml(analysis.disclaimer)}</p>
      <div class="ectasia-tier-banner">
        <strong>${escapeHtml(analysis.riskTier)}</strong>
        <span>${escapeHtml(analysis.source === 'cloud' ? 'Cloud + registry' : 'Local scoring')}</span>
      </div>
      <div class="ectasia-cxl-rec">
        <strong>CXL:</strong> ${escapeHtml(analysis.cxl?.action || '—')}
        <span class="ectasia-urgency ectasia-urgency-${(analysis.cxl?.urgency || 'low').toLowerCase()}">${escapeHtml(analysis.cxl?.urgency || '')}</span>
        <p>${escapeHtml(analysis.cxl?.rationale || '')}</p>
        ${analysis.cxl?.protocolHint ? `<p class="form-hint">${escapeHtml(analysis.cxl.protocolHint)}</p>` : ''}
      </div>
      ${perEyeHtml ? `<div class="ectasia-per-eye">${perEyeHtml}</div>` : ''}
      ${analysis.riskFactors?.length ? `<div class="ectasia-factors"><strong>Key factors</strong><ul>${analysis.riskFactors.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul></div>` : ''}
      ${rankHtml ? `<div class="ectasia-proc-rank"><strong>Procedure ranking (registry-adjusted)</strong><ol>${rankHtml}</ol></div>` : ''}
      ${regHtml}
      ${options.refreshButton !== false ? '<button type="button" class="btn-secondary btn-sm ectasia-refresh-btn"><i class="fa-solid fa-rotate"></i> Re-analyze</button>' : ''}
    </div>`;
  }

  function mergeIntoAdvisorReport(report, analysis) {
    if (!report || !analysis) return report;
    const enhanced = { ...report };
    enhanced.ectasiaAi = analysis;
    enhanced.ectasiaRisk = {
      level: analysis.riskTier,
      reasons: analysis.riskFactors || [],
      reasoning: (analysis.riskFactors || []).join('; '),
      compositeScore: analysis.compositeScore
    };
    if (analysis.procedureRanking?.length) {
      const procMap = {};
      analysis.procedureRanking.forEach((r) => { procMap[r.procedure] = r; });
      enhanced.rankedProcedures = (enhanced.rankedProcedures || []).map((r) => {
        const adj = procMap[r.procedure];
        return adj ? { ...r, ectasiaScore: adj.score, registryAdjusted: adj.registryAdjusted } : r;
      });
      const topAi = analysis.procedureRanking[0];
      if (topAi && analysis.riskTier !== 'Low risk') {
        enhanced.recommendations = enhanced.recommendations || [];
        enhanced.recommendations.unshift({
          id: 'ectasia-ai-cxl',
          category: 'ectasia',
          finding: `Topography AI: ${analysis.riskTier} (${analysis.compositeScore}/100)`,
          interpretation: analysis.cxl?.action || 'Ectasia assessment',
          reasoning: analysis.cxl?.rationale || analysis.riskFactors?.join('; '),
          modification: analysis.cxl?.protocolHint || analysis.cxl?.action,
          expectedBenefit: 'Registry-informed ectasia risk mitigation',
          confidence: analysis.riskTier.includes('High') || analysis.riskTier === 'Contraindicated' ? 'High' : 'Medium'
        });
      }
    }
    if (analysis.cxl) {
      enhanced.surgicalPlan = { ...enhanced.surgicalPlan, crosslinking: analysis.cxl.urgency !== 'Low' || analysis.compositeScore >= 30 };
    }
    return enhanced;
  }

  global.CorneaEctasiaAI = {
    MODEL_VERSION,
    metricsFromWorkup,
    metricsFromKcPatient,
    metricsFromPentacamRow,
    analyze,
    analyzeLocal,
    fetchRegistryInsights,
    renderPanel,
    mergeIntoAdvisorReport
  };
})(typeof window !== 'undefined' ? window : globalThis);
