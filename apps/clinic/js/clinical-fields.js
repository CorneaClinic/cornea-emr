/**
 * Cornea Clinic — anterior segment / fundus field definitions
 * Phase 5 extraction from Cornea.html
 */

const NORMAL_ANT_SEGMENT = {
    lid: "normal", conj: "normal", cornea: "Clear", ac: "Normal depth",
    iris: "normal colour and pattern", pupil: "Normal size, round and reactive to light",
    lens: "Clear", reflex: "Orthophoric", movement: "Full", globe: "normal", fundusUnd: "normal"
};

const NORMAL_FUNDUS = {
    media: "Clear", disc: "Normal", vessel: "normal", retina: "normal", foveal: "Present"
};

const ANT_SEGMENT_FIELDS = [
    'lidRE', 'lidLE', 'conjRE', 'conjLE', 'corneaRE', 'corneaLE',
    'acRE', 'acLE', 'irisRE', 'irisLE', 'pupilRE', 'pupilLE',
    'lensRE', 'lensLE', 'movementRE', 'movementLE', 'reflexRE', 'reflexLE',
    'globeRE', 'globeLE', 'fundusUndRE', 'fundusUndLE'
];

const FUNDUS_FIELDS = [
    'mediaRE', 'mediaLE', 'discRE', 'discLE', 'vesselRE', 'vesselLE',
    'retinaRE', 'retinaLE', 'fovealRE', 'fovealLE'
];
