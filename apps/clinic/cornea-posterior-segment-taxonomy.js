/**
 * Posterior segment / fundus examination taxonomy (Project 7).
 * Legacy keys: mediaRE, discRE, vesselRE, retinaRE, fovealRE (+ LE).
 */
(function (global) {
  'use strict';

  const EYES = Object.freeze(['RE', 'LE']);
  const EYE_LABELS = Object.freeze({ RE: 'OD', LE: 'OS' });

  const STRUCTURES = Object.freeze([
    {
      id: 'media', label: 'Media / Vitreous', order: 1,
      normalText: 'Clear',
      legacyNormal: ['clear'],
      findings: [
        { id: 'vitreous_haze', label: 'Vitreous haze', children: ['Mild', 'Moderate', 'Dense'] },
        { id: 'vitritis', label: 'Vitritis' },
        { id: 'pvd', label: 'Posterior vitreous detachment' },
        { id: 'asteroid', label: 'Asteroid hyalosis' },
        { id: 'vh', label: 'Vitreous haemorrhage', children: ['Mild', 'Moderate', 'Dense'] },
        { id: 'silicone_oil', label: 'Silicone oil' },
        { id: 'gas', label: 'Intravitreal gas' },
        { id: 'media_opacity', label: 'Media opacity', children: ['Cataractous', 'Corneal', 'Other'] },
        { id: 'media_other', label: 'Other media finding', freeText: true }
      ]
    },
    {
      id: 'disc', label: 'Optic Disc', order: 2,
      normalText: 'Normal',
      legacyNormal: ['normal'],
      findings: [
        { id: 'cupped', label: 'Cupped disc', children: ['0.3', '0.5', '0.7', '0.9'] },
        { id: 'pallor', label: 'Pallor', children: ['Temporal', 'Diffuse'] },
        { id: 'disc_edema', label: 'Disc oedema / swelling' },
        { id: 'drusen_disc', label: 'Optic disc drusen' },
        { id: 'papillitis', label: 'Papillitis' },
        { id: 'nvd', label: 'Neovascularization of disc' },
        { id: 'coloboma_disc', label: 'Disc coloboma' },
        { id: 'disc_other', label: 'Other disc finding', freeText: true }
      ]
    },
    {
      id: 'vessel', label: 'Vessels', order: 3,
      normalText: 'Normal',
      legacyNormal: ['normal'],
      findings: [
        { id: 'attenuated', label: 'Attenuated vessels' },
        { id: 'tortuous', label: 'Tortuous vessels' },
        { id: 'av_nicking', label: 'AV nicking' },
        { id: 'nve', label: 'Neovascularization elsewhere' },
        { id: 'sheathing', label: 'Perivascular sheathing' },
        { id: 'emboli', label: 'Retinal emboli' },
        { id: 'htn_changes', label: 'Hypertensive retinopathy changes' },
        { id: 'vessel_other', label: 'Other vascular finding', freeText: true }
      ]
    },
    {
      id: 'retina', label: 'Background / Peripheral Retina', order: 4,
      normalText: 'Normal',
      legacyNormal: ['normal'],
      findings: [
        { id: 'dot_blot_h', label: 'Dot/blot haemorrhages' },
        { id: 'flame_h', label: 'Flame haemorrhages' },
        { id: 'hard_exu', label: 'Hard exudates' },
        { id: 'soft_exu', label: 'Soft exudates / cotton wool spots' },
        { id: 'lattice', label: 'Lattice degeneration' },
        { id: 'tear', label: 'Retinal tear' },
        { id: 'rd', label: 'Retinal detachment', children: ['Rhegmatogenous', 'Tractional', 'Exudative'] },
        { id: 'retinal_scar', label: 'Retinal scar' },
        { id: 'cmv', label: 'CMV retinitis pattern' },
        { id: 'retina_other', label: 'Other retinal finding', freeText: true }
      ]
    },
    {
      id: 'foveal', label: 'Macula / Fovea', order: 5,
      normalText: 'Present',
      legacyNormal: ['present'],
      findings: [
        { id: 'mac_drusen', label: 'Macular drusen' },
        { id: 'mac_edema', label: 'Macular oedema' },
        { id: 'erm', label: 'Epiretinal membrane' },
        { id: 'mac_hole', label: 'Macular hole' },
        { id: 'csr', label: 'Central serous retinopathy' },
        { id: 'mac_atrophy', label: 'Macular atrophy' },
        { id: 'mac_scar', label: 'Macular scar' },
        { id: 'foveal_absent', label: 'Foveal reflex absent' },
        { id: 'foveal_other', label: 'Other macular finding', freeText: true }
      ]
    }
  ]);

  const CLINICAL_TEMPLATES = Object.freeze({
    diabetic: {
      label: 'Diabetic retinopathy screen',
      findings: [
        { structure: 'vessel', id: 'htn_changes' },
        { structure: 'retina', id: 'dot_blot_h' },
        { structure: 'retina', id: 'hard_exu' },
        { structure: 'foveal', id: 'mac_edema' }
      ]
    },
    cmv: {
      label: 'CMV retinitis suspicion',
      findings: [
        { structure: 'media', id: 'vitreous_haze' },
        { structure: 'retina', id: 'cmv' },
        { structure: 'vessel', id: 'sheathing' }
      ]
    },
    postop: {
      label: 'Post-operative fundus',
      findings: [
        { structure: 'media', id: 'gas' },
        { structure: 'retina', id: 'retinal_scar' }
      ]
    }
  });

  const CONFLICT_GROUPS = Object.freeze({
    foveal: Object.freeze([
      Object.freeze(['foveal_absent', 'mac_drusen', 'mac_edema', 'erm', 'mac_hole', 'csr', 'mac_atrophy', 'mac_scar', 'foveal_other'])
    ])
  });

  const STORAGE_KEYS = Object.freeze({
    favorites: 'cornea_psb_favorites_v1',
    recent: 'cornea_psb_recent_v1',
    collapsed: 'cornea_psb_collapsed_v1'
  });

  function fieldId(structureId, eye) {
    return structureId + eye;
  }

  function structureById(id) {
    return STRUCTURES.find((s) => s.id === id);
  }

  function findingById(structureId, findingId) {
    return structureById(structureId)?.findings?.find((f) => f.id === findingId);
  }

  global.CorneaPosteriorSegmentTaxonomy = {
    EYES,
    EYE_LABELS,
    STRUCTURES,
    CLINICAL_TEMPLATES,
    CONFLICT_GROUPS,
    STORAGE_KEYS,
    fieldId,
    structureById,
    findingById
  };
})(typeof window !== 'undefined' ? window : globalThis);
