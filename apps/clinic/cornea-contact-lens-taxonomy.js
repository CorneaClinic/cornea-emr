/**
 * Contact Lens module — field definitions, shortcuts, safety rules
 */
(function (global) {
  'use strict';

  const CL_TABS = [
    { id: 'indication', label: 'Indication', icon: 'fa-bullseye' },
    { id: 'prefitting', label: 'Pre-fitting', icon: 'fa-stethoscope' },
    { id: 'lensSelection', label: 'Lens Selection', icon: 'fa-circle-dot' },
    { id: 'trial', label: 'Trial Lens', icon: 'fa-vial' },
    { id: 'finalRx', label: 'Final Rx', icon: 'fa-prescription' },
    { id: 'dispensing', label: 'Dispensing', icon: 'fa-hand-holding-medical' },
    { id: 'followUp', label: 'Follow-up', icon: 'fa-calendar-check' },
    { id: 'complications', label: 'Complications', icon: 'fa-triangle-exclamation' },
    { id: 'inventory', label: 'Inventory', icon: 'fa-boxes-stacked' },
    { id: 'history', label: 'History', icon: 'fa-clock-rotate-left' }
  ];

  const INDICATIONS = [
    'Myopia', 'Hyperopia', 'Astigmatism', 'Presbyopia', 'Keratoconus',
    'Pellucid marginal degeneration', 'Post PKP', 'Post DALK', 'Post DMEK',
    'Post LASIK', 'Post PRK', 'Post RK', 'Corneal scar', 'Irregular astigmatism',
    'Bullous keratopathy', 'Dry eye', 'Bandage contact lens',
    'Persistent epithelial defect', 'Neurotrophic keratitis', 'Chemical injury',
    'Aphakia', 'Cosmetic', 'Orthokeratology', 'Pediatric aphakia', 'Other'
  ];

  const LENS_TYPES = [
    'Soft', 'RGP', 'Hybrid', 'Piggyback', 'Mini scleral', 'Scleral', 'Semi scleral',
    'Bandage', 'Orthokeratology', 'Toric', 'Multifocal', 'Cosmetic', 'Custom'
  ];

  const REPLACEMENT_SCHEDULES = ['Daily', 'Biweekly', 'Monthly', 'Quarterly', 'Annual', 'Custom'];
  const WEARING_SCHEDULES = ['Daily wear', 'Extended wear', 'Therapeutic'];

  const FOLLOW_UP_INTERVALS = [
    { key: '1d', label: '1 day', days: 1 },
    { key: '1w', label: '1 week', days: 7 },
    { key: '2w', label: '2 weeks', days: 14 },
    { key: '1m', label: '1 month', months: 1 },
    { key: '3m', label: '3 months', months: 3 },
    { key: '6m', label: '6 months', months: 6 },
    { key: '12m', label: '12 months', months: 12 }
  ];

  const FOLLOW_UP_COMPARE = [
    'VA', 'Comfort', 'Fit', 'Corneal staining', 'Lens condition',
    'Complications', 'Compliance', 'Replacement compliance', 'Cleaning compliance'
  ];

  const COMPLICATIONS = [
    'SPK', 'CLARE', 'CLPU', 'Infiltrate', 'Microbial keratitis', 'GPC', 'Dry eye',
    'Hypoxia', 'Neovascularization', 'Corneal edema', 'Tight lens', 'Loose lens',
    'Poor centration', 'Deposits', 'Giant papillary conjunctivitis', 'Corneal abrasion',
    'Lens intolerance', 'Lost lens', 'Broken lens'
  ];

  const DISPENSING_CHECKLIST = [
    'Insertion training', 'Removal training', 'Cleaning demonstrated',
    'Storage demonstrated', 'Written instructions given', 'Emergency advice given',
    'Backup glasses advised'
  ];

  const SOLUTIONS = [
    'Protein remover', 'Artificial tears', 'Cleaning system',
    'Hydrogen peroxide', 'Multipurpose solution'
  ];

  const INVENTORY_CATEGORIES = [
    'Trial lenses', 'Diagnostic lenses', 'Stock lenses', 'Scleral lenses', 'Bandage lenses'
  ];

  const TRIAL_ASSESSMENT_FIELDS = [
    { key: 'movement', label: 'Movement' },
    { key: 'centration', label: 'Centration' },
    { key: 'coverage', label: 'Coverage' },
    { key: 'rotation', label: 'Rotation' },
    { key: 'pushUpTest', label: 'Push up test' },
    { key: 'edgeAlignment', label: 'Edge alignment' },
    { key: 'apicalClearance', label: 'Apical clearance' },
    { key: 'limbalClearance', label: 'Limbal clearance' },
    { key: 'landingZone', label: 'Landing zone' },
    { key: 'bubble', label: 'Bubble' },
    { key: 'compression', label: 'Compression' },
    { key: 'impingement', label: 'Impingement' },
    { key: 'tearExchange', label: 'Tear exchange' },
    { key: 'overRefraction', label: 'Over-refraction' },
    { key: 'vaWithTrial', label: 'VA with trial lens' },
    { key: 'comfort', label: 'Comfort' },
    { key: 'insertionDifficulty', label: 'Insertion difficulty' },
    { key: 'removalDifficulty', label: 'Removal difficulty' },
    { key: 'fluoresceinPattern', label: 'Fluorescein pattern' },
    { key: 'cornealTouch', label: 'Corneal touch' },
    { key: 'threePointTouch', label: 'Three point touch' },
    { key: 'bearing', label: 'Bearing' },
    { key: 'sealOff', label: 'Seal off' },
    { key: 'lensStability', label: 'Lens stability' },
    { key: 'photographs', label: 'Photographs' },
    { key: 'clinicalDrawings', label: 'Clinical drawings' }
  ];

  const PREFITTING_FIELDS = [
    { key: 'ucva', label: 'UCVA', od: true, os: true },
    { key: 'bcva', label: 'BCVA', od: true, os: true },
    { key: 'manifestRefraction', label: 'Manifest refraction', od: true, os: true },
    { key: 'kReadings', label: 'K readings', od: true, os: true },
    { key: 'cornealAstigmatism', label: 'Corneal astigmatism', od: true, os: true },
    { key: 'topographyAvailable', label: 'Topography available', chip: true },
    { key: 'kmax', label: 'Kmax', od: true, os: true },
    { key: 'pachymetry', label: 'Pachymetry', od: true, os: true },
    { key: 'hvid', label: 'HVID', od: true, os: true },
    { key: 'pupilSize', label: 'Pupil size', od: true, os: true },
    { key: 'tearFilm', label: 'Tear film', od: true, os: true },
    { key: 'tbut', label: 'TBUT', od: true, os: true },
    { key: 'schirmer', label: 'Schirmer', od: true, os: true },
    { key: 'mgd', label: 'MGD', chip: true },
    { key: 'blepharitis', label: 'Blepharitis', chip: true },
    { key: 'dryEyeSeverity', label: 'Dry eye severity', od: true, os: true },
    { key: 'cornealSensation', label: 'Corneal sensation', od: true, os: true },
    { key: 'cornealStaining', label: 'Corneal staining', od: true, os: true },
    { key: 'conjunctivalStaining', label: 'Conjunctival staining', od: true, os: true },
    { key: 'cornealGraftStatus', label: 'Corneal graft status', od: true, os: true },
    { key: 'cornealScar', label: 'Corneal scar', od: true, os: true },
    { key: 'cornealVascularization', label: 'Corneal vascularization', od: true, os: true },
    { key: 'eyelidAbnormalities', label: 'Eyelid abnormalities', od: true, os: true },
    { key: 'previousClUse', label: 'Previous contact lens use', chip: true },
    { key: 'clIntolerance', label: 'Contact lens intolerance', chip: true }
  ];

  const LENS_PARAM_FIELDS = [
    { key: 'lensType', label: 'Lens type', select: LENS_TYPES },
    { key: 'manufacturer', label: 'Manufacturer' },
    { key: 'brand', label: 'Brand' },
    { key: 'material', label: 'Material' },
    { key: 'diameter', label: 'Diameter' },
    { key: 'baseCurve', label: 'Base curve' },
    { key: 'power', label: 'Power' },
    { key: 'cylinder', label: 'Cylinder' },
    { key: 'axis', label: 'Axis' },
    { key: 'add', label: 'Add' },
    { key: 'centerThickness', label: 'Center thickness' },
    { key: 'dk', label: 'DK' },
    { key: 'dkT', label: 'DK/T' },
    { key: 'tint', label: 'Tint' },
    { key: 'replacementSchedule', label: 'Replacement schedule', select: REPLACEMENT_SCHEDULES },
    { key: 'wearingSchedule', label: 'Wearing schedule', select: WEARING_SCHEDULES }
  ];

  const FINAL_RX_FIELDS = LENS_PARAM_FIELDS.concat([
    { key: 'expiryDate', label: 'Expiry date', type: 'date' },
    { key: 'warranty', label: 'Warranty' }
  ]);

  const SPECIALIST_TEMPLATES = {
    'Keratoconus RGP': {
      indication: ['Keratoconus'],
      lensSelection: { shared: { lensType: 'RGP' }, od: {}, os: {} },
      finalRx: { shared: { lensType: 'RGP' } }
    },
    'Keratoconus scleral': {
      indication: ['Keratoconus'],
      lensSelection: { shared: { lensType: 'Scleral' }, od: {}, os: {} }
    },
    'Post PKP RGP': {
      indication: ['Post PKP'],
      lensSelection: { shared: { lensType: 'RGP' }, od: {}, os: {} }
    },
    'Post DALK RGP': {
      indication: ['Post DALK'],
      lensSelection: { shared: { lensType: 'RGP' }, od: {}, os: {} }
    },
    'Bandage contact lens': {
      indication: ['Bandage contact lens'],
      lensSelection: { shared: { lensType: 'Bandage', wearingSchedule: 'Therapeutic' }, od: {}, os: {} }
    },
    'Persistent epithelial defect': {
      indication: ['Persistent epithelial defect'],
      lensSelection: { shared: { lensType: 'Bandage', wearingSchedule: 'Therapeutic' }, od: {}, os: {} }
    },
    'Bullous keratopathy': {
      indication: ['Bullous keratopathy'],
      lensSelection: { shared: { lensType: 'Bandage' }, od: {}, os: {} }
    },
    'Pediatric aphakia': {
      indication: ['Pediatric aphakia'],
      lensSelection: { shared: { lensType: 'Soft' }, od: {}, os: {} }
    },
    'Orthokeratology': {
      indication: ['Orthokeratology'],
      lensSelection: { shared: { lensType: 'Orthokeratology', wearingSchedule: 'Extended wear' }, od: {}, os: {} }
    },
    'Dry eye scleral lens': {
      indication: ['Dry eye'],
      lensSelection: { shared: { lensType: 'Scleral' }, od: {}, os: {} }
    }
  };

  const SAFETY_RULES = [
    { check: (f) => f.prefitting?.shared?.tearFilm === 'Poor' || f.prefitting?.od?.tearFilm === 'Poor' || f.prefitting?.os?.tearFilm === 'Poor', msg: 'Poor tear film — high risk for contact lens wear' },
    { check: (f) => (f.complications || []).includes('Microbial keratitis'), msg: 'Active or history of microbial keratitis — review before fitting' },
    { check: (f) => (f.complications || []).includes('CLPU') || (f.complications || []).includes('Corneal abrasion'), msg: 'Corneal ulcer / epithelial defect — defer fitting until healed' },
    { check: (f) => f.prefitting?.shared?.dryEyeSeverity === 'Severe' || f.prefitting?.od?.dryEyeSeverity === 'Severe', msg: 'Severe dry eye — consider scleral or defer' },
    { check: (f) => f.prefitting?.shared?.cornealGraftStatus === 'Rejection', msg: 'Graft rejection — do not fit until resolved' },
    { check: (f) => f.prefitting?.shared?.mgd === 'Yes' && f.prefitting?.shared?.blepharitis === 'Yes', msg: 'Active lid disease — treat before fitting' },
    { check: (f) => f.prefitting?.shared?.clIntolerance === 'Yes', msg: 'Previous contact lens intolerance documented' },
    { check: (f) => (f.lensSelection?.shared?.wearingSchedule === 'Extended wear') && (f.lensSelection?.shared?.lensType === 'Soft'), msg: 'Extended wear soft lens — increased hypoxia risk' }
  ];

  global.CorneaContactLensTaxonomy = {
    CL_TABS,
    INDICATIONS,
    LENS_TYPES,
    REPLACEMENT_SCHEDULES,
    WEARING_SCHEDULES,
    FOLLOW_UP_INTERVALS,
    FOLLOW_UP_COMPARE,
    COMPLICATIONS,
    DISPENSING_CHECKLIST,
    SOLUTIONS,
    INVENTORY_CATEGORIES,
    TRIAL_ASSESSMENT_FIELDS,
    PREFITTING_FIELDS,
    LENS_PARAM_FIELDS,
    FINAL_RX_FIELDS,
    SPECIALIST_TEMPLATES,
    SAFETY_RULES,
    INVENTORY_STORAGE_KEY: 'corneaClInventory',
    FAVOURITES_STORAGE_KEY: 'corneaClFavourites',
    RECENT_STORAGE_KEY: 'corneaClRecentRx'
  };
})(typeof window !== 'undefined' ? window : globalThis);
