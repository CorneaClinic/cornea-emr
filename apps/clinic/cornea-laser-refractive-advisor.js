/**
 * AI Laser Refractive Surgery Planner — clinical decision support.
 * Surgeon always makes final decision. Never auto-modifies records.
 */
(function (global) {
  'use strict';

  const T = () => global.CorneaLaserRefractiveTaxonomy || {};
  const LEARNING_KEY = 'corneaLrAiLearning';

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function num(v) { return T().num?.(v) ?? (parseFloat(String(v || '').replace(/[^\d.-]/g, '')) || null); }
  function ev(w, sec, key, eye) { return T().eyeVal?.(w, sec, key, eye); }

  function mkRec(id, category, finding, interpretation, reasoning, modification, benefit, confidence) {
    return { id, category, finding, interpretation, reasoning, modification, expectedBenefit: benefit, confidence: confidence || 'Medium' };
  }

  function getAge() {
    return num(global.document?.getElementById?.('age')?.value);
  }

  function analyzeDryEyeRisk(workup) {
    const od = workup.ocularSurface?.od || {};
    const os = workup.ocularSurface?.os || {};
    const tbut = Math.min(num(od.tbut) || 99, num(os.tbut) || 99);
    const schirmer = Math.min(num(od.schirmer) || 99, num(os.schirmer) || 99);
    const drySev = [od.dryEyeSeverity, os.dryEyeSeverity];
    const mgd = [od.mgd, os.mgd];
    const bleph = [od.blepharitis, os.blepharitis];
    const score = (drySev.includes('Severe') ? 3 : drySev.includes('Moderate') ? 2 : 0)
      + (tbut < 5 ? 2 : tbut < 8 ? 1 : 0)
      + (schirmer < 5 ? 2 : schirmer < 10 ? 1 : 0)
      + (mgd.includes('Moderate') || mgd.includes('Severe') ? 1 : 0)
      + (bleph.includes('Moderate') || bleph.includes('Severe') ? 1 : 0)
      + (ev(workup, 'assessment', 'autoimmune', 'shared') === 'Yes' ? 2 : 0)
      + (ev(workup, 'assessment', 'clHistory', 'shared') === 'Current wearer' ? 1 : 0);
    let level = 'Suitable';
    let rec = 'Proceed — standard dry eye counseling';
    if (score >= 6) { level = 'Contraindicated'; rec = 'Treat ocular surface disease before considering surgery'; }
    else if (score >= 4) { level = 'Treat first'; rec = 'Optimize tear film 4–8 weeks pre-op (MGD, blepharitis, lubricants)'; }
    else if (score >= 2) { level = 'Proceed with caution'; rec = 'Pre-op lubrication; prefer surface-friendly procedure (SMILE/PRK vs LASIK)'; }
    return { level, score, recommendation: rec, reasoning: `TBUT ~${tbut}s, Schirmer ~${schirmer}mm, dry eye severity profile.` };
  }

  function analyzeEctasiaRisk(workup, planning, risk) {
    const pachy = planning.centralPachymetry;
    const badD = Math.max(num(ev(workup, 'topography', 'badD', 'od')) || 0, num(ev(workup, 'topography', 'badD', 'os')) || 0);
    const kc = ev(workup, 'corneal', 'keratoconus', 'od') === 'Yes' || ev(workup, 'corneal', 'keratoconus', 'os') === 'Yes';
    const pmd = ev(workup, 'corneal', 'pmd', 'od') === 'Yes' || ev(workup, 'corneal', 'pmd', 'os') === 'Yes';
    const familyKc = ev(workup, 'assessment', 'familyKc', 'shared') === 'Yes';
    const progression = [ev(workup, 'topography', 'progression', 'od'), ev(workup, 'topography', 'progression', 'os')].includes('Confirmed');
    let level = 'Low risk';
    const reasons = [];
    if (kc || pmd) { level = 'Contraindicated'; reasons.push(kc ? 'Keratoconus confirmed' : 'PMD confirmed'); }
    else if (planning.residualStromalBed != null && planning.residualStromalBed < 220) { level = 'Contraindicated'; reasons.push(`RSB ${planning.residualStromalBed} µm critically low`); }
    else if (badD >= 1.6 || planning.ptaPercent > 40) { level = 'High risk'; reasons.push(`BAD-D ${badD}, PTA ${planning.ptaPercent}%`); }
    else if (pachy != null && pachy < 480 || planning.residualStromalBed < 250 || badD >= 1.3) { level = 'Moderate risk'; reasons.push(`Pachymetry ${pachy} µm, RSB ${planning.residualStromalBed} µm, BAD-D ${badD}`); }
    else reasons.push('Topography and pachymetry within acceptable limits');
    if (familyKc) reasons.push('Family history of keratoconus');
    if (progression) reasons.push('Documented topographic progression');
    return { level, reasons, reasoning: reasons.join('; ') };
  }

  function rankProcedures(workup, planning, risk, ectasia, dryEye) {
    const PROC = ['LASIK', 'Femto LASIK', 'SMILE', 'PRK', 'TransPRK', 'PTK', 'ICL', 'RLE', 'Crosslinking plus PRK', 'No surgery'];
    const scores = {};
    const suit = planning.suitability || {};
    PROC.forEach((p) => {
      let s = 0;
      const sv = suit[p] || suit[p.replace('Crosslinking plus PRK', 'PRK')];
      if (sv === 'Suitable' || sv === 'Preferred') s += 40;
      else if (sv === 'Caution' || sv === 'Consider') s += 25;
      else if (sv === 'Consider if presbyopia' || sv === 'Consider if irregular astigmatism') s += 15;
      else if (sv === 'Not indicated') s += 0;
      else if (sv === 'Not suitable' || sv === 'Required') s -= 20;
      scores[p] = s;
    });
    if (ectasia.level === 'Contraindicated') { scores['No surgery'] = 100; scores.LASIK = -50; scores.SMILE = -50; }
    if (dryEye.level === 'Treat first') { scores.PRK += 10; scores.SMILE += 5; scores.LASIK -= 10; }
    if (planning.recommendedProcedure) scores[planning.recommendedProcedure] = (scores[planning.recommendedProcedure] || 0) + 15;
    const ranked = PROC.map((p) => ({ procedure: p, score: scores[p] || 0, suitability: suit[p] || '—' }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    return ranked.slice(0, 5).map((r, i) => ({
      rank: i + 1,
      procedure: r.procedure,
      score: r.score,
      suitability: r.suitability,
      reason: r.procedure === planning.recommendedProcedure ? 'Best match for refraction and corneal profile' : `Alternative option (score ${r.score})`
    }));
  }

  function analyzeNightVision(workup, planning) {
    const mesopic = Math.max(num(ev(workup, 'aberrometry', 'mesopicPupil', 'od')) || 0, num(ev(workup, 'aberrometry', 'mesopicPupil', 'os')) || 0);
    const photopic = Math.max(num(ev(workup, 'aberrometry', 'photopicPupil', 'od')) || 0, num(ev(workup, 'aberrometry', 'photopicPupil', 'os')) || 0);
    const nightDrive = ev(workup, 'assessment', 'nightDriving', 'shared');
    const hoa = Math.max(num(ev(workup, 'aberrometry', 'hoa', 'od')) || 0, num(ev(workup, 'aberrometry', 'hoa', 'os')) || 0);
    const issues = [];
    if (mesopic >= 7) issues.push('Large mesopic pupil — increased glare/halos');
    if (nightDrive === 'Frequent' && mesopic >= 6) issues.push('Frequent night driving with large pupil');
    if (hoa >= 0.3) issues.push('Elevated HOAs — wavefront-guided may help');
    const oz = num(workup.planning?.opticalZone) || planning.opticalZone || 6.5;
    let rec = oz >= 6.5 ? 'Standard optical zone acceptable' : 'Consider larger optical zone (≥6.5 mm)';
    if (mesopic >= 7 && oz < 6.5) rec = 'Recommend optical zone ≥6.5–7.0 mm given pupil size';
    return { mesopic, photopic, glareRisk: mesopic >= 7 ? 'High' : mesopic >= 6 ? 'Moderate' : 'Low', issues, recommendation: rec };
  }

  function enhancedCalculations(workup, planning) {
    const k1 = num(ev(workup, 'corneal', 'k1', 'od')) || num(ev(workup, 'corneal', 'k1', 'os')) || 43;
    const sph = num(ev(workup, 'refraction', 'manifestSph', 'od')) ?? num(ev(workup, 'refraction', 'manifestSph', 'os')) ?? 0;
    const predictedPostopK = Math.round((k1 + sph * 0.8) * 10) / 10;
    const tissueRemoval = planning.ablationDepth;
    return {
      ...planning,
      predictedPostopK,
      predictedTissueRemoval: tissueRemoval,
      safetyMarginStatus: planning.safetyMargin >= 50 ? 'Adequate' : planning.safetyMargin >= 0 ? 'Borderline' : 'Insufficient'
    };
  }

  function analyzeFollowUpTrend(workup) {
    const visits = workup.followUp?.visits || [];
    if (visits.length < 2) return { trend: 'Insufficient data', recs: [] };
    const first = visits[0];
    const last = visits[visits.length - 1];
    let trend = 'Stable';
    if (last.od?.regression === 'Yes' || last.os?.regression === 'Yes') trend = 'Worsened — regression';
    else if (last.od?.ucva && first.od?.ucva && String(last.od.ucva) > String(first.od.ucva)) trend = 'Improved';
    const recs = [];
    if (trend.includes('Worsened')) recs.push('Consider enhancement evaluation; review healing and dry eye');
    if (['Moderate', 'Severe'].includes(last.od?.dryEye) || ['Moderate', 'Severe'].includes(last.os?.dryEye)) recs.push('Intensify dry eye management');
    return { trend, recs, visitCount: visits.length };
  }

  function computeSafetyScore(risk, ectasia, dryEye) {
    let score = 100;
    if (risk.level === 'Contraindicated') score = 15;
    else if (risk.level === 'High risk') score = 40;
    else if (risk.level === 'Moderate risk') score = 65;
    else score = 85;
    if (ectasia.level === 'High risk') score -= 15;
    if (dryEye.level === 'Treat first' || dryEye.level === 'Contraindicated') score -= 10;
    return Math.max(0, Math.min(100, score));
  }

  function getLearningHints(workup) {
    try {
      const data = JSON.parse(localStorage.getItem(LEARNING_KEY) || '{"successes":[]}');
      return (data.successes || []).slice(-3).map((s) => `Prior success: ${s.procedure} for ${s.refraction} (RSB ${s.rsb} µm)`);
    } catch { return []; }
  }

  function recordLearningSuccess(workup, procedure) {
    try {
      const data = JSON.parse(localStorage.getItem(LEARNING_KEY) || '{"successes":[]}');
      data.successes = data.successes || [];
      const plan = T().computePlanning?.(workup);
      data.successes.push({
        procedure: procedure || plan?.recommendedProcedure,
        refraction: ev(workup, 'refraction', 'manifestSph', 'od') || '',
        rsb: plan?.residualStromalBed,
        date: new Date().toISOString()
      });
      data.successes = data.successes.slice(-50);
      localStorage.setItem(LEARNING_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function buildClinicalReasoning(workup, calc, ectasia, dryEye, ranked) {
    const lines = [];
    lines.push(`Thinnest pachymetry: ${calc.centralPachymetry ?? '—'} µm.`);
    lines.push(`Estimated ablation: ${calc.ablationDepth ?? '—'} µm. Residual stromal bed: ${calc.residualStromalBed ?? '—'} µm. PTA: ${calc.ptaPercent ?? '—'}%.`);
    const badD = Math.max(num(ev(workup, 'topography', 'badD', 'od')) || 0, num(ev(workup, 'topography', 'badD', 'os')) || 0);
    if (badD) lines.push(`BAD-D: ${badD}.`);
    lines.push(`Ectasia risk: ${ectasia.level}. Dry eye: ${dryEye.level}.`);
    if (ranked[0]) lines.push(`Recommendation: ${ranked[0].procedure} (best). ${ranked[1] ? ranked[1].procedure + ' (second).' : ''}`);
    return lines.join(' ');
  }

  function generatePatientCounseling(report) {
    const best = report.rankedProcedures?.[0]?.procedure || report.bestProcedure || 'To be determined';
    return {
      summary: `Based on your examination, ${best} may be suitable for your vision correction goals.`,
      benefits: 'Reduced dependence on glasses/contact lenses; rapid visual recovery (procedure-dependent).',
      risks: 'Dry eye, glare/halos (especially at night), regression, need for enhancement, rare ectasia or infection.',
      alternatives: (report.rankedProcedures || []).slice(1, 3).map((r) => r.procedure).join(', ') || 'PRK, SMILE, ICL',
      enhancements: 'Approximately 5–10% of patients may require an enhancement procedure.',
      expectations: 'Realistic goal is good functional vision; perfect vision without glasses is not guaranteed.'
    };
  }

  function analyze(workup, context) {
    context = context || {};
    const risk = T().computeRisk?.(workup) || { level: 'Low risk', warnings: [], factors: {}, planning: {} };
    const planning = enhancedCalculations(workup, risk.planning || T().computePlanning?.(workup) || {});
    const dryEye = analyzeDryEyeRisk(workup);
    const ectasia = analyzeEctasiaRisk(workup, planning, risk);
    const ranked = rankProcedures(workup, planning, risk, ectasia, dryEye);
    const nightVision = analyzeNightVision(workup, planning);
    const followUp = analyzeFollowUpTrend(workup);
    const safetyScore = computeSafetyScore(risk, ectasia, dryEye);
    const contraindications = [];
    if (ectasia.level === 'Contraindicated') contraindications.push(...ectasia.reasons);
    if (ev(workup, 'assessment', 'pregnancy', 'shared') === 'Yes') contraindications.push('Pregnancy — defer surgery');
    if (ev(workup, 'assessment', 'autoimmune', 'shared') === 'Yes' && risk.factors?.autoimmune === 'High') contraindications.push('Active autoimmune disease');
    if (ev(workup, 'refraction', 'stableRefraction', 'shared') === 'No') contraindications.push('Unstable refraction');
    if (dryEye.level === 'Contraindicated') contraindications.push('Severe active ocular surface disease');

    const suitabilityLabel = risk.level === 'Contraindicated' ? 'Contraindicated'
      : risk.level === 'High risk' ? 'Borderline candidate'
      : risk.level === 'Moderate risk' ? 'Borderline candidate'
      : 'Suitable candidate';

    const status = suitabilityLabel === 'Suitable candidate' ? 'green'
      : suitabilityLabel === 'Borderline candidate' ? 'yellow' : 'red';

    const recs = [];
    if (ranked[0]) {
      recs.push(mkRec('proc-1', 'procedure', `#1 ${ranked[0].procedure}`, 'Best option', ranked[0].reason, ranked[0].procedure, 'Optimize visual outcome', 'High'));
    }
    ranked.slice(1, 3).forEach((r, i) => {
      recs.push(mkRec(`proc-${i + 2}`, 'procedure', `#${r.rank} ${r.procedure}`, 'Alternative', r.reason, r.procedure, 'Backup surgical option', 'Medium'));
    });
    recs.push(mkRec('ectasia', 'risk', `Ectasia risk: ${ectasia.level}`, 'Corneal biomechanical assessment',
      ectasia.reasoning, ectasia.level === 'High risk' ? 'Consider PRK, CXL assessment, or ICL' : 'Monitor with serial topography', 'Reduce ectasia risk', ectasia.level.includes('High') ? 'High' : 'Medium'));
    recs.push(mkRec('dry', 'risk', `Dry eye: ${dryEye.level}`, 'Ocular surface analysis', dryEye.reasoning, dryEye.recommendation, 'Improve comfort and healing', dryEye.level === 'Treat first' ? 'High' : 'Medium'));
    if (nightVision.glareRisk !== 'Low') {
      recs.push(mkRec('night', 'planning', `Night vision risk: ${nightVision.glareRisk}`, 'Pupil-linked symptoms',
        nightVision.issues.join('. ') || 'Large mesopic pupil', nightVision.recommendation, 'Reduce glare/halos', 'Medium'));
    }
    recs.push(mkRec('plan-flap', 'planning', 'Surgical parameters', 'Recommended settings',
      `RSB ${planning.residualStromalBed} µm, PTA ${planning.ptaPercent}%, OZ ${planning.opticalZone} mm`,
      `Flap ${planning.flapThickness} µm · Cap ${planning.capThickness} µm · OZ ${planning.opticalZone} mm · Transition ${planning.transitionZone} mm`,
      'Safe tissue removal profile', 'High'));
    if (ev(workup, 'aberrometry', 'wavefrontAvailable', 'shared') === 'Yes') {
      recs.push(mkRec('wf', 'planning', 'Wavefront-guided treatment', 'HOA optimization', 'Wavefront data available.', 'Consider wavefront-guided ablation', 'Improve quality of vision', 'Medium'));
    }
    risk.warnings.forEach((w, i) => recs.push(mkRec(`alert-${i}`, 'safety', w, 'Safety alert', w, 'Address before proceeding', 'Risk mitigation', 'High')));

    const clinicalReasoning = buildClinicalReasoning(workup, planning, ectasia, dryEye, ranked);
    const confidence = status === 'green' ? 'High' : status === 'yellow' ? 'Medium' : 'Low';

    const report = {
      generatedAt: new Date().toISOString(),
      overall: { label: suitabilityLabel, status, summary: ranked[0]?.procedure ? `Primary: ${ranked[0].procedure}` : 'Complete work-up' },
      suitability: suitabilityLabel,
      confidence,
      safetyScore,
      bestProcedure: ranked[0]?.procedure || planning.recommendedProcedure,
      rankedProcedures: ranked,
      alternatives: ranked.slice(1, 3).map((r) => r.procedure),
      contraindications,
      majorRiskFactors: risk.warnings.slice(0, 5),
      clinicalReasoning,
      calculations: planning,
      ectasiaRisk: ectasia,
      dryEyeRisk: dryEye,
      nightVision,
      followUpTrend: followUp,
      safetyAlerts: risk.warnings.map((msg) => ({ level: msg.includes('contraindication') || msg.includes('defer') ? 'urgent' : 'high', msg })),
      surgicalPlan: {
        flapThickness: planning.flapThickness,
        capThickness: planning.capThickness,
        opticalZone: planning.opticalZone,
        transitionZone: planning.transitionZone,
        targetRefraction: 'Plano (adjust per monovision preference)',
        wavefront: ev(workup, 'aberrometry', 'wavefrontAvailable', 'shared') === 'Yes',
        topographyGuided: num(ev(workup, 'topography', 'badD', 'od')) > 0 || num(ev(workup, 'topography', 'badD', 'os')) > 0,
        crosslinking: ectasia.level === 'High risk' || ectasia.level === 'Moderate risk',
        dryEyeTreatment: dryEye.level !== 'Suitable'
      },
      recommendations: recs,
      topProblems: risk.warnings.slice(0, 3),
      topRecommendations: recs.slice(0, 3).map((r) => r.modification),
      learningHints: getLearningHints(workup),
      patientCounseling: null,
      risk,
      planning,
      disclaimer: 'AI Clinical Decision Support — surgeon makes final decision.'
    };
    report.patientCounseling = generatePatientCounseling(report);
    return report;
  }

  function renderPanel(report, aiState) {
    aiState = aiState || { decisions: {}, collapsed: false };
    const status = report.overall?.status || 'yellow';
    const decisions = aiState.decisions || {};
    const calc = report.calculations || {};

    const recHtml = (report.recommendations || []).slice(0, 12).map((r) => {
      const d = decisions[r.id];
      const cls = d === 'accepted' ? 'accepted' : d === 'rejected' ? 'rejected' : d === 'modified' ? 'modified' : '';
      return `<div class="lr-ai-rec ${cls}" data-rec-id="${escapeHtml(r.id)}">
        <div class="lr-ai-rec-head"><strong>${escapeHtml(r.finding)}</strong><span class="lr-ai-conf">${escapeHtml(r.confidence)}</span></div>
        <p class="lr-ai-interp">${escapeHtml(r.interpretation)}</p>
        <p class="lr-ai-reason"><em>Reasoning:</em> ${escapeHtml(r.reasoning)}</p>
        <p class="lr-ai-mod"><strong>Suggested:</strong> ${escapeHtml(r.modification)}</p>
        <div class="lr-ai-rec-actions no-print">
          <button type="button" class="btn-success btn-sm" data-lr-ai-action="accept" data-rec-id="${escapeHtml(r.id)}" title="Accept (Ctrl+A)">✓</button>
          <button type="button" class="btn-secondary btn-sm" data-lr-ai-action="modify" data-rec-id="${escapeHtml(r.id)}">✎</button>
          <button type="button" class="btn-danger btn-sm" data-lr-ai-action="reject" data-rec-id="${escapeHtml(r.id)}" title="Reject (Ctrl+R)">✗</button>
        </div>
        ${d ? `<span class="lr-ai-decision-badge ${d}">${d}</span>` : ''}
      </div>`;
    }).join('');

    const rankHtml = (report.rankedProcedures || []).map((r) =>
      `<li><strong>#${r.rank} ${escapeHtml(r.procedure)}</strong> — ${escapeHtml(r.reason)}</li>`
    ).join('');

    return `<div class="lr-ai-planner lr-ai-status-${status}${aiState.collapsed ? ' collapsed' : ''}" id="lrAiPlanner">
      <div class="lr-ai-planner-header no-print">
        <h4><i class="fa-solid fa-robot"></i> AI Laser Planner</h4>
        <button type="button" class="btn-secondary btn-sm" id="lrAiToggleCollapse">${aiState.collapsed ? 'Expand' : 'Collapse'}</button>
      </div>
      <p class="lr-ai-disclaimer">${escapeHtml(report.disclaimer)}</p>
      <div class="lr-ai-status-banner lr-ai-${status}">
        <strong>${escapeHtml(report.suitability || report.overall?.label)}</strong>
        <span>Safety ${escapeHtml(report.safetyScore)}/100 · Confidence: ${escapeHtml(report.confidence)}</span>
      </div>
      <div class="lr-ai-dashboard">
        <p><strong>Best:</strong> ${escapeHtml(report.bestProcedure || '—')}</p>
        <p><strong>RSB:</strong> ${escapeHtml(calc.residualStromalBed ?? '—')} µm · <strong>PTA:</strong> ${escapeHtml(calc.ptaPercent ?? '—')}% · <strong>Ablation:</strong> ${escapeHtml(calc.ablationDepth ?? '—')} µm</p>
        <p><strong>Ectasia:</strong> ${escapeHtml(report.ectasiaRisk?.level || '—')} · <strong>Dry eye:</strong> ${escapeHtml(report.dryEyeRisk?.level || '—')}</p>
      </div>
      <div class="lr-ai-reasoning-box"><strong>Clinical reasoning</strong><p>${escapeHtml(report.clinicalReasoning || '')}</p></div>
      ${report.contraindications?.length ? `<div class="lr-ai-safety"><strong>Contraindications</strong><ul>${report.contraindications.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul></div>` : ''}
      ${report.majorRiskFactors?.length ? `<div class="lr-ai-top"><strong>Major risks</strong><ul>${report.majorRiskFactors.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></div>` : ''}
      ${rankHtml ? `<div class="lr-ai-rank"><strong>Procedure ranking</strong><ol>${rankHtml}</ol></div>` : ''}
      ${report.nightVision?.glareRisk !== 'Low' ? `<div class="lr-ai-night"><strong>Night vision:</strong> ${escapeHtml(report.nightVision.glareRisk)} risk — ${escapeHtml(report.nightVision.recommendation)}</div>` : ''}
      ${report.followUpTrend?.visitCount >= 2 ? `<div class="lr-ai-fu"><strong>Follow-up trend:</strong> ${escapeHtml(report.followUpTrend.trend)}</div>` : ''}
      ${report.learningHints?.length ? `<div class="lr-ai-learning"><strong>Learning</strong><ul>${report.learningHints.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul></div>` : ''}
      <div class="lr-ai-recs"><strong>Recommendations</strong>${recHtml || '<p class="form-hint">Enter work-up data.</p>'}</div>
    </div>`;
  }

  function formatPrintBlock(report, aiState, clinicianNotes, type) {
    if (!report) return '';
    type = type || 'workup';
    const accepted = Object.values(aiState?.decisions || {}).filter((v) => v === 'accepted').length;
    const calc = report.calculations || {};

    if (type === 'counseling' && report.patientCounseling) {
      const pc = report.patientCounseling;
      return `<section style="margin-top:16px;border-top:2px solid #1565c0;padding-top:10px">
        <h3>Patient Counseling Summary</h3>
        <p>${escapeHtml(pc.summary)}</p>
        <p><strong>Benefits:</strong> ${escapeHtml(pc.benefits)}</p>
        <p><strong>Risks:</strong> ${escapeHtml(pc.risks)}</p>
        <p><strong>Alternatives:</strong> ${escapeHtml(pc.alternatives)}</p>
        <p><strong>Enhancements:</strong> ${escapeHtml(pc.enhancements)}</p>
        <h4>Surgeon Final Decision</h4>
        <p>${escapeHtml(clinicianNotes || '—')}</p>
      </section>`;
    }
    if (type === 'risk') {
      return `<section style="margin-top:16px;border-top:2px solid #c62828;padding-top:10px">
        <h3>AI Risk Assessment Report</h3>
        <p><em>${escapeHtml(report.disclaimer)}</em></p>
        <p><strong>Overall:</strong> ${escapeHtml(report.suitability)} · Safety score: ${escapeHtml(report.safetyScore)}/100</p>
        <p><strong>Ectasia:</strong> ${escapeHtml(report.ectasiaRisk?.level)} — ${escapeHtml(report.ectasiaRisk?.reasoning)}</p>
        <p><strong>Dry eye:</strong> ${escapeHtml(report.dryEyeRisk?.level)} — ${escapeHtml(report.dryEyeRisk?.recommendation)}</p>
        <p><strong>Alerts:</strong> ${(report.majorRiskFactors || []).map(escapeHtml).join('; ')}</p>
        <h4>Surgeon Final Decision</h4>
        <p>${escapeHtml(clinicianNotes || '—')}</p>
      </section>`;
    }
    if (type === 'plan') {
      const sp = report.surgicalPlan || {};
      return `<section style="margin-top:16px;border-top:2px solid #1565c0;padding-top:10px">
        <h3>AI Surgical Planning Report</h3>
        <p><em>${escapeHtml(report.disclaimer)}</em></p>
        <p><strong>Recommended:</strong> ${escapeHtml(report.bestProcedure)}</p>
        <p>RSB ${escapeHtml(calc.residualStromalBed)} µm · PTA ${escapeHtml(calc.ptaPercent)}% · Ablation ${escapeHtml(calc.ablationDepth)} µm · Post-op K ~${escapeHtml(calc.predictedPostopK)} D</p>
        <p>Flap ${escapeHtml(sp.flapThickness)} µm · Cap ${escapeHtml(sp.capThickness)} µm · OZ ${escapeHtml(sp.opticalZone)} mm</p>
        <p><strong>Reasoning:</strong> ${escapeHtml(report.clinicalReasoning)}</p>
        <h4>Surgeon Final Decision</h4>
        <p>${escapeHtml(clinicianNotes || '—')}</p>
      </section>`;
    }
    return `<section style="margin-top:16px;border-top:2px solid #1565c0;padding-top:10px">
      <h3>AI Clinical Decision Support</h3>
      <p><em>${escapeHtml(report.disclaimer)}</em></p>
      <p><strong>Suitability:</strong> ${escapeHtml(report.suitability)} (${escapeHtml(report.confidence)} confidence, safety ${escapeHtml(report.safetyScore)}/100)</p>
      <p><strong>Recommended:</strong> ${escapeHtml(report.bestProcedure)} · Alternatives: ${(report.alternatives || []).map(escapeHtml).join(', ')}</p>
      <p><strong>Clinical reasoning:</strong> ${escapeHtml(report.clinicalReasoning)}</p>
      <p><strong>Top recommendations:</strong> ${(report.topRecommendations || []).map(escapeHtml).join('; ')}</p>
      <p><strong>Surgeon decisions on AI:</strong> ${accepted} accepted</p>
      <h4>Surgeon Final Decision</h4>
      <p>${escapeHtml(clinicianNotes || 'Document final plan in Surgical Planning tab.')}</p>
    </section>`;
  }

  global.CorneaLaserRefractiveAdvisor = {
    analyze,
    renderPanel,
    formatPrintBlock,
    recordLearningSuccess,
    recordDecision(aiState, recId, action, note, workup) {
      const norm = { accept: 'accepted', reject: 'rejected', modify: 'modified' };
      const normalized = norm[action] || action;
      aiState.decisions = aiState.decisions || {};
      aiState.log = aiState.log || [];
      aiState.decisions[recId] = normalized;
      aiState.log.push({ recId, action: normalized, note: note || '', at: new Date().toISOString() });
      if (normalized === 'accepted') recordLearningSuccess(workup || aiState._lastWorkup || {}, aiState._lastReport?.bestProcedure);
      return aiState;
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
