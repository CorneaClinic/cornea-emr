/**
 * Slit-lamp anterior segment — clinical taxonomy, templates, conflict rules.
 * Legacy field keys match clinical-fields.js (lidRE, corneaLE, …).
 */
(function (global) {
  'use strict';

  const EYES = Object.freeze(['RE', 'LE']);
  const EYE_LABELS = Object.freeze({ RE: 'OD', LE: 'OS' });

  /** @type {readonly import('./types').StructureDef[]} */
  const STRUCTURES = Object.freeze([
    {
      id: 'lid', label: 'Lids', order: 1,
      normalText: 'Normal',
      legacyNormal: ['normal'],
      findings: [
        { id: 'bleph_seb', label: 'Anterior blepharitis — seborrhoeic', group: 'bleph' },
        { id: 'bleph_ulc', label: 'Anterior blepharitis — ulcerative', group: 'bleph' },
        { id: 'mgd', label: 'MGD', children: ['Meibomian capping', 'Hyperaemic lid margin', 'Froth on lid margin'] },
        { id: 'chalazion', label: 'Chalazion', children: ['Upper lid', 'Lower lid'] },
        { id: 'hordeolum_ext', label: 'Hordeolum externum (stye)' },
        { id: 'ptosis', label: 'Ptosis', children: ['Mild', 'Moderate', 'Severe', 'Complete', 'MRD1', 'MRD2', 'MRD3'] },
        { id: 'ectropion', label: 'Ectropion', children: ['Involutional', 'Cicatricial', 'Paralytic', 'Mechanical'] },
        { id: 'entropion', label: 'Entropion', children: ['Involutional', 'Spastic', 'Cicatricial', 'Congenital'] },
        { id: 'lagophthalmos', label: 'Lagophthalmos' },
        { id: 'lid_laceration', label: 'Lid laceration' },
        { id: 'lid_edema', label: 'Lid oedema' },
        { id: 'trichiasis', label: 'Trichiasis' },
        { id: 'madarosis', label: 'Madarosis' },
        { id: 'xanthelasma', label: 'Xanthelasma' },
        { id: 'lid_tumor', label: 'Lid tumour', children: ['Papilloma', 'BCC', 'SCC', 'Sebaceous gland carcinoma'] },
        { id: 'lid_other', label: 'Other lid finding', freeText: true, drawLink: true }
      ]
    },
    {
      id: 'conj', label: 'Conjunctiva', order: 2,
      normalText: 'Normal',
      legacyNormal: ['normal'],
      findings: [
        { id: 'congestion_mild', label: 'Mild diffuse congestion' },
        { id: 'congestion_mod', label: 'Moderate congestion' },
        { id: 'congestion_severe', label: 'Severe congestion' },
        { id: 'hemorrhage', label: 'Subconjunctival haemorrhage' },
        { id: 'pterygium', label: 'Pterygium', children: ['Nasal', 'Temporal', 'Inflamed', 'Recurrent', 'Double', 'Covering cornea'], drawLink: true },
        { id: 'pinguecula', label: 'Pinguecula', children: ['Nasal', 'Temporal'] },
        { id: 'follicles', label: 'Follicles' },
        { id: 'papillae', label: 'Papillae' },
        { id: 'chemosis', label: 'Chemosis', children: ['Mild', 'Moderate', 'Severe'] },
        { id: 'discharge', label: 'Discharge', children: ['Watery', 'Mucoid', 'Mucopurulent', 'Purulent'] },
        { id: 'conj_scar', label: 'Conjunctival scar' },
        { id: 'conj_other', label: 'Other conjunctival finding', freeText: true }
      ]
    },
    {
      id: 'cornea', label: 'Cornea', order: 3,
      normalText: 'Clear',
      legacyNormal: ['clear'],
      findings: [
        { id: 'ulcer', label: 'Ulcer', group: 'opacity', drawLink: true,
          details: ['Size', 'Location', 'Depth', 'Infiltrate', 'Thinning', 'Perforation', 'Vascularization', 'Healing'],
          children: ['Central', 'Paracentral', 'Peripheral', 'Superior', 'Inferior', 'Nasal', 'Temporal'] },
        { id: 'infiltrate', label: 'Infiltrate', group: 'opacity', drawLink: true,
          details: ['Size', 'Location', 'Depth'] },
        { id: 'opacity', label: 'Opacity', group: 'opacity', drawLink: true,
          children: ['Central', 'Paracentral', 'Peripheral', 'Dense', 'Leucoma'] },
        { id: 'edema', label: 'Edema', group: 'opacity', children: ['Mild', 'Moderate', 'Severe', 'Bullous'] },
        { id: 'keratoconus', label: 'Keratoconus', group: 'ectasia',
          children: ['Vogt striae', 'Fleischer ring', 'Apical scar', 'Punctate epithelial erosions', 'Hydrops'] },
        { id: 'bullous_k', label: 'Bullous keratopathy', group: 'opacity' },
        { id: 'foreign_body', label: 'Foreign body', group: 'trauma', drawLink: true,
          details: ['Location', 'Depth', 'Rust ring'] },
        { id: 'graft', label: 'Graft', group: 'surgery', drawLink: true,
          children: ['Clear', 'Edema', 'Rejection', 'Failure', 'Sutures intact', 'Loose sutures', 'Neovascularization'] },
        { id: 'dystrophy', label: 'Dystrophy', children: ['Fuchs endothelial', 'Map-dot-fingerprint', 'Lattice', 'Granular', 'Macular'] },
        { id: 'degeneration', label: 'Degeneration', children: ['Band keratopathy', 'Salzmann nodular', 'Arcus senilis', 'Terrien marginal'] },
        { id: 'neovascularization', label: 'Neovascularization', drawLink: true, children: ['Superficial', 'Deep', 'Peripheral', 'Central'] },
        { id: 'scar', label: 'Scar', drawLink: true, children: ['Superficial', 'Stromal', 'Central', 'Peripheral'] },
        { id: 'epithelial_defect', label: 'Epithelial defect', drawLink: true, details: ['Size', 'Location'] },
        { id: 'cornea_trauma', label: 'Trauma', group: 'trauma', drawLink: true },
        { id: 'cornea_other', label: 'Other corneal finding', freeText: true, drawLink: true }
      ]
    },
    {
      id: 'ac', label: 'Anterior Chamber', order: 4,
      normalText: 'Quiet, normal depth',
      legacyNormal: ['normal depth', 'quiet', 'normal'],
      findings: [
        { id: 'ac_deep', label: 'Deep AC' },
        { id: 'ac_shallow', label: 'Shallow AC' },
        { id: 'ac_flat', label: 'Flat AC' },
        { id: 'cells', label: 'Cells', children: ['Trace', '1+', '2+', '3+', '4+'] },
        { id: 'flare', label: 'Flare', children: ['Trace', '1+', '2+', '3+', '4+'] },
        { id: 'hypopyon', label: 'Hypopyon', children: ['1 mm', '2 mm', '3 mm', '4 mm', '5 mm'] },
        { id: 'hyphema', label: 'Hyphema', children: ['Layered', '<1 mm', '1–2 mm', '3–4 mm', 'Total'] },
        { id: 'fibrin', label: 'Fibrin' },
        { id: 'pigment', label: 'Pigment in AC' },
        { id: 'lens_matter', label: 'Lens matter in AC' },
        { id: 'ac_other', label: 'Other AC finding', freeText: true }
      ]
    },
    {
      id: 'iris', label: 'Iris', order: 5,
      normalText: 'Normal colour and pattern',
      legacyNormal: ['normal colour and pattern', 'normal'],
      findings: [
        { id: 'iris_atrophy', label: 'Iris atrophy' },
        { id: 'neovascularization_iris', label: 'Neovascularization of iris' },
        { id: 'posterior_synechiae', label: 'Posterior synechiae', children: ['Clock hours — specify', '360°'] },
        { id: 'anterior_synechiae', label: 'Peripheral anterior synechiae', children: ['Clock hours — specify', '360°'] },
        { id: 'iris_prolapse', label: 'Iris prolapse' },
        { id: 'iridodialysis', label: 'Iridodialysis' },
        { id: 'iris_coloboma', label: 'Coloboma' },
        { id: 'heterochromia', label: 'Heterochromia' },
        { id: 'iris_other', label: 'Other iris finding', freeText: true }
      ]
    },
    {
      id: 'pupil', label: 'Pupil', order: 6,
      normalText: 'Normal size, round and reactive to light',
      legacyNormal: ['normal size, round and reactive to light', 'normal'],
      findings: [
        { id: 'rrr', label: 'Round, regular, reactive' },
        { id: 'irregular', label: 'Irregular pupil' },
        { id: 'fixed', label: 'Fixed pupil' },
        { id: 'sluggish', label: 'Sluggish reaction' },
        { id: 'rapd', label: 'Relative afferent pupillary defect' },
        { id: 'dilated', label: 'Dilated pupil' },
        { id: 'miotic', label: 'Miotic pupil' },
        { id: 'pupil_other', label: 'Other pupil finding', freeText: true }
      ]
    },
    {
      id: 'lens', label: 'Lens', order: 7,
      normalText: 'Clear',
      legacyNormal: ['clear'],
      findings: [
        { id: 'cataract', label: 'Cataract', group: 'lens_status',
          children: ['NS1', 'NS2', 'NS3', 'NS4', 'NS5', 'Cortical', 'Posterior subcapsular', 'Mature', 'Hypermature', 'Traumatic'] },
        { id: 'aphakia', label: 'Aphakia', group: 'lens_status' },
        { id: 'pseudophakia', label: 'Pseudophakia', group: 'lens_status', children: ['PCIOL — centred', 'PCIOL — subluxed', 'ACIOL', 'Sulcus fixated'] },
        { id: 'lens_subuxed', label: 'Subluxed lens' },
        { id: 'lens_dislocated', label: 'Dislocated lens' },
        { id: 'after_cataract', label: 'Posterior capsular opacification' },
        { id: 'lens_other', label: 'Other lens finding', freeText: true }
      ]
    },
    {
      id: 'movement', label: 'Ocular Movements', order: 8,
      normalText: 'Full',
      legacyNormal: ['full'],
      findings: [
        { id: 'restricted', label: 'Restricted movements', children: ['Elevation', 'Depression', 'Adduction', 'Abduction'] },
        { id: 'nystagmus', label: 'Nystagmus' },
        { id: 'strabismus', label: 'Strabismus', children: ['Esotropia', 'Exotropia', 'Hypertropia', 'Hypotropia'] },
        { id: 'movement_other', label: 'Other movement finding', freeText: true }
      ]
    },
    {
      id: 'reflex', label: 'Corneal Reflex', order: 9,
      normalText: 'Orthophoric',
      legacyNormal: ['orthophoric'],
      findings: [
        { id: 'esophoria', label: 'Esophoria' },
        { id: 'exophoria', label: 'Exophoria' },
        { id: 'esotropia', label: 'Esotropia' },
        { id: 'exotropia', label: 'Exotropia' },
        { id: 'reflex_other', label: 'Other reflex finding', freeText: true }
      ]
    },
    {
      id: 'globe', label: 'Globe', order: 10,
      normalText: 'Normal',
      legacyNormal: ['normal'],
      findings: [
        { id: 'proptosis', label: 'Proptosis' },
        { id: 'enophthalmos', label: 'Enophthalmos' },
        { id: 'soft_globe', label: 'Soft globe' },
        { id: 'firm_globe', label: 'Firm globe' },
        { id: 'hypotony', label: 'Hypotony' },
        { id: 'scleral_laceration', label: 'Scleral laceration', drawLink: true },
        { id: 'globe_rupture', label: 'Globe rupture', drawLink: true },
        { id: 'globe_other', label: 'Other globe finding', freeText: true }
      ]
    },
    {
      id: 'fundusUnd', label: 'Undilated Fundus', order: 11,
      normalText: 'Normal',
      legacyNormal: ['normal'],
      findings: [
        { id: 'media_haze', label: 'Media haze — limited view' },
        { id: 'disc_pale', label: 'Disc pallor' },
        { id: 'disc_cupping', label: 'Disc cupping' },
        { id: 'macular_reflex', label: 'Macular reflex abnormal' },
        { id: 'fundus_und_other', label: 'Other undilated fundus finding', freeText: true }
      ]
    }
  ]);

  const SPECIALIST_TEMPLATES = Object.freeze({
    corneal_ulcer: {
      label: 'Corneal ulcer', structure: 'cornea',
      findings: [{ id: 'ulcer', sub: ['Central'], details: { Size: '3×3 mm', Infiltrate: 'Present', Depth: 'Stromal' } }]
    },
    microbial_keratitis: {
      label: 'Microbial keratitis', structure: 'cornea',
      findings: [{ id: 'ulcer', sub: ['Central'], details: { Size: '4 mm', Infiltrate: 'Dense', Depth: 'Stromal' } },
        { id: 'infiltrate', sub: ['Central'] }]
    },
    hsv_keratitis: {
      label: 'Herpes simplex', structure: 'cornea',
      findings: [{ id: 'epithelial_defect', details: { Location: 'Dendritic pattern' } }]
    },
    hzv_keratitis: {
      label: 'Herpes zoster', structure: 'cornea',
      findings: [{ id: 'opacity', sub: ['Stromal'] }, { id: 'neovascularization', sub: ['Superficial'] }]
    },
    keratoconus: {
      label: 'Keratoconus', structure: 'cornea',
      findings: [{ id: 'keratoconus', sub: ['Vogt striae', 'Fleischer ring'] }]
    },
    fuchs: {
      label: 'Fuchs dystrophy', structure: 'cornea',
      findings: [{ id: 'dystrophy', sub: ['Fuchs endothelial'] }, { id: 'edema', sub: ['Mild'] }]
    },
    graft_rejection: {
      label: 'Graft rejection', structure: 'cornea',
      findings: [{ id: 'graft', sub: ['Rejection', 'Edema'] }, { id: 'cells', structure: 'ac', sub: ['2+'] }]
    },
    graft_failure: {
      label: 'Graft failure', structure: 'cornea',
      findings: [{ id: 'graft', sub: ['Failure', 'Edema'] }]
    },
    bullous_k: {
      label: 'Bullous keratopathy', structure: 'cornea',
      findings: [{ id: 'bullous_k' }, { id: 'edema', sub: ['Bullous'] }]
    },
    band_k: {
      label: 'Band keratopathy', structure: 'cornea',
      findings: [{ id: 'degeneration', sub: ['Band keratopathy'] }]
    },
    dry_eye: {
      label: 'Dry eye', structure: 'cornea',
      findings: [{ id: 'mgd', structure: 'lid' }, { id: 'epithelial_defect', sub: ['Punctate epithelial erosions'] }]
    },
    neurotrophic: {
      label: 'Neurotrophic keratopathy', structure: 'cornea',
      findings: [{ id: 'ulcer', sub: ['Central'], details: { Healing: 'Poor' } }]
    },
    chemical: {
      label: 'Chemical injury', structure: 'cornea',
      findings: [{ id: 'cornea_trauma' }, { id: 'chemosis', structure: 'conj', sub: ['Severe'] }]
    },
    corneal_melt: {
      label: 'Corneal melt', structure: 'cornea',
      findings: [{ id: 'ulcer', details: { Thinning: 'Severe', Perforation: 'Impending' } }]
    },
    puk: {
      label: 'Peripheral ulcerative keratitis', structure: 'cornea',
      findings: [{ id: 'ulcer', sub: ['Peripheral'] }]
    }
  });

  const TRAUMA_TEMPLATES = Object.freeze({
    fb: { label: 'Corneal foreign body', structure: 'cornea', findings: [{ id: 'foreign_body', drawLink: true }] },
    corneal_lac: { label: 'Corneal laceration', structure: 'cornea', findings: [{ id: 'cornea_trauma', drawLink: true }] },
    scleral_lac: { label: 'Scleral laceration', structure: 'globe', findings: [{ id: 'scleral_laceration', drawLink: true }] },
    chemical: { label: 'Chemical injury', apply: 'chemical' },
    thermal: { label: 'Thermal injury', structure: 'cornea', findings: [{ id: 'cornea_trauma' }, { id: 'chemosis', structure: 'conj', sub: ['Moderate'] }] },
    traumatic_cat: { label: 'Traumatic cataract', structure: 'lens', findings: [{ id: 'cataract', sub: ['Traumatic'] }] },
    hyphema: { label: 'Hyphema', structure: 'ac', findings: [{ id: 'hyphema', sub: ['Layered'] }] },
    iris_prolapse: { label: 'Iris prolapse', structure: 'iris', findings: [{ id: 'iris_prolapse' }] }
  });

  const POSTOP_TEMPLATES = Object.freeze({
    pkp: { label: 'PKP', structure: 'cornea', findings: [{ id: 'graft', sub: ['Sutures intact'] }] },
    dalk: { label: 'DALK', structure: 'cornea', findings: [{ id: 'graft', sub: ['Clear'] }] },
    dmek: { label: 'DMEK', structure: 'cornea', findings: [{ id: 'graft', sub: ['Clear', 'Edema'] }] },
    dsaek: { label: 'DSAEK', structure: 'cornea', findings: [{ id: 'graft', sub: ['Clear'] }] },
    pterygium: { label: 'Pterygium surgery', structure: 'conj', findings: [{ id: 'conj_scar' }] },
    trab: { label: 'Trabeculectomy', structure: 'conj', findings: [{ id: 'conj_scar' }] },
    phaco: { label: 'Cataract surgery', structure: 'lens', findings: [{ id: 'pseudophakia', sub: ['PCIOL — centred'] }] },
    glue: { label: 'Corneal glue', structure: 'cornea', findings: [{ id: 'ulcer', details: { Healing: 'With tissue adhesive' } }] },
    amniotic: { label: 'Amniotic membrane graft', structure: 'cornea', findings: [{ id: 'epithelial_defect', details: { Healing: 'AMG in situ' } }] }
  });

  /** Mutual exclusion groups per structure */
  const CONFLICT_GROUPS = Object.freeze({
    cornea: Object.freeze([
      Object.freeze(['clear', 'ulcer', 'infiltrate', 'opacity', 'edema', 'keratoconus', 'bullous_k', 'foreign_body', 'graft', 'dystrophy', 'degeneration', 'neovascularization', 'scar', 'epithelial_defect', 'cornea_trauma', 'cornea_other'])
    ]),
    lens: Object.freeze([
      Object.freeze(['clear', 'cataract', 'aphakia', 'pseudophakia', 'lens_subuxed', 'lens_dislocated', 'after_cataract', 'lens_other'])
    ])
  });

  const STORAGE_KEYS = Object.freeze({
    favorites: 'cornea_asb_favorites_v1',
    recent: 'cornea_asb_recent_v1',
    collapsed: 'cornea_asb_collapsed_v1'
  });

  function fieldId(structureId, eye) {
    return structureId + eye;
  }

  function structureById(id) {
    return STRUCTURES.find((s) => s.id === id);
  }

  function findingById(structureId, findingId) {
    const s = structureById(structureId);
    return s?.findings?.find((f) => f.id === findingId);
  }

  global.CorneaAnteriorSegmentTaxonomy = {
    EYES,
    EYE_LABELS,
    STRUCTURES,
    SPECIALIST_TEMPLATES,
    TRAUMA_TEMPLATES,
    POSTOP_TEMPLATES,
    CONFLICT_GROUPS,
    STORAGE_KEYS,
    fieldId,
    structureById,
    findingById
  };
})(typeof window !== 'undefined' ? window : globalThis);
