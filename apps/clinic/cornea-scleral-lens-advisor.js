/**
 * AI Scleral Lens Advisor — clinical decision support (rule-based expert system).
 * Does NOT replace clinician judgment. Recommendations require accept/reject/modify.
 */
(function (global) {
  'use strict';

  const T = () => global.CorneaScleralLensTaxonomy || {};
  const LEARNING_KEY = 'corneaSlAiLearning';

  function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function num(v) {
    const n = parseFloat(String(v || '').replace(/[^\d.-]/g, ''));
    return Number.isNaN(n) ? null : n;
  }

  function hasIndication(fit, name) {
    return (fit.indication || []).some((i) => i.toLowerCase().includes(name.toLowerCase()));
  }

  function clearanceTier(microns) {
    const m = num(microns);
    if (m == null) return { tier: 'unknown', label: 'Not assessed', cls: '', action: '', target: '200–300 µm' };
    if (m < 100) return { tier: 'too_low', label: 'Too low', cls: 'sl-ai-red', action: 'Increase sagittal depth by ~150–200 µm', target: '200–300 µm', rec: 'Increase sag' };
    if (m < 200) return { tier: 'low', label: 'Low', cls: 'sl-ai-yellow', action: 'Increase sagittal depth by ~100 µm', target: '200–300 µm', rec: 'Increase sag' };
    if (m <= 300) return { tier: 'ideal', label: 'Ideal', cls: 'sl-ai-green', action: 'Accept fit', target: '200–300 µm', rec: 'Accept fit' };
    if (m <= 450) return { tier: 'high', label: 'High', cls: 'sl-ai-yellow', action: 'Decrease sagittal depth by ~100–200 µm', target: '200–300 µm', rec: 'Decrease sag' };
    return { tier: 'too_high', label: 'Too high', cls: 'sl-ai-red', action: 'Decrease sagittal depth by ~200 µm', target: '200–300 µm', rec: 'Decrease sag' };
  }

  function mkRec(id, category, finding, interpretation, reasoning, modification, benefit, confidence) {
    return { id, category, finding, interpretation, reasoning, modification, expectedBenefit: benefit, confidence: confidence || 'Medium' };
  }

  function suggestTrialLens(fit) {
    const pf = fit.prefitting?.od || {};
    const hvid = num(pf.hvid) || num(pf.whiteToWhite) || 11.8;
    const kmax = num(pf.kmax) || 44;
    let diameter = (hvid + 1.5).toFixed(1);
    let sag = Math.round(3200 + (kmax - 43) * 120);
    let material = 'High DK silicone hydrogel';
    let design = 'Prosthetic replacement technology scleral';
    let landing = 'Standard quadrant-specific';
    let confidence = 'Medium';

    if (hasIndication(fit, 'Keratoconus')) { sag += 400; design = 'Keratoconus scleral design'; confidence = 'High'; }
    if (hasIndication(fit, 'Post PKP')) { diameter = (hvid + 2.2).toFixed(1); landing = 'Quadrant-specific landing'; sag += 300; confidence = 'High'; }
    if (hasIndication(fit, 'Post DALK')) { sag += 200; landing = 'Quadrant-specific landing'; }
    if (hasIndication(fit, 'Severe dry eye') || hasIndication(fit, 'GVHD') || hasIndication(fit, 'Sjogren')) {
      material = 'High DK + plasma coating'; design = 'Reservoir-optimized scleral'; confidence = 'High';
    }
    if (hasIndication(fit, 'Bullous keratopathy')) { sag += 250; design = 'Therapeutic vault scleral'; }
    if (hasIndication(fit, 'Neurotrophic')) { material = 'High DK + coating'; sag += 150; }

    const cyl = num(pf.astigmatism);
    const powerEst = pf.manifestRefraction || 'From manifest refraction';

    return { diameter, sagittalDepth: String(sag), landingZone: landing, material, design, powerEstimate: powerEst, confidence,
      reasoning: `Based on HVID ~${hvid} mm, Kmax ~${kmax} D, and indication profile.` };
  }

  function analyzeSafety(fit) {
    const alerts = [];
    const pf = fit.prefitting || {};
    const comp = fit.complications?.findings || [];

    if (comp.includes('Microbial keratitis') || (pf.od?.cornealStaining || '').toLowerCase().includes('ulcer')) {
      alerts.push({ level: 'urgent', msg: 'Active infection / corneal ulcer — defer fitting; urgent treatment' });
    }
    if ((pf.shared?.cornealGraft || pf.od?.cornealGraft || '').toLowerCase().includes('reject')) {
      alerts.push({ level: 'urgent', msg: 'Graft rejection — do not proceed until resolved' });
    }
    if (comp.includes('Corneal touch') || comp.includes('Limbal touch')) {
      alerts.push({ level: 'high', msg: 'Corneal or limbal touch — adjust vault before dispensing' });
    }
    if ((pf.od?.cornealStaining || '').toLowerCase().includes('large') || (pf.od?.cornealStaining || '').toLowerCase().includes('severe')) {
      alerts.push({ level: 'high', msg: 'Large epithelial defect — consider bandage protocol or defer' });
    }
    if (comp.includes('Hypoxia') || (pf.od?.cornealNeovascularization || '').toLowerCase().includes('progressive')) {
      alerts.push({ level: 'high', msg: 'Severe hypoxia / progressive neovascularization risk' });
    }
    if ((pf.shared?.blepharitis || '') === 'Yes' && (pf.shared?.mgd || '') === 'Yes') {
      alerts.push({ level: 'moderate', msg: 'Active lid disease — treat before fitting' });
    }
    return alerts;
  }

  function analyzeCentralClearance(fit) {
    const cc = fit.centralClearance?.shared || {};
    const m = cc.estimate || cc.odMicrons || cc.osMicrons;
    const tier = clearanceTier(m);
    const recs = [];
    if (tier.tier === 'too_low' || tier.tier === 'low') {
      recs.push(mkRec('cc-low', 'clearance', `Central clearance ~${m} µm`, tier.label,
        `Target clearance is ${tier.target}. Current vault is insufficient for safe corneal clearance.`,
        tier.action, 'Reduce corneal touch risk and improve comfort', 'High'));
    } else if (tier.tier === 'high' || tier.tier === 'too_high') {
      recs.push(mkRec('cc-high', 'clearance', `Central clearance ~${m} µm`, tier.label,
        `Target clearance is ${tier.target}. Excessive clearance may reduce oxygen transmission and increase fogging.`,
        tier.action, 'Optimize oxygen flux and reduce reservoir fogging', tier.tier === 'too_high' ? 'High' : 'Medium'));
    } else if (tier.tier === 'ideal') {
      recs.push(mkRec('cc-ideal', 'clearance', `Central clearance ~${m} µm`, 'Ideal range',
        'Central vault within target range for scleral lens fitting.', 'Accept fit', 'Maintain corneal health and comfort', 'High'));
    }
    return { tier, recs, method: cc.method || 'Manual estimate' };
  }

  function analyzeLimbal(fit) {
    const recs = [];
    const lc = fit.limbalClearance || {};
    (T().QUADRANTS || ['Superior', 'Inferior', 'Nasal', 'Temporal']).forEach((q) => {
      const v = lc[q];
      if (v === 'Touch') recs.push(mkRec(`lim-${q}`, 'limbal', `${q} limbal clearance: Touch`, 'Inadequate limbal clearance',
        'Limbal touch may cause staining and discomfort.', `Increase sag or diameter for ${q}`, 'Prevent limbal insult', 'High'));
      else if (v === 'Excessive clearance') recs.push(mkRec(`lim-ex-${q}`, 'limbal', `${q}: Excessive clearance`, 'Excessive limbal vault',
        'May contribute to bubble formation or instability.', `Decrease sag for ${q} or maintain if stable`, 'Improve landing stability', 'Medium'));
      else if (v === 'Normal') recs.push(mkRec(`lim-ok-${q}`, 'limbal', `${q}: Normal`, 'Acceptable limbal clearance',
        'Limbal clearance appears adequate.', 'Maintain', 'Stable limbal health', 'High'));
    });
    return recs;
  }

  function analyzeLanding(fit) {
    const recs = [];
    const lz = fit.landingZone || {};
    const quads = T().QUADRANTS || [];
    const findings = [];
    quads.forEach((q) => {
      const v = lz[q];
      if (!v) return;
      findings.push(`${q}: ${v}`);
      if (v === 'Compression') recs.push(mkRec(`lz-comp-${q}`, 'landing', `${q} compression`, 'Landing zone compression',
        'Excessive bearing at landing zone may impede tear exchange.', `Flatten landing zone in ${q}`, 'Reduce compression and improve comfort', 'High'));
      if (v === 'Impingement') recs.push(mkRec(`lz-imp-${q}`, 'landing', `${q} impingement`, 'Landing zone impingement',
        'Conjunctival impingement may cause redness and discomfort.', `Steepen landing zone in ${q}`, 'Relieve conjunctival pressure', 'High'));
      if (v === 'Edge lift') recs.push(mkRec(`lz-lift-${q}`, 'landing', `${q} edge lift`, 'Edge lift',
        'Edge lift may allow bubble ingress and reduce stability.', 'Adjust peripheral curves / landing zone', 'Improve seal and stability', 'Medium'));
      if (v === 'Seal off') recs.push(mkRec(`lz-seal-${q}`, 'landing', `${q} seal off`, 'Seal off',
        'Poor tear exchange may cause midday fogging.', 'Modify landing zone for tear exchange', 'Reduce fogging and hypoxia risk', 'High'));
    });
    const asym = new Set(quads.map((q) => lz[q]).filter(Boolean)).size > 2;
    if (asym) recs.push(mkRec('lz-asym', 'landing', 'Quadrant asymmetry', 'Asymmetric landing',
      'Different quadrant findings suggest need for quadrant-specific design.', 'Quadrant-specific landing zone modifications', 'Optimize fit in all quadrants', 'Medium'));
    return { recs, findings };
  }

  function analyzeDecentration(fit) {
    const recs = [];
    const dec = fit.movement?.decentration;
    const mv = fit.movement?.amount;
    if (dec && dec !== 'None') {
      recs.push(mkRec('dec', 'movement', `Decentration: ${dec}`, 'Lens decentration',
        'Decentration may affect vision and comfort.', dec.includes('Superior') || dec.includes('Inferior')
          ? 'Adjust sagittal depth; verify fill technique' : 'Consider diameter adjustment; check landing zone',
        'Improve centration and visual quality', 'Medium'));
    }
    if (mv === 'No movement') recs.push(mkRec('mv-none', 'movement', 'No lens movement', 'Excessive bearing',
      'Complete absence of movement may indicate tight fit or seal off.', 'Increase sagittal depth slightly', 'Improve tear exchange', 'Medium'));
    if (mv === 'Excessive') recs.push(mkRec('mv-ex', 'movement', 'Excessive movement', 'Loose fit',
      'Excessive movement suggests insufficient landing or diameter.', 'Decrease sag or increase diameter', 'Improve stability', 'Medium'));
    return recs;
  }

  function analyzeOverRefraction(fit) {
    const recs = [];
    const od = fit.overRefraction?.od || {};
    const sph = num(od.sphere);
    const cyl = num(od.cylinder);
    if (sph != null && Math.abs(sph) >= 0.75) {
      recs.push(mkRec('or-sph', 'refraction', `Residual sphere ${od.sphere} D`, 'Significant residual sphere',
        'Over-refraction indicates power adjustment needed.', `Modify power by ${od.sphere} D`, 'Optimize distance vision', 'High'));
    }
    if (cyl != null && Math.abs(cyl) >= 0.75) {
      recs.push(mkRec('or-cyl', 'refraction', `Residual cylinder ${od.cylinder} D @ ${od.axis || '—'}`, 'Residual astigmatism',
        'Residual cylinder may require toric front surface or piggyback refinement.', 'Consider toric optics or front surface toricity', 'Improve visual acuity', cyl >= 1.25 ? 'High' : 'Medium'));
    }
    if ((od.nearVision || '').toLowerCase().includes('poor') || (od.distanceVision || '').toLowerCase().includes('poor')) {
      recs.push(mkRec('or-va', 'refraction', 'Suboptimal VA with trial', 'Vision not yet optimized',
        'VA remains below target with current power.', 'Refine power; consider multifocal if presbyopia', 'Improve functional vision', 'Medium'));
    }
    return recs;
  }

  function analyzeComplications(fit) {
    const recs = [];
    const solutions = {
      Bubble: 'Reinsert with full saline fill; burp air; review insertion training',
      'Midday fogging': 'Plasma coating; mid-day rinse; optimize landing zone tear exchange',
      Fogging: 'Surface treatment; reduce clearance if excessive; review care regimen',
      'Corneal touch': 'Increase sagittal depth immediately',
      'Limbal touch': 'Increase sag or diameter',
      Compression: 'Flatten landing zone in affected quadrant',
      Impingement: 'Steepen landing zone',
      Hypoxia: 'Increase DK material; reduce wearing time; optimize clearance',
      'Poor comfort': 'Review clearance, landing zone, and edge profile',
      Dryness: 'Reservoir optimization; preservative-free tears; coating',
      'Lens awareness': 'Edge refinement; clearance optimization',
      Deposits: 'Enzyme cleaner; shorter replacement; material change'
    };
    (fit.complications?.findings || []).forEach((c) => {
      const sol = solutions[c] || 'Review fit parameters and patient education';
      recs.push(mkRec(`comp-${c}`, 'complication', c, 'Complication detected',
        `Active complication: ${c}.`, sol, 'Resolve complication before finalizing order', 'High'));
    });
    return recs;
  }

  function analyzeDiagnosisSpecific(fit) {
    const recs = [];
    if (hasIndication(fit, 'Keratoconus')) {
      recs.push(mkRec('dx-kc', 'diagnosis', 'Keratoconus fitting strategy', 'Irregular cornea profile',
        'Consider apical clearance optimization; monitor for Fleischer ring / Vogt striae / apical scarring on topography.',
        'Vault over cone; avoid apical bearing; quadrant landing if asymmetric', 'Protect apex and optimize vision', 'High'));
    }
    if (hasIndication(fit, 'Post PKP')) {
      recs.push(mkRec('dx-pkp', 'diagnosis', 'Post-PKP fitting', 'Graft-host interface considerations',
        'Larger diameter and quadrant-specific landing often required; monitor graft edema and rejection signs.',
        'Increase diameter 0.5–1 mm; quadrant landing zone; monitor staining', 'Stable graft and comfortable fit', 'High'));
    }
    if (hasIndication(fit, 'Post DALK')) {
      recs.push(mkRec('dx-dalk', 'diagnosis', 'Post-DALK fitting', 'Interface and anterior chamber considerations',
        'Similar to PKP but may have different topography; optimize vault without interface touch.',
        'Quadrant landing; careful clearance monitoring', 'Protect interface', 'Medium'));
    }
    if (hasIndication(fit, 'Severe dry eye') || hasIndication(fit, 'GVHD')) {
      recs.push(mkRec('dx-dry', 'diagnosis', 'Severe dry eye / GVHD', 'Reservoir-dependent lubrication',
        'Scleral lens reservoir provides therapeutic benefit; plasma coating recommended.',
        'Surface coating; reservoir optimization; lubrication plan', 'Improve ocular surface comfort', 'High'));
    }
    if (hasIndication(fit, 'Neurotrophic')) {
      recs.push(mkRec('dx-neuro', 'diagnosis', 'Neurotrophic keratitis', 'Reduced corneal sensation',
        'Therapeutic vault; monitor epithelial healing closely.', 'Bandage scleral protocol; frequent follow-up', 'Protect corneal surface', 'High'));
    }
    return recs;
  }

  function analyzeFollowUp(history, fit) {
    if (!history || history.length < 2) return { trend: 'First fitting', recs: [] };
    const prev = history[history.length - 2];
    const curr = history[history.length - 1];
    let trend = 'Stable';
    const prevSag = num(prev.sag);
    const currSag = num(curr.sag);
    if (prevSag != null && currSag != null) {
      if (currSag > prevSag + 100) trend = 'Vault increased';
      if (currSag < prevSag - 100) trend = 'Vault decreased';
    }
    const recs = [];
    if (trend !== 'Stable') {
      recs.push(mkRec('fu-trend', 'followup', `Visit trend: ${trend}`, 'Longitudinal comparison',
        'Compared to previous fitting in this record.', 'Review comfort, vision, clearance at follow-up', 'Confirm improvement trajectory', 'Medium'));
    }
    return { trend, recs };
  }

  function computeOverallScore(problems, safetyAlerts, clearanceTierObj) {
    if (safetyAlerts.some((a) => a.level === 'urgent')) return { score: 'poor', label: 'Poor fit', status: 'red', summary: 'Urgent safety concern' };
    const severe = problems.filter((p) => p.severity === 'high').length;
    const mod = problems.filter((p) => p.severity === 'moderate').length;
    if (clearanceTierObj.tier === 'too_low' || clearanceTierObj.tier === 'too_high') {
      return { score: 'needs_modification', label: 'Needs modification', status: 'yellow', summary: 'Clearance outside target' };
    }
    if (severe >= 2) return { score: 'poor', label: 'Poor fit', status: 'red', summary: 'Multiple significant issues' };
    if (severe >= 1 || mod >= 2) return { score: 'needs_modification', label: 'Needs modification', status: 'yellow', summary: 'Adjustments recommended' };
    if (mod >= 1 || clearanceTierObj.tier === 'high' || clearanceTierObj.tier === 'low') {
      return { score: 'acceptable', label: 'Acceptable with modification', status: 'yellow', summary: 'Minor adjustments may help' };
    }
    if (clearanceTierObj.tier === 'ideal') return { score: 'excellent', label: 'Excellent fit', status: 'green', summary: 'Parameters within target range' };
    return { score: 'good', label: 'Good', status: 'green', summary: 'Proceed with minor refinements as needed' };
  }

  function getLearningHints(fit) {
    try {
      const data = JSON.parse(localStorage.getItem(LEARNING_KEY) || '{"successes":[]}');
      const ind = (fit.indication || [])[0] || '';
      const match = (data.successes || []).filter((s) => s.indication === ind).slice(-3);
      return match.map((s) => `Previously successful for ${s.indication}: sag ${s.sag}, Ø ${s.diameter}`);
    } catch {
      return [];
    }
  }

  function recordLearningSuccess(fit) {
    try {
      const data = JSON.parse(localStorage.getItem(LEARNING_KEY) || '{"successes":[]}');
      data.successes = data.successes || [];
      data.successes.push({
        indication: (fit.indication || [])[0] || 'General',
        sag: fit.trialSelection?.shared?.sagittalDepth,
        diameter: fit.trialSelection?.shared?.diameter,
        date: new Date().toISOString()
      });
      data.successes = data.successes.slice(-50);
      localStorage.setItem(LEARNING_KEY, JSON.stringify(data));
    } catch (_) {}
  }

  function analyze(fit, context) {
    context = context || {};
    const currentStep = context.currentStep || 1;
    const history = context.history || [];

    const safetyAlerts = analyzeSafety(fit);
    const cc = analyzeCentralClearance(fit);
    const trialSuggestion = suggestTrialLens(fit);
    const allRecs = [
      ...cc.recs,
      ...analyzeLimbal(fit),
      ...analyzeLanding(fit).recs,
      ...analyzeDecentration(fit),
      ...analyzeOverRefraction(fit),
      ...analyzeComplications(fit),
      ...analyzeDiagnosisSpecific(fit),
      ...(analyzeFollowUp(history, fit).recs || [])
    ];

    if (currentStep <= 2 && !(fit.trialSelection?.shared?.sagittalDepth)) {
      allRecs.unshift(mkRec('trial-suggest', 'trial', 'Initial trial lens suggestion', 'Based on corneal parameters',
        trialSuggestion.reasoning,
        `Trial Ø ${trialSuggestion.diameter} mm, sag ${trialSuggestion.sagittalDepth} µm, ${trialSuggestion.material}`,
        'Starting point for trial fitting', trialSuggestion.confidence));
    }

    const problems = [];
    safetyAlerts.forEach((a) => problems.push({ text: a.msg, severity: a.level === 'urgent' ? 'high' : 'moderate' }));
    if (cc.tier.tier !== 'ideal' && cc.tier.tier !== 'unknown') {
      problems.push({ text: `Central clearance: ${cc.tier.label}`, severity: cc.tier.cls.includes('red') ? 'high' : 'moderate' });
    }
    (fit.complications?.findings || []).forEach((c) => problems.push({ text: c, severity: 'high' }));

    const overall = computeOverallScore(problems, safetyAlerts, cc.tier);
    const topProblems = problems.slice(0, 3).map((p) => p.text);
    const topRecs = allRecs.filter((r) => !r.id.startsWith('cc-ideal')).slice(0, 3);

    const stepHints = {
      1: 'Complete indication selection, then proceed to pre-fitting assessment.',
      2: 'Enter topography and keratometry; review AI trial lens suggestion.',
      3: 'Select trial lens parameters; compare with AI suggestion.',
      4: 'Confirm insertion quality; check for bubbles.',
      5: 'Assess central clearance; follow AI vault recommendation.',
      6: 'Evaluate limbal clearance in all quadrants.',
      7: 'Assess landing zone; note quadrant asymmetry.',
      8: 'Evaluate movement and centration.',
      9: 'Perform over-refraction; refine power.',
      10: 'Review auto-generated final design.',
      11: 'Document complications; apply suggested solutions.',
      12: 'Complete patient education checklist.',
      13: 'Schedule follow-up; compare with prior visits.'
    };

    let suggestedFollowUp = '1 week';
    if (overall.status === 'red') suggestedFollowUp = '1 day';
    else if (overall.status === 'yellow') suggestedFollowUp = '1–2 weeks';
    else if (overall.score === 'excellent') suggestedFollowUp = '1 month';

    return {
      generatedAt: new Date().toISOString(),
      currentStep,
      overall,
      confidence: overall.status === 'green' ? 'High' : overall.status === 'yellow' ? 'Medium' : 'Low',
      nextStep: stepHints[currentStep] || 'Continue fitting workflow.',
      safetyAlerts,
      problems,
      recommendations: allRecs,
      topProblems,
      topRecommendations: topRecs.map((r) => r.modification),
      suggestedFollowUp,
      centralClearance: cc,
      trialSuggestion,
      learningHints: getLearningHints(fit),
      disclaimer: 'AI Clinical Decision Support — clinician makes final decision.'
    };
  }

  function renderPanel(report, aiState, fit) {
    aiState = aiState || { decisions: {}, collapsed: false };
    const status = report.overall?.status || 'yellow';
    const statusLabel = report.overall?.label || 'Assessing…';
    const decisions = aiState.decisions || {};

    const recHtml = (report.recommendations || []).slice(0, 12).map((r) => {
      const d = decisions[r.id];
      const statusCls = d === 'accepted' ? 'accepted' : d === 'rejected' ? 'rejected' : d === 'modified' ? 'modified' : '';
      return `<div class="sl-ai-rec ${statusCls}" data-rec-id="${escapeHtml(r.id)}">
        <div class="sl-ai-rec-head"><strong>${escapeHtml(r.finding)}</strong>
          <span class="sl-ai-conf">${escapeHtml(r.confidence)}</span></div>
        <p class="sl-ai-interp">${escapeHtml(r.interpretation)}</p>
        <p class="sl-ai-reason"><em>Reasoning:</em> ${escapeHtml(r.reasoning)}</p>
        <p class="sl-ai-mod"><strong>Suggested:</strong> ${escapeHtml(r.modification)}</p>
        <p class="sl-ai-benefit">${escapeHtml(r.expectedBenefit)}</p>
        <div class="sl-ai-rec-actions no-print">
          <button type="button" class="btn-success btn-sm" data-ai-action="accept" data-rec-id="${escapeHtml(r.id)}" title="Accept (A)">✓ Accept</button>
          <button type="button" class="btn-secondary btn-sm" data-ai-action="modify" data-rec-id="${escapeHtml(r.id)}" title="Modify (M)">✎ Modify</button>
          <button type="button" class="btn-danger btn-sm" data-ai-action="reject" data-rec-id="${escapeHtml(r.id)}" title="Reject (R)">✗ Reject</button>
        </div>
        ${d ? `<span class="sl-ai-decision-badge ${d}">${d}</span>` : ''}
      </div>`;
    }).join('');

    const cc = report.centralClearance?.tier || {};
    const trial = report.trialSuggestion || {};

    return `<div class="sl-ai-advisor sl-ai-status-${status}${aiState.collapsed ? ' collapsed' : ''}" id="slAiAdvisor">
      <div class="sl-ai-advisor-header no-print">
        <h4><i class="fa-solid fa-robot"></i> AI Scleral Lens Advisor</h4>
        <button type="button" class="btn-secondary btn-sm" id="slAiToggleCollapse" title="Collapse panel">${aiState.collapsed ? 'Expand' : 'Collapse'}</button>
      </div>
      <p class="sl-ai-disclaimer">${escapeHtml(report.disclaimer)}</p>
      <div class="sl-ai-status-banner sl-ai-${status}">
        <strong>${escapeHtml(statusLabel)}</strong>
        <span>Confidence: ${escapeHtml(report.confidence)}</span>
      </div>
      <div class="sl-ai-summary">
        <div class="sl-ai-score">${escapeHtml(report.overall?.summary || '')}</div>
        <p><strong>Next step:</strong> ${escapeHtml(report.nextStep)}</p>
        <p><strong>Suggested follow-up:</strong> ${escapeHtml(report.suggestedFollowUp)}</p>
      </div>
      ${report.safetyAlerts?.length ? `<div class="sl-ai-safety"><strong>⚠ Safety alerts</strong><ul>${report.safetyAlerts.map((a) => `<li>${escapeHtml(a.msg)}</li>`).join('')}</ul></div>` : ''}
      ${report.topProblems?.length ? `<div class="sl-ai-top"><strong>Top problems</strong><ol>${report.topProblems.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ol></div>` : ''}
      ${cc.label ? `<div class="sl-ai-cc ${cc.cls || ''}"><strong>Central clearance:</strong> ${escapeHtml(cc.label)} — ${escapeHtml(cc.action || '')}</div>` : ''}
      ${trial.diameter ? `<div class="sl-ai-trial"><strong>Trial suggestion</strong> (conf. ${escapeHtml(trial.confidence)})
        <ul><li>Ø ${escapeHtml(trial.diameter)} mm · Sag ${escapeHtml(trial.sagittalDepth)} µm</li>
        <li>${escapeHtml(trial.material)}</li><li>${escapeHtml(trial.landingZone)}</li></ul>
        <p class="form-hint">${escapeHtml(trial.reasoning)}</p></div>` : ''}
      ${report.learningHints?.length ? `<div class="sl-ai-learning"><strong>Learning hints</strong><ul>${report.learningHints.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul></div>` : ''}
      <div class="sl-ai-recs"><strong>Recommendations</strong>${recHtml || '<p class="form-hint">Enter fitting data to generate recommendations.</p>'}</div>
    </div>`;
  }

  function formatPrintBlock(report, aiState, clinicianNotes) {
    if (!report) return '';
    const accepted = Object.entries(aiState?.decisions || {}).filter(([, v]) => v === 'accepted');
    const rejected = Object.entries(aiState?.decisions || {}).filter(([, v]) => v === 'rejected');
    const modified = Object.entries(aiState?.decisions || {}).filter(([, v]) => v === 'modified');
    const recDetails = (report.recommendations || []).slice(0, 6).map((r) =>
      `<li><strong>${escapeHtml(r.finding)}</strong> — ${escapeHtml(r.modification)} (${escapeHtml(r.confidence)})<br><em>${escapeHtml(r.reasoning)}</em></li>`
    ).join('');
    return `<section style="margin-top:20px;border-top:2px solid #00838f;padding-top:12px">
      <h3>AI Clinical Decision Support</h3>
      <p><em>${escapeHtml(report.disclaimer)}</em></p>
      <p><strong>Overall score:</strong> ${escapeHtml(report.overall?.label)} — ${escapeHtml(report.overall?.summary || '')}</p>
      <p><strong>Confidence:</strong> ${escapeHtml(report.confidence)} · <strong>Suggested follow-up:</strong> ${escapeHtml(report.suggestedFollowUp)}</p>
      ${report.safetyAlerts?.length ? `<p><strong>Safety alerts:</strong> ${report.safetyAlerts.map((a) => escapeHtml(a.msg)).join('; ')}</p>` : ''}
      ${report.topProblems?.length ? `<p><strong>Top problems:</strong> ${report.topProblems.map(escapeHtml).join('; ')}</p>` : ''}
      <p><strong>Top recommendations:</strong> ${(report.topRecommendations || []).map(escapeHtml).join('; ')}</p>
      ${recDetails ? `<ul style="font-size:12px;margin:8px 0 8px 18px">${recDetails}</ul>` : ''}
      <p><strong>Clinician decisions on AI recommendations:</strong> Accepted ${accepted.length}, Modified ${modified.length}, Rejected ${rejected.length}</p>
      <h4 style="margin-top:16px">Clinician Final Decision</h4>
      <p>${escapeHtml(clinicianNotes || 'Document final lens parameters and plan in wizard Step 10.')}</p>
    </section>`;
  }

  const CorneaScleralLensAdvisor = {
    analyze,
    renderPanel,
    formatPrintBlock,
    recordLearningSuccess,
    recordDecision(aiState, recId, action, note) {
      const norm = { accept: 'accepted', reject: 'rejected', modify: 'modified' };
      const normalized = norm[action] || action;
      aiState.decisions = aiState.decisions || {};
      aiState.log = aiState.log || [];
      aiState.decisions[recId] = normalized;
      aiState.log.push({ recId, action: normalized, note: note || '', at: new Date().toISOString() });
      if (normalized === 'accepted') recordLearningSuccess(aiState._lastFit || {});
      return aiState;
    }
  };

  global.CorneaScleralLensAdvisor = CorneaScleralLensAdvisor;
})(typeof window !== 'undefined' ? window : globalThis);
