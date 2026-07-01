import { ValidationError } from '../core/errors.js';
import { parseEnum, optionalString, requireUuid } from '../core/validation.js';
import { uploadMediaForEntity } from './mediaAssetService.js';
import { parseDicomBuffer } from './dicomParserService.js';

const ENTITY_TYPES = ['patient', 'visit'];
const EYE_VALUES = ['OD', 'OS', 'OU', 'right', 'left', 'both'];

/**
 * @param {Buffer} buffer
 */
export function previewDicomUpload(buffer) {
  return parseDicomBuffer(buffer);
}

/**
 * @param {import('express').Request} req
 * @param {object} options
 * @param {string} options.entityType
 * @param {string} options.entityId
 * @param {Buffer} options.buffer
 * @param {string} options.originalFilename
 * @param {string} [options.category]
 * @param {string} [options.eye]
 * @param {string} [options.label]
 */
export async function ingestDicomToMedia(req, options) {
  const entityType = parseEnum(options.entityType, 'entityType', ENTITY_TYPES);
  if (!entityType) throw new ValidationError('entityType must be patient or visit');

  const entityId = requireUuid(options.entityId, 'entityId');
  const buffer = options.buffer;
  const originalFilename = optionalString(options.originalFilename, 'originalFilename') || 'study.dcm';

  const parsed = parseDicomBuffer(buffer);
  const category = optionalString(options.category, 'category') || parsed.suggestedCategory || 'other';

  let eye = options.eye ? parseEnum(options.eye, 'eye', EYE_VALUES) : null;
  if (!eye && parsed.tags.laterality) {
    const lat = String(parsed.tags.laterality).toUpperCase();
    if (lat === 'R' || lat === 'OD' || lat === 'RIGHT') eye = 'OD';
    else if (lat === 'L' || lat === 'OS' || lat === 'LEFT') eye = 'OS';
    else if (lat === 'B' || lat === 'OU' || lat === 'BOTH') eye = 'OU';
  }

  const label = optionalString(options.label, 'label')
    || parsed.tags.seriesDescription
    || parsed.tags.studyDescription
    || `DICOM ${parsed.tags.modality || 'study'}`;

  const asset = await uploadMediaForEntity(req, {
    entityType,
    entityId,
    category,
    buffer,
    originalFilename: originalFilename.toLowerCase().endsWith('.dcm')
      ? originalFilename
      : `${originalFilename.replace(/\.[^.]+$/, '')}.dcm`,
    mimeType: 'application/dicom',
    eye: eye || undefined,
    label,
    moduleName: 'dicom_ingest',
    captureLocation: parsed.tags.manufacturerModel || parsed.tags.manufacturer,
    capturedAt: parsed.capturedAt,
    metadata: {
      dicom: parsed.tags,
      dicomSummary: parsed.summary,
      ingestVersion: 1
    },
    allowDuplicate: options.allowDuplicate === true || options.allowDuplicate === 'true'
  });

  return { asset, parsed };
}
