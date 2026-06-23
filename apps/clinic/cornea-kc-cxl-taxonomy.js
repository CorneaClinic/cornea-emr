/**
 * KC & CXL Longitudinal Registry — taxonomy, progression rules, field definitions
 */
(function (global) {
  'use strict';

  const KC_DIAGNOSES = ['Keratoconus', 'Pellucid marginal degeneration', 'Post-LASIK ectasia', 'Forme fruste keratoconus', 'Other'];
  const KC_STAGING = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'ABCD A', 'ABCD B', 'ABCD C', 'ABCD D', 'Not staged'];
  const EYE_OPTIONS = ['OD', 'OS', 'OU'];
  const KC_STATUS = ['Active', 'Watch', 'Post-CXL', 'Transplant listed', 'Discharged'];
  const PROGRESSION_FLAGS = ['None', 'Suspect', 'Confirmed', 'Stable'];
  const TOPO_DEVICES = ['Pentacam', 'Galilei', 'Orbscan', 'Sirius', 'Other'];
  const CONE_SEVERITY = ['None', 'Suspect', 'Forme fruste', 'Mild', 'Moderate', 'Advanced'];
  const ABCD_CLASS = ['Normal', 'A', 'B', 'C', 'D'];

  const CXL_PROTOCOLS = ['Dresden standard', 'Accelerated', 'Epithelial-on', 'Transepithelial', 'PACK-CXL', 'Custom'];
  const EPI_TYPES = ['Epi-off', 'Epi-on', 'Transepithelial'];
  const RIBOFLAVIN_TYPES = ['Riboflavin 0.1%', 'Hydroxypropyl methylcellulose', 'Dextran 20%', 'Other'];
  const CXL_OUTCOMES = ['Pending', 'Success', 'Partial', 'Failed', 'Halted progression'];

  const KMAX_PROGRESSION_THRESHOLD_D = 1.0;

  const PATIENT_FIELDS = [
    { key: 'kcRegistryId', label: 'Registry ID', readonly: true },
    { key: 'kcFullName', label: 'Full Name', required: true },
    { key: 'kcAge', label: 'Age', type: 'number' },
    { key: 'kcGender', label: 'Gender', select: ['Male', 'Female', 'Other'] },
    { key: 'kcPhone', label: 'Phone', type: 'tel' },
    { key: 'kcEmrPatientMrn', label: 'EMR Patient ID (MRN)', hint: 'Links to Patient Records' },
    { key: 'kcEyeInvolvement', label: 'Eye involvement', select: EYE_OPTIONS },
    { key: 'kcDiagnosis', label: 'Diagnosis', select: KC_DIAGNOSES },
    { key: 'kcStaging', label: 'Staging', select: KC_STAGING },
    { key: 'kcIndexDate', label: 'Index / diagnosis date', type: 'date' },
    { key: 'kcFamilyHistoryKc', label: 'Family history KC', select: ['Yes', 'No'] },
    { key: 'kcAtopy', label: 'Atopy', select: ['None', 'Mild', 'Moderate', 'Severe'] },
    { key: 'kcEyeRubbing', label: 'Eye rubbing', select: ['None', 'Occasional', 'Frequent'] },
    { key: 'kcStatus', label: 'Programme status', select: KC_STATUS },
    { key: 'kcProgressionStatus', label: 'Progression status', readonly: true },
    { key: 'kcNotes', label: 'Notes', full: true, type: 'textarea' }
  ];

  const TOPOGRAPHY_FIELDS = [
    { key: 'kcTopoEye', label: 'Eye', select: ['OD', 'OS'], required: true },
    { key: 'kcTopoCapturedAt', label: 'Capture date', type: 'date', required: true },
    { key: 'kcTopoDevice', label: 'Device', select: TOPO_DEVICES },
    { key: 'kcTopoKmax', label: 'Kmax (D)', type: 'number', step: '0.01' },
    { key: 'kcTopoKmean', label: 'Kmean (D)', type: 'number', step: '0.01' },
    { key: 'kcTopoK1', label: 'K1 (D)', type: 'number', step: '0.01' },
    { key: 'kcTopoK2', label: 'K2 (D)', type: 'number', step: '0.01' },
    { key: 'kcTopoThinnestPachy', label: 'Thinnest pachymetry (µm)', type: 'number' },
    { key: 'kcTopoCentralPachy', label: 'Central pachymetry (µm)', type: 'number' },
    { key: 'kcTopoBadD', label: 'BAD-D', type: 'number', step: '0.01' },
    { key: 'kcTopoAbcd', label: 'ABCD', select: ABCD_CLASS },
    { key: 'kcTopoConeSeverity', label: 'Cone severity', select: CONE_SEVERITY },
    { key: 'kcTopoConeLocation', label: 'Cone location' },
    { key: 'kcTopoProgressionFlag', label: 'Progression flag', select: PROGRESSION_FLAGS },
    { key: 'kcTopoNotes', label: 'Notes', full: true, type: 'textarea' }
  ];

  const CXL_FIELDS = [
    { key: 'kcCxlEye', label: 'Eye', select: ['OD', 'OS'], required: true },
    { key: 'kcCxlProcedureDate', label: 'Procedure date', type: 'date', required: true },
    { key: 'kcCxlProtocol', label: 'Protocol', select: CXL_PROTOCOLS },
    { key: 'kcCxlEpiType', label: 'Epithelium', select: EPI_TYPES },
    { key: 'kcCxlRiboflavinType', label: 'Riboflavin', select: RIBOFLAVIN_TYPES },
    { key: 'kcCxlRiboflavinDurationMin', label: 'Riboflavin soak (min)', type: 'number' },
    { key: 'kcCxlUvEnergy', label: 'UV energy (J/cm²)', type: 'number', step: '0.1' },
    { key: 'kcCxlUvDurationSec', label: 'UV duration (sec)', type: 'number' },
    { key: 'kcCxlUvPower', label: 'UV power (mW/cm²)', type: 'number', step: '0.1' },
    { key: 'kcCxlIontophoresis', label: 'Iontophoresis', select: ['Yes', 'No'] },
    { key: 'kcCxlSurgeon', label: 'Surgeon' },
    { key: 'kcCxlPreKmax', label: 'Pre-op Kmax (D)', type: 'number', step: '0.01' },
    { key: 'kcCxlPreKmean', label: 'Pre-op Kmean (D)', type: 'number', step: '0.01' },
    { key: 'kcCxlPreThinnestPachy', label: 'Pre-op thinnest pachy (µm)', type: 'number' },
    { key: 'kcCxlPostKmax3m', label: 'Post Kmax 3m (D)', type: 'number', step: '0.01' },
    { key: 'kcCxlPostKmax6m', label: 'Post Kmax 6m (D)', type: 'number', step: '0.01' },
    { key: 'kcCxlPostKmax12m', label: 'Post Kmax 12m (D)', type: 'number', step: '0.01' },
    { key: 'kcCxlPostKmean3m', label: 'Post Kmean 3m (D)', type: 'number', step: '0.01' },
    { key: 'kcCxlPostKmean6m', label: 'Post Kmean 6m (D)', type: 'number', step: '0.01' },
    { key: 'kcCxlPostKmean12m', label: 'Post Kmean 12m (D)', type: 'number', step: '0.01' },
    { key: 'kcCxlOutcome', label: 'Outcome', select: CXL_OUTCOMES },
    { key: 'kcCxlComplications', label: 'Complications', full: true, type: 'textarea' },
    { key: 'kcCxlNotes', label: 'Notes', full: true, type: 'textarea' }
  ];

  function computeProgressionSummary(readings) {
    const byEye = { OD: [], OS: [] };
    for (const r of readings || []) {
      const eye = r.kcTopoEye === 'OS' || r.eye === 'OS' ? 'OS' : 'OD';
      const kmax = r.kcTopoKmax != null ? Number(r.kcTopoKmax) : (r.kmax != null ? Number(r.kmax) : null);
      const date = r.kcTopoCapturedAt || r.capturedAt;
      if (kmax != null && date) byEye[eye].push({ date, kmax });
    }
    const summary = {};
    for (const eye of ['OD', 'OS']) {
      const series = byEye[eye].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      if (series.length < 2) {
        summary[eye] = { points: series.length, deltaKmax: null, flag: 'Insufficient data' };
        continue;
      }
      const first = series[0];
      const last = series[series.length - 1];
      const delta = Math.round((last.kmax - first.kmax) * 100) / 100;
      let flag = 'Stable';
      if (delta >= 1.5) flag = 'Progression likely';
      else if (delta >= KMAX_PROGRESSION_THRESHOLD_D) flag = 'Progression suspect';
      summary[eye] = { points: series.length, deltaKmax: delta, firstKmax: first.kmax, lastKmax: last.kmax, flag };
    }
    return summary;
  }

  function extractTopoFromLaserWorkup(laserJson) {
    if (!laserJson?.workup?.topography) return [];
    const topo = laserJson.workup.topography;
    const device = topo.device || 'Pentacam';
    const out = [];
    for (const eye of ['OD', 'OS']) {
      const prefix = eye === 'OD' ? 'od' : 'os';
      const kmax = topo[`${prefix}Kmax`] ?? topo.corneal?.[`${prefix}Kmax`];
      if (kmax == null && topo[`${prefix}BadD`] == null) continue;
      out.push({
        kcTopoEye: eye,
        kcTopoCapturedAt: new Date().toISOString().slice(0, 10),
        kcTopoDevice: device,
        kcTopoKmax: topo[`${prefix}Kmax`] ?? topo.corneal?.[`${prefix}Kmax`] ?? null,
        kcTopoKmean: topo[`${prefix}Kmean`] ?? null,
        kcTopoBadD: topo[`${prefix}BadD`] ?? null,
        kcTopoAbcd: topo[`${prefix}Abcd`] ?? null,
        kcTopoConeSeverity: topo[`${prefix}ConeSeverity`] ?? null,
        kcTopoConeLocation: topo[`${prefix}ConeLocation`] ?? null,
        kcTopoProgressionFlag: topo[`${prefix}Progression`] || 'None',
        kcTopoThinnestPachy: laserJson.workup?.corneal?.[`${prefix}ThinnestPachy`] ?? null,
        source: 'visit_import'
      });
    }
    return out;
  }

  global.CorneaKcCxlTaxonomy = {
    KC_DIAGNOSES,
    KC_STAGING,
    KC_STATUS,
    TOPO_DEVICES,
    CXL_PROTOCOLS,
    EPI_TYPES,
    CXL_OUTCOMES,
    PATIENT_FIELDS,
    TOPOGRAPHY_FIELDS,
    CXL_FIELDS,
    KMAX_PROGRESSION_THRESHOLD_D,
    computeProgressionSummary,
    extractTopoFromLaserWorkup
  };
})(typeof window !== 'undefined' ? window : globalThis);
