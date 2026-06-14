/**
 * Scleral Lens Fitting Wizard — taxonomy, templates, recommendation engine
 */
(function (global) {
  'use strict';

  const SL_STEPS = [
    { id: 1, key: 'indication', title: 'Patient Selection', icon: 'fa-user-check' },
    { id: 2, key: 'prefitting', title: 'Pre-fitting Assessment', icon: 'fa-stethoscope' },
    { id: 3, key: 'trialSelection', title: 'Trial Lens Selection', icon: 'fa-circle-dot' },
    { id: 4, key: 'insertion', title: 'Lens Insertion', icon: 'fa-hand-holding-droplet' },
    { id: 5, key: 'centralClearance', title: 'Central Clearance', icon: 'fa-bullseye' },
    { id: 6, key: 'limbalClearance', title: 'Limbal Clearance', icon: 'fa-ring' },
    { id: 7, key: 'landingZone', title: 'Landing Zone', icon: 'fa-border-all' },
    { id: 8, key: 'movement', title: 'Lens Movement', icon: 'fa-arrows-up-down-left-right' },
    { id: 9, key: 'overRefraction', title: 'Over Refraction', icon: 'fa-glasses' },
    { id: 10, key: 'finalDesign', title: 'Final Lens Design', icon: 'fa-prescription' },
    { id: 11, key: 'complications', title: 'Complication Check', icon: 'fa-triangle-exclamation' },
    { id: 12, key: 'education', title: 'Patient Education', icon: 'fa-graduation-cap' },
    { id: 13, key: 'followUp', title: 'Follow-up', icon: 'fa-calendar-check' }
  ];

  const INDICATIONS = [
    'Keratoconus', 'PMD', 'Post PKP', 'Post DALK', 'Post LASIK', 'Post RK', 'Post trauma',
    'Irregular astigmatism', 'Corneal scar', 'Severe dry eye', 'Sjogren syndrome', 'GVHD',
    'Neurotrophic keratitis', 'Persistent epithelial defect', 'Bullous keratopathy',
    'Exposure keratopathy', 'Chemical injury', 'Stevens Johnson syndrome', 'OCP',
    'Limbal stem cell deficiency', 'High refractive error', 'Other'
  ];

  const CENTRAL_CLEARANCE_MICRONS = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
  const QUADRANTS = ['Superior', 'Inferior', 'Nasal', 'Temporal'];
  const LIMBAL_OPTIONS = ['Normal', 'Touch', 'Minimal clearance', 'Excessive clearance'];
  const LANDING_FINDINGS = ['Alignment', 'Compression', 'Impingement', 'Edge lift', 'Blanching', 'Seal off'];
  const MOVEMENT_OPTIONS = ['No movement', 'Minimal', 'Normal', 'Excessive'];
  const DECENTRATION = ['Superior', 'Inferior', 'Nasal', 'Temporal', 'None'];

  const COMPLICATIONS = [
    'Bubble', 'Compression', 'Impingement', 'Edge lift', 'Corneal touch', 'Limbal touch',
    'Corneal staining', 'Conjunctival staining', 'Hypoxia', 'Fogging', 'Midday fogging',
    'Deposits', 'Poor comfort', 'Dryness', 'Lens awareness'
  ];

  const EDUCATION_ITEMS = [
    'Insertion taught', 'Removal taught', 'Cleaning explained', 'Storage explained',
    'Saline explained', 'Emergency advice given', 'Written instructions printed'
  ];

  const FOLLOW_UP_INTERVALS = [
    { key: '1d', label: '1 day' }, { key: '1w', label: '1 week' }, { key: '2w', label: '2 weeks' },
    { key: '1m', label: '1 month' }, { key: '3m', label: '3 months' },
    { key: '6m', label: '6 months' }, { key: '12m', label: '12 months' }
  ];

  const FOLLOW_UP_TRACK = ['Comfort', 'Vision', 'Fit', 'Clearance', 'Fogging', 'Compliance', 'Complications'];

  const PHOTO_CATEGORIES = [
    { key: 'slit_lamp', label: 'Slit lamp photo' },
    { key: 'fluorescein', label: 'Fluorescein photo' },
    { key: 'oct', label: 'Anterior OCT' },
    { key: 'topography', label: 'Topography' }
  ];

  const PREFIT_FIELDS = [
    { key: 'ucva', label: 'UCVA', od: true, os: true },
    { key: 'bcva', label: 'BCVA', od: true, os: true },
    { key: 'manifestRefraction', label: 'Manifest refraction', od: true, os: true },
    { key: 'k1', label: 'K1', od: true, os: true },
    { key: 'k2', label: 'K2', od: true, os: true },
    { key: 'kmax', label: 'Kmax', od: true, os: true },
    { key: 'astigmatism', label: 'Astigmatism', od: true, os: true },
    { key: 'pachymetry', label: 'Pachymetry', od: true, os: true },
    { key: 'hvid', label: 'HVID', od: true, os: true },
    { key: 'whiteToWhite', label: 'White to white', od: true, os: true },
    { key: 'pupilSize', label: 'Pupil size', od: true, os: true },
    { key: 'tbut', label: 'TBUT', od: true, os: true },
    { key: 'schirmer', label: 'Schirmer', od: true, os: true },
    { key: 'cornealStaining', label: 'Corneal staining', od: true, os: true },
    { key: 'conjunctivalStaining', label: 'Conjunctival staining', od: true, os: true },
    { key: 'lidAbnormalities', label: 'Lid abnormalities', od: true, os: true },
    { key: 'blepharitis', label: 'Blepharitis', chip: true },
    { key: 'mgd', label: 'MGD', chip: true },
    { key: 'cornealGraft', label: 'Corneal graft', od: true, os: true },
    { key: 'cornealScar', label: 'Corneal scar', od: true, os: true },
    { key: 'cornealNeovascularization', label: 'Corneal neovascularization', od: true, os: true },
    { key: 'topographyAvailable', label: 'Topography available', chip: true },
    { key: 'anteriorOctAvailable', label: 'Anterior OCT available', chip: true }
  ];

  const TRIAL_FIELDS = [
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'design', label: 'Lens design' },
    { key: 'trialSet', label: 'Trial set' },
    { key: 'diameter', label: 'Diameter' },
    { key: 'baseCurve', label: 'Base curve' },
    { key: 'sagittalDepth', label: 'Sagittal depth' },
    { key: 'landingZone', label: 'Landing zone' },
    { key: 'peripheralCurve', label: 'Peripheral curve' },
    { key: 'power', label: 'Power' },
    { key: 'material', label: 'Material' },
    { key: 'dk', label: 'DK' },
    { key: 'surfaceCoating', label: 'Surface coating' },
    { key: 'tint', label: 'Tint' }
  ];

  const FINAL_DESIGN_FIELDS = [
    'sagittalDepth', 'diameter', 'baseCurve', 'landingZone', 'peripheralCurve',
    'power', 'cylinder', 'axis', 'material', 'surfaceTreatment', 'manufacturer'
  ];

  const SPECIALIST_TEMPLATES = {
    'Keratoconus': { indication: ['Keratoconus'], trialSelection: { shared: { design: 'Scleral', sagittalDepth: '3800', diameter: '16.0' } } },
    'Advanced keratoconus': { indication: ['Keratoconus'], trialSelection: { shared: { design: 'Scleral', sagittalDepth: '4200', diameter: '16.5' } } },
    'Post PKP': { indication: ['Post PKP'], trialSelection: { shared: { design: 'Scleral', sagittalDepth: '4000' } } },
    'Post DALK': { indication: ['Post DALK'], trialSelection: { shared: { design: 'Scleral', sagittalDepth: '3900' } } },
    'Severe dry eye': { indication: ['Severe dry eye'], trialSelection: { shared: { material: 'High DK', surfaceCoating: 'Plasma' } } },
    'Neurotrophic keratitis': { indication: ['Neurotrophic keratitis'], trialSelection: { shared: { design: 'Scleral therapeutic' } } },
    'Persistent epithelial defect': { indication: ['Persistent epithelial defect'], trialSelection: { shared: { design: 'Bandage scleral' } } },
    'Bullous keratopathy': { indication: ['Bullous keratopathy'], trialSelection: { shared: { sagittalDepth: '4100' } } },
    'Chemical injury': { indication: ['Chemical injury'], trialSelection: { shared: { diameter: '17.0' } } },
    'Stevens Johnson syndrome': { indication: ['Stevens Johnson syndrome'], trialSelection: { shared: { diameter: '17.5', material: 'High DK' } } },
    'GVHD': { indication: ['GVHD'], trialSelection: { shared: { surfaceCoating: 'Plasma' } } }
  };

  const SAFETY_RULES = [
    { check: (f) => (f.complications?.findings || []).includes('Corneal touch'), msg: 'Corneal touch — adjust sag or landing zone before dispensing' },
    { check: (f) => (f.complications?.findings || []).includes('Hypoxia'), msg: 'Hypoxia risk — review material DK and wearing time' },
    { check: (f) => f.prefitting?.shared?.blepharitis === 'Yes', msg: 'Active blepharitis — treat before fitting' },
    { check: (f) => f.prefitting?.od?.cornealStaining?.toLowerCase?.().includes('severe'), msg: 'Severe corneal staining — defer or bandage protocol' },
    { check: (f) => f.prefitting?.shared?.cornealGraft === 'Rejection', msg: 'Graft rejection — do not fit until resolved' }
  ];

  function clearanceStatus(microns) {
    const m = Number(microns);
    if (!m || Number.isNaN(m)) return { status: '', label: '', cls: '' };
    if (m < 150) return { status: 'low', label: 'Too low', cls: 'sl-clearance-low', rec: 'Increase sagittal depth' };
    if (m <= 350) return { status: 'ideal', label: 'Ideal', cls: 'sl-clearance-ideal', rec: 'Accept fit' };
    return { status: 'high', label: 'Too high', cls: 'sl-clearance-high', rec: 'Decrease sagittal depth' };
  }

  function computeRecommendations(fit) {
    const recs = [];
    const cc = fit.centralClearance?.shared || {};
    const cs = clearanceStatus(cc.odMicrons || cc.osMicrons || cc.estimate);
    if (cs.rec && cs.rec !== 'Accept fit') recs.push(cs.rec);

    QUADRANTS.forEach((q) => {
      const lc = fit.limbalClearance?.[q];
      if (lc === 'Touch') recs.push(`${q} limbal touch — increase sag or diameter`);
      if (lc === 'Excessive clearance') recs.push(`${q} excessive limbal clearance — decrease sag`);
    });

    QUADRANTS.forEach((q) => {
      const lz = fit.landingZone?.[q];
      if (lz === 'Compression') recs.push(`${q} landing compression — flatten landing zone`);
      if (lz === 'Impingement') recs.push(`${q} impingement — steepen landing zone`);
      if (lz === 'Edge lift') recs.push(`${q} edge lift — adjust peripheral curve`);
      if (lz === 'Seal off') recs.push(`${q} seal off — improve tear exchange`);
    });

    const mv = fit.movement?.amount;
    if (mv === 'No movement') recs.push('No lens movement — consider increasing sag');
    if (mv === 'Excessive') recs.push('Excessive movement — decrease sag or adjust diameter');

    (fit.complications?.findings || []).forEach((c) => {
      if (c === 'Bubble') recs.push('Bubble — reinsert with fill technique');
      if (c === 'Fogging' || c === 'Midday fogging') recs.push('Fogging — surface coating or material change');
      if (c === 'Dryness') recs.push('Dryness — review fit clearance and saline protocol');
    });

    return [...new Set(recs)];
  }

  function suggestFinalDesign(fit) {
    const trial = fit.trialSelection?.shared || {};
    const orx = fit.overRefraction?.od || {};
    const cc = fit.centralClearance?.shared || {};
    const design = { ...trial };
    if (orx.sphere) {
      const base = parseFloat(trial.power) || 0;
      const add = parseFloat(orx.sphere) || 0;
      if (!Number.isNaN(base + add)) design.power = String(Math.round((base + add) * 100) / 100);
    }
    if (orx.cylinder) design.cylinder = orx.cylinder;
    if (orx.axis) design.axis = orx.axis;
    if (cc.recommendation === 'Increase sagittal depth' && trial.sagittalDepth) {
      design.sagittalDepth = String(Math.round((parseFloat(trial.sagittalDepth) || 0) + 200));
    }
    if (cc.recommendation === 'Decrease sagittal depth' && trial.sagittalDepth) {
      design.sagittalDepth = String(Math.max(0, Math.round((parseFloat(trial.sagittalDepth) || 0) - 200)));
    }
    design.surfaceTreatment = trial.surfaceCoating || design.surfaceTreatment || '';
    return design;
  }

  global.CorneaScleralLensTaxonomy = {
    SL_STEPS, INDICATIONS, CENTRAL_CLEARANCE_MICRONS, QUADRANTS, LIMBAL_OPTIONS,
    LANDING_FINDINGS, MOVEMENT_OPTIONS, DECENTRATION, COMPLICATIONS, EDUCATION_ITEMS,
    FOLLOW_UP_INTERVALS, FOLLOW_UP_TRACK, PHOTO_CATEGORIES, PREFIT_FIELDS, TRIAL_FIELDS,
    FINAL_DESIGN_FIELDS, SPECIALIST_TEMPLATES, SAFETY_RULES,
    clearanceStatus, computeRecommendations, suggestFinalDesign
  };
})(typeof window !== 'undefined' ? window : globalThis);
