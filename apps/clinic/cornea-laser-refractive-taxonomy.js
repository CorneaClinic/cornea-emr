/**
 * Laser Refractive Surgery Work-up — taxonomy, fields, risk & planning calculations
 */
(function (global) {
  'use strict';

  const LR_TABS = [
    { id: 'assessment', label: 'Patient Assessment', icon: 'fa-user-check' },
    { id: 'refraction', label: 'Refraction', icon: 'fa-glasses' },
    { id: 'corneal', label: 'Corneal Evaluation', icon: 'fa-circle-dot' },
    { id: 'ocularSurface', label: 'Tear Film & Surface', icon: 'fa-droplet' },
    { id: 'topography', label: 'Topography', icon: 'fa-chart-area' },
    { id: 'aberrometry', label: 'Aberrometry', icon: 'fa-wave-square' },
    { id: 'risk', label: 'Risk Assessment', icon: 'fa-triangle-exclamation' },
    { id: 'planning', label: 'Surgical Planning', icon: 'fa-scalpel' },
    { id: 'aiAdvisor', label: 'AI Advisor', icon: 'fa-robot' },
    { id: 'consent', label: 'Consent', icon: 'fa-file-signature' },
    { id: 'surgery', label: 'Surgery Record', icon: 'fa-hospital' },
    { id: 'followUp', label: 'Follow-up', icon: 'fa-calendar-check' },
    { id: 'outcomes', label: 'Outcomes', icon: 'fa-chart-line' }
  ];

  const PROCEDURES = [
    'LASIK', 'Femto LASIK', 'SMILE', 'PRK', 'LASEK', 'TransPRK', 'PTK',
    'Topography-guided', 'Wavefront-guided', 'ICL screening', 'RLE screening', 'No surgery'
  ];

  const TOPO_DEVICES = ['Pentacam', 'Galilei', 'Orbscan', 'Sirius', 'Other'];
  const IMAGE_CATEGORIES = ['Pentacam', 'Topography', 'Aberrometry', 'Slit lamp', 'Anterior OCT', 'Corneal biomechanics', 'Other'];
  const CONE_SEVERITY = ['None', 'Suspect', 'Forme fruste', 'Mild', 'Moderate', 'Advanced'];
  const ABCD_CLASS = ['Normal', 'A', 'B', 'C', 'D'];
  const RISK_LEVELS = ['Low risk', 'Moderate risk', 'High risk', 'Contraindicated'];
  const FOLLOW_UP_VISITS = ['Day 1', 'Week 1', 'Month 1', 'Month 3', 'Month 6', 'Year 1'];
  const DOMINANT_EYE = ['OD', 'OS', 'Unknown'];
  const YES_NO = ['Yes', 'No'];
  const SEVERITY = ['None', 'Mild', 'Moderate', 'Severe'];
  const STABLE = ['Yes', 'No', 'Unknown'];

  const ASSESSMENT_FIELDS = [
    { key: 'occupation', label: 'Occupation' },
    { key: 'sports', label: 'Sports / hobbies' },
    { key: 'nightDriving', label: 'Night driving', select: ['Frequent', 'Occasional', 'Rare', 'Never'] },
    { key: 'visualDemands', label: 'Visual demands', select: ['High', 'Moderate', 'Low'] },
    { key: 'pregnancy', label: 'Pregnancy', chip: YES_NO },
    { key: 'breastfeeding', label: 'Breastfeeding', chip: YES_NO },
    { key: 'autoimmune', label: 'Autoimmune disease', chip: YES_NO },
    { key: 'diabetes', label: 'Diabetes', chip: YES_NO },
    { key: 'collagenVascular', label: 'Collagen vascular disease', chip: YES_NO },
    { key: 'atopy', label: 'Atopy', chip: YES_NO },
    { key: 'eyeRubbing', label: 'Eye rubbing', chip: ['None', 'Occasional', 'Frequent'] },
    { key: 'dryEyeSymptoms', label: 'Dry eye symptoms', chip: SEVERITY },
    { key: 'clHistory', label: 'Contact lens history', select: ['None', 'Soft', 'RGP', 'Both', 'Current wearer'] },
    { key: 'familyKc', label: 'Family history keratoconus', chip: YES_NO },
    { key: 'prevEyeSurgery', label: 'Previous eye surgery', chip: YES_NO },
    { key: 'prevTrauma', label: 'Previous trauma', chip: YES_NO },
    { key: 'prevInfection', label: 'Previous infection', chip: YES_NO },
    { key: 'medications', label: 'Medications', full: true },
    { key: 'expectations', label: 'Patient expectations', full: true },
    { key: 'dominantEye', label: 'Dominant eye', chip: DOMINANT_EYE }
  ];

  const REFRACTION_FIELDS = [
    { key: 'ucva', label: 'UCVA', od: true, os: true },
    { key: 'bcva', label: 'BCVA', od: true, os: true },
    { key: 'manifestSph', label: 'Manifest sphere (D)', od: true, os: true },
    { key: 'manifestCyl', label: 'Manifest cylinder (D)', od: true, os: true },
    { key: 'manifestAxis', label: 'Manifest axis', od: true, os: true },
    { key: 'cycloSph', label: 'Cycloplegic sphere (D)', od: true, os: true },
    { key: 'cycloCyl', label: 'Cycloplegic cylinder (D)', od: true, os: true },
    { key: 'cycloAxis', label: 'Cycloplegic axis', od: true, os: true },
    { key: 'autoSph', label: 'Auto refraction sphere', od: true, os: true },
    { key: 'autoCyl', label: 'Auto refraction cylinder', od: true, os: true },
    { key: 'residualAstig', label: 'Residual astigmatism', od: true, os: true },
    { key: 'vertexDistance', label: 'Vertex distance (mm)', shared: true },
    { key: 'nearAdd', label: 'Near add (D)', shared: true },
    { key: 'presbyopia', label: 'Presbyopia', shared: true, chip: YES_NO },
    { key: 'stableRefraction', label: 'Stable refraction', shared: true, chip: STABLE },
    { key: 'yearsStable', label: 'Years stable', shared: true }
  ];

  const CORNEAL_FIELDS = [
    { key: 'k1', label: 'K1 (D)', od: true, os: true },
    { key: 'k2', label: 'K2 (D)', od: true, os: true },
    { key: 'kmax', label: 'Kmax (D)', od: true, os: true },
    { key: 'astigmatism', label: 'Astigmatism (D)', od: true, os: true },
    { key: 'pachymetry', label: 'Central pachymetry (µm)', od: true, os: true },
    { key: 'thinnestPachy', label: 'Thinnest pachymetry (µm)', od: true, os: true },
    { key: 'cornealDiameter', label: 'Corneal diameter (mm)', od: true, os: true },
    { key: 'hvid', label: 'HVID / WTW (mm)', od: true, os: true },
    { key: 'scarring', label: 'Scarring', od: true, os: true, chip: SEVERITY },
    { key: 'neovascularization', label: 'Neovascularization', od: true, os: true, chip: SEVERITY },
    { key: 'sensation', label: 'Corneal sensation', od: true, os: true, select: ['Normal', 'Reduced', 'Absent'] },
    { key: 'dystrophy', label: 'Corneal dystrophy', od: true, os: true, chip: YES_NO },
    { key: 'degeneration', label: 'Corneal degeneration', od: true, os: true, chip: YES_NO },
    { key: 'prevGraft', label: 'Previous graft', od: true, os: true, chip: YES_NO },
    { key: 'keratoconus', label: 'Keratoconus', od: true, os: true, chip: YES_NO },
    { key: 'pmd', label: 'PMD', od: true, os: true, chip: YES_NO }
  ];

  const OCULAR_SURFACE_FIELDS = [
    { key: 'tbut', label: 'TBUT (sec)', od: true, os: true },
    { key: 'schirmer', label: 'Schirmer (mm)', od: true, os: true },
    { key: 'mgd', label: 'MGD', od: true, os: true, chip: SEVERITY },
    { key: 'blepharitis', label: 'Blepharitis', od: true, os: true, chip: SEVERITY },
    { key: 'staining', label: 'Staining', od: true, os: true, chip: SEVERITY },
    { key: 'dryEyeSeverity', label: 'Dry eye severity', od: true, os: true, chip: SEVERITY },
    { key: 'lidAbnormalities', label: 'Lid abnormalities', od: true, os: true, chip: YES_NO },
    { key: 'lagophthalmos', label: 'Lagophthalmos', od: true, os: true, chip: YES_NO },
    { key: 'exposure', label: 'Exposure', od: true, os: true, chip: YES_NO },
    { key: 'allergy', label: 'Allergy', od: true, os: true, chip: SEVERITY },
    { key: 'treatmentInitiated', label: 'Treatment initiated', shared: true, full: true }
  ];

  const TOPOGRAPHY_FIELDS = [
    { key: 'device', label: 'Device', chip: TOPO_DEVICES, shared: true },
    { key: 'anteriorElevation', label: 'Anterior elevation (µm)', od: true, os: true },
    { key: 'posteriorElevation', label: 'Posterior elevation (µm)', od: true, os: true },
    { key: 'badD', label: 'BAD-D', od: true, os: true },
    { key: 'abcd', label: 'ABCD classification', od: true, os: true, chip: ABCD_CLASS },
    { key: 'coneLocation', label: 'Cone location', od: true, os: true },
    { key: 'coneSeverity', label: 'Cone severity', od: true, os: true, chip: CONE_SEVERITY },
    { key: 'belinDisplay', label: 'Belin display', od: true, os: true, select: ['Normal', 'Abnormal', 'Borderline'] },
    { key: 'progression', label: 'Progression', od: true, os: true, chip: ['None', 'Suspect', 'Confirmed'] },
    { key: 'symmetry', label: 'Symmetry', od: true, os: true, select: ['Symmetric', 'Asymmetric'] },
    { key: 'pachyProgression', label: 'Pachymetry progression', od: true, os: true, chip: ['None', 'Suspect', 'Confirmed'] },
    { key: 'indices', label: 'Indices / notes', shared: true, full: true }
  ];

  const ABERROMETRY_FIELDS = [
    { key: 'hoa', label: 'Higher order aberrations (µm)', od: true, os: true },
    { key: 'coma', label: 'Coma (µm)', od: true, os: true },
    { key: 'trefoil', label: 'Trefoil (µm)', od: true, os: true },
    { key: 'sphericalAberration', label: 'Spherical aberration (µm)', od: true, os: true },
    { key: 'rms', label: 'RMS (µm)', od: true, os: true },
    { key: 'pupilSize', label: 'Pupil size (mm)', od: true, os: true },
    { key: 'mesopicPupil', label: 'Mesopic pupil (mm)', od: true, os: true },
    { key: 'photopicPupil', label: 'Photopic pupil (mm)', od: true, os: true },
    { key: 'wavefrontAvailable', label: 'Wavefront available', shared: true, chip: YES_NO }
  ];

  const CONSENT_TOPICS = [
    'Benefits explained', 'Risks explained', 'Dry eye discussed', 'Glare / halos discussed',
    'Regression discussed', 'Enhancement discussed', 'Ectasia risk discussed', 'Infection discussed',
    'Need for glasses discussed', 'Questions answered', 'Cooling-off period'
  ];

  const CONSENT_RISKS = [
    'Dry eye', 'Glare', 'Halos', 'Regression', 'Enhancement', 'Ectasia', 'Infection', 'Need for glasses'
  ];

  const SURGERY_FIELDS = [
    { key: 'date', label: 'Date', type: 'date' },
    { key: 'procedure', label: 'Procedure', select: PROCEDURES },
    { key: 'platform', label: 'Laser platform' },
    { key: 'surgeon', label: 'Surgeon' },
    { key: 'eye', label: 'Eye', chip: ['OD', 'OS', 'Both'] },
    { key: 'flapThickness', label: 'Flap thickness (µm)' },
    { key: 'capThickness', label: 'Cap thickness (µm)' },
    { key: 'opticalZone', label: 'Optical zone (mm)' },
    { key: 'ablationDepth', label: 'Ablation depth (µm)' },
    { key: 'complications', label: 'Complications', full: true },
    { key: 'enhancements', label: 'Enhancements', full: true }
  ];

  const FOLLOW_UP_FIELDS = [
    { key: 'ucva', label: 'UCVA', od: true, os: true },
    { key: 'bcva', label: 'BCVA', od: true, os: true },
    { key: 'refraction', label: 'Refraction', od: true, os: true },
    { key: 'healing', label: 'Healing', od: true, os: true, select: ['Normal', 'Delayed', 'Abnormal'] },
    { key: 'dryEye', label: 'Dry eye', od: true, os: true, chip: SEVERITY },
    { key: 'flap', label: 'Flap', od: true, os: true, select: ['Normal', 'Striae', 'Displaced', 'DLK'] },
    { key: 'interface', label: 'Interface', od: true, os: true, select: ['Clear', 'Haze', 'Debris'] },
    { key: 'haze', label: 'Haze', od: true, os: true, chip: SEVERITY },
    { key: 'regression', label: 'Regression', od: true, os: true, chip: YES_NO },
    { key: 'complications', label: 'Complications', full: true }
  ];

  const OUTCOME_METRICS = [
    { key: 'efficacyIndex', label: 'Efficacy index' },
    { key: 'safetyIndex', label: 'Safety index' },
    { key: 'predictability', label: 'Predictability (%)' },
    { key: 'stability', label: 'Stability', select: ['Stable', 'Mild drift', 'Regression'] },
    { key: 'enhancementRate', label: 'Enhancement rate (%)' },
    { key: 'dryEyeOutcome', label: 'Dry eye outcome', chip: SEVERITY },
    { key: 'satisfaction', label: 'Patient satisfaction', select: ['Excellent', 'Good', 'Fair', 'Poor'] },
    { key: 'nightVision', label: 'Night vision', select: ['Excellent', 'Good', 'Fair', 'Poor'] },
    { key: 'qualityOfVision', label: 'Quality of vision', select: ['Excellent', 'Good', 'Fair', 'Poor'] }
  ];

  const NORMAL_TEMPLATES = {
    'Normal pre-op': {
      assessment: { dryEyeSymptoms: 'None', eyeRubbing: 'None', prevEyeSurgery: 'No', prevTrauma: 'No', prevInfection: 'No' },
      ocularSurface: { od: { tbut: '>10', schirmer: 'Normal', mgd: 'None', blepharitis: 'None', staining: 'None', dryEyeSeverity: 'None' }, os: {} },
      corneal: { od: { scarring: 'None', neovascularization: 'None', sensation: 'Normal', dystrophy: 'No', degeneration: 'No', prevGraft: 'No', keratoconus: 'No', pmd: 'No' }, os: {} }
    },
    'Dry eye work-up': {
      assessment: { dryEyeSymptoms: 'Moderate' },
      ocularSurface: { od: { tbut: '5', schirmer: '8', mgd: 'Moderate', dryEyeSeverity: 'Moderate' }, os: {} }
    }
  };

  function num(v) {
    const n = parseFloat(String(v || '').replace(/[^\d.-]/g, ''));
    return Number.isNaN(n) ? null : n;
  }

  function eyeVal(workup, section, key, eye) {
    const sec = workup?.[section] || {};
    if (eye === 'shared') return sec.shared?.[key] ?? sec[key];
    return sec[eye]?.[key] ?? sec.shared?.[key];
  }

  function worstEye(workup, section, key) {
    const od = num(eyeVal(workup, section, key, 'od'));
    const os = num(eyeVal(workup, section, key, 'os'));
    if (od == null && os == null) return null;
    if (od == null) return os;
    if (os == null) return od;
    return Math.max(Math.abs(od), Math.abs(os));
  }

  function minPachy(workup) {
    const od = num(eyeVal(workup, 'corneal', 'thinnestPachy', 'od')) || num(eyeVal(workup, 'corneal', 'pachymetry', 'od'));
    const os = num(eyeVal(workup, 'corneal', 'thinnestPachy', 'os')) || num(eyeVal(workup, 'corneal', 'pachymetry', 'os'));
    if (od == null && os == null) return null;
    if (od == null) return os;
    if (os == null) return od;
    return Math.min(od, os);
  }

  function estimateAblationDepth(sph, cyl) {
    const s = Math.abs(num(sph) || 0);
    const c = Math.abs(num(cyl) || 0);
    return Math.round((s + c / 2) * 12.5);
  }

  function computePlanning(workup) {
    const odSph = num(eyeVal(workup, 'refraction', 'manifestSph', 'od'));
    const osSph = num(eyeVal(workup, 'refraction', 'manifestSph', 'os'));
    const odCyl = num(eyeVal(workup, 'refraction', 'manifestCyl', 'od'));
    const osCyl = num(eyeVal(workup, 'refraction', 'manifestCyl', 'os'));
    const sph = odSph != null ? odSph : osSph;
    const cyl = odCyl != null ? odCyl : osCyl;
    const pachy = minPachy(workup) || 540;
    const flap = num(workup?.planning?.flapThickness) || 110;
    const cap = num(workup?.planning?.capThickness) || 120;
    const ablation = estimateAblationDepth(sph, cyl);
    const rsb = pachy - flap - ablation;
    const pta = ((pachy - rsb) / pachy) * 100;
    const opticalZone = num(workup?.planning?.opticalZone) || 6.5;
    const transitionZone = num(workup?.planning?.transitionZone) || 8.5;
    const safetyMargin = rsb != null ? rsb - 250 : null;

    const suitability = {};
    const myopia = sph != null && sph < -0.5;
    const hyperopia = sph != null && sph > 0.5;
    const highMyopia = sph != null && sph <= -6;
    const highHyperopia = sph != null && sph >= 3;
    const thin = pachy < 500;
    const kc = eyeVal(workup, 'corneal', 'keratoconus', 'od') === 'Yes' || eyeVal(workup, 'corneal', 'keratoconus', 'os') === 'Yes';
    const pmd = eyeVal(workup, 'corneal', 'pmd', 'od') === 'Yes' || eyeVal(workup, 'corneal', 'pmd', 'os') === 'Yes';
    const dry = ['Moderate', 'Severe'].includes(eyeVal(workup, 'ocularSurface', 'dryEyeSeverity', 'od')) ||
      ['Moderate', 'Severe'].includes(eyeVal(workup, 'ocularSurface', 'dryEyeSeverity', 'os'));

    suitability.LASIK = !kc && !pmd && !thin && rsb >= 250 ? (highMyopia ? 'Caution' : 'Suitable') : 'Not suitable';
    suitability['Femto LASIK'] = suitability.LASIK;
    suitability.SMILE = !kc && !pmd && myopia && !highHyperopia && pachy >= 480 ? 'Suitable' : 'Not suitable';
    suitability.PRK = !kc && !pmd ? (thin ? 'Preferred' : 'Suitable') : 'Not suitable';
    suitability.TransPRK = suitability.PRK;
    suitability.LASEK = suitability.PRK;
    suitability.PTK = eyeVal(workup, 'corneal', 'scarring', 'od') !== 'None' || eyeVal(workup, 'corneal', 'scarring', 'os') !== 'None' ? 'Consider' : 'Not indicated';
    suitability['Topography-guided'] = kc || pmd ? 'Not suitable' : 'Consider if irregular astigmatism';
    suitability['Wavefront-guided'] = 'Consider if aberrrometry available';
    suitability['ICL screening'] = highMyopia && pachy < 520 ? 'Suitable' : (highMyopia ? 'Consider' : 'Not indicated');
    suitability['RLE screening'] = (num(global.document?.getElementById?.('age')?.value) >= 45) ? 'Consider if presbyopia' : 'Not indicated';
    suitability['No surgery'] = kc || pmd ? 'Required' : '—';

    return {
      ablationDepth: ablation,
      flapThickness: flap,
      capThickness: cap,
      residualStromalBed: rsb,
      ptaPercent: Math.round(pta * 10) / 10,
      opticalZone,
      transitionZone,
      safetyMargin,
      centralPachymetry: pachy,
      suitability,
      recommendedProcedure: kc || pmd ? 'No surgery' : thin || rsb < 280 ? 'PRK' : highMyopia && pachy < 520 ? 'ICL screening' : myopia ? 'SMILE' : 'LASIK'
    };
  }

  function computeRisk(workup) {
    const warnings = [];
    const factors = {};
    let score = 0;

    const pachy = minPachy(workup);
    const badD = Math.max(num(eyeVal(workup, 'topography', 'badD', 'od')) || 0, num(eyeVal(workup, 'topography', 'badD', 'os')) || 0);
    const kc = eyeVal(workup, 'corneal', 'keratoconus', 'od') === 'Yes' || eyeVal(workup, 'corneal', 'keratoconus', 'os') === 'Yes';
    const pmd = eyeVal(workup, 'corneal', 'pmd', 'od') === 'Yes' || eyeVal(workup, 'corneal', 'pmd', 'os') === 'Yes';
    const planning = computePlanning(workup);
    const sph = worstEye(workup, 'refraction', 'manifestSph');
    const stable = eyeVal(workup, 'refraction', 'stableRefraction', 'shared');
    const pregnancy = eyeVal(workup, 'assessment', 'pregnancy', 'shared') === 'Yes';
    const autoimmune = eyeVal(workup, 'assessment', 'autoimmune', 'shared') === 'Yes';
    const drySevere = ['Moderate', 'Severe'].includes(eyeVal(workup, 'ocularSurface', 'dryEyeSeverity', 'od')) ||
      ['Moderate', 'Severe'].includes(eyeVal(workup, 'ocularSurface', 'dryEyeSeverity', 'os'));
    const mesopic = Math.max(num(eyeVal(workup, 'aberrometry', 'mesopicPupil', 'od')) || 0, num(eyeVal(workup, 'aberrometry', 'mesopicPupil', 'os')) || 0);
    const prevSx = eyeVal(workup, 'assessment', 'prevEyeSurgery', 'shared') === 'Yes';

    if (kc) { score += 40; factors.kc = 'High'; warnings.push('Keratoconus — contraindication to laser vision correction'); }
    else if (pmd) { score += 35; factors.pmd = 'High'; warnings.push('PMD — contraindication to standard LASIK'); }
    if (pachy != null && pachy < 480) { score += 25; factors.thinCornea = 'High'; warnings.push(`Thin cornea (${pachy} µm) — consider PRK or ICL`); }
    else if (pachy != null && pachy < 500) { score += 12; factors.thinCornea = 'Moderate'; warnings.push('Borderline corneal thickness'); }
    if (badD >= 1.6) { score += 20; factors.badD = 'High'; warnings.push(`Elevated BAD-D (${badD}) — ectasia risk`); }
    else if (badD >= 1.3) { score += 10; factors.badD = 'Moderate'; warnings.push('Borderline BAD-D'); }
    if (planning.ptaPercent > 40) { score += 20; factors.pta = 'High'; warnings.push(`High PTA (${planning.ptaPercent}%) — ectasia risk`); }
    if (planning.residualStromalBed != null && planning.residualStromalBed < 250) {
      score += 25; factors.rsb = 'High'; warnings.push(`Low RSB (${planning.residualStromalBed} µm)`);
    }
    if (drySevere) { score += 10; factors.dryEye = 'Moderate'; warnings.push('Significant dry eye — optimize surface pre-op'); }
    if (autoimmune) { score += 15; factors.autoimmune = 'High'; warnings.push('Autoimmune disease — poor healing risk'); }
    if (pregnancy) { score += 30; factors.pregnancy = 'High'; warnings.push('Pregnancy — defer surgery'); }
    if (stable === 'No') { score += 15; factors.unstableRx = 'High'; warnings.push('Unstable refraction'); }
    if (sph != null && sph <= -8) { score += 8; factors.highMyopia = 'Moderate'; warnings.push('High myopia — consider ICL'); }
    if (sph != null && sph >= 4) { score += 8; factors.highHyperopia = 'Moderate'; warnings.push('High hyperopia — regression risk'); }
    if (prevSx) { score += 8; factors.prevSurgery = 'Moderate'; warnings.push('Previous eye surgery — review interface'); }
    if (mesopic >= 7) { score += 6; factors.nightGlare = 'Moderate'; warnings.push('Large mesopic pupil — night glare risk'); }

    factors.ectasia = score >= 30 ? 'High' : score >= 15 ? 'Moderate' : 'Low';
    factors.regression = (sph != null && Math.abs(sph) >= 6) ? 'Moderate' : 'Low';
    factors.healing = autoimmune ? 'High' : drySevere ? 'Moderate' : 'Low';

    let level = 'Low risk';
    if (kc || pmd || pregnancy || (planning.residualStromalBed != null && planning.residualStromalBed < 220)) level = 'Contraindicated';
    else if (score >= 35) level = 'High risk';
    else if (score >= 18) level = 'Moderate risk';

    return { level, score, factors, warnings, planning };
  }

  function computeSafetyAlerts(workup) {
    return computeRisk(workup).warnings.map((msg) => ({ level: msg.includes('contraindication') || msg.includes('defer') ? 'urgent' : 'high', msg }));
  }

  global.CorneaLaserRefractiveTaxonomy = {
    LR_TABS, PROCEDURES, TOPO_DEVICES, IMAGE_CATEGORIES, CONE_SEVERITY, ABCD_CLASS, RISK_LEVELS,
    FOLLOW_UP_VISITS, ASSESSMENT_FIELDS, REFRACTION_FIELDS, CORNEAL_FIELDS, OCULAR_SURFACE_FIELDS,
    TOPOGRAPHY_FIELDS, ABERROMETRY_FIELDS, CONSENT_TOPICS, CONSENT_RISKS, SURGERY_FIELDS,
    FOLLOW_UP_FIELDS, OUTCOME_METRICS, NORMAL_TEMPLATES, YES_NO, SEVERITY,
    computeRisk, computePlanning, computeSafetyAlerts, num, eyeVal, minPachy, estimateAblationDepth
  };
})(typeof window !== 'undefined' ? window : globalThis);
