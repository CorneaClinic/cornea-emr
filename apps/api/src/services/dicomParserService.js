import dicomParser from 'dicom-parser';
import { ValidationError } from '../core/errors.js';

/** DICOM tag hex keys used for cornea / ophthalmic ingest. */
const TAGS = Object.freeze({
  patientName: 'x00100010',
  patientId: 'x00100020',
  patientBirthDate: 'x00100030',
  patientSex: 'x00100040',
  studyDate: 'x00080020',
  studyTime: 'x00080030',
  modality: 'x00080060',
  manufacturer: 'x00080070',
  manufacturerModel: 'x00081090',
  studyDescription: 'x00081030',
  seriesDescription: 'x0008103e',
  laterality: 'x00200060',
  sopInstanceUid: 'x00080018',
  studyInstanceUid: 'x0020000d',
  seriesInstanceUid: 'x0020000e',
  institutionName: 'x00080080',
  accessionNumber: 'x00080050'
});

/**
 * @param {Buffer} buffer
 */
export function isDicomPart10(buffer) {
  if (!buffer || buffer.length < 132) return false;
  return buffer.slice(128, 132).toString('ascii') === 'DICM';
}

/**
 * @param {string | undefined} raw
 */
export function formatDicomPatientName(raw) {
  if (!raw) return undefined;
  const parts = String(raw).split('^').filter(Boolean);
  if (parts.length >= 2) return `${parts[1]} ${parts[0]}`.trim();
  return parts[0]?.trim() || String(raw).trim();
}

/**
 * @param {string | undefined} yyyymmdd
 */
export function formatDicomDate(yyyymmdd) {
  const s = String(yyyymmdd || '').trim();
  if (s.length !== 8) return s || undefined;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

/**
 * @param {string | undefined} hhmmss
 */
export function formatDicomTime(hhmmss) {
  const s = String(hhmmss || '').trim();
  if (s.length < 4) return undefined;
  const hh = s.slice(0, 2);
  const mm = s.slice(2, 4);
  const ss = s.length >= 6 ? s.slice(4, 6) : '00';
  return `${hh}:${mm}:${ss}`;
}

/**
 * @param {string | undefined} modality
 * @param {string | undefined} studyDescription
 * @param {string | undefined} seriesDescription
 */
export function suggestMediaCategory(modality, studyDescription, seriesDescription) {
  const mod = String(modality || '').toUpperCase();
  const text = `${studyDescription || ''} ${seriesDescription || ''}`.toLowerCase();

  if (mod === 'OCT' || text.includes('oct') || text.includes('anterior segment')) return 'as_oct';
  if (text.includes('pentacam') || text.includes('topograph') || text.includes('corneal topography')) {
    return 'topography';
  }
  if (text.includes('sirius') || text.includes('orbscan') || text.includes('tomograph')) return 'tomography';
  if (text.includes('specular')) return 'specular';
  if (text.includes('confocal')) return 'confocal';
  if (mod === 'OP' || text.includes('slit')) return 'slit_lamp';
  if (mod === 'OT') return 'tomography';
  if (mod === 'DOC' || text.includes('report')) return 'pdf_report';
  if (text.includes('operative') || text.includes('surgery')) return 'operative_photo';
  return 'other';
}

/**
 * @param {import('dicom-parser').DataSet} dataSet
 * @param {string} tag
 */
function tagString(dataSet, tag) {
  if (!dataSet.elements[tag]) return undefined;
  try {
    return dataSet.string(tag)?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * @param {Buffer} buffer
 */
export function parseDicomBuffer(buffer) {
  if (!buffer?.length) throw new ValidationError('DICOM file is empty');
  if (!isDicomPart10(buffer)) {
    throw new ValidationError('Not a valid DICOM Part 10 file (missing DICM preamble)');
  }

  const byteArray = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let dataSet;
  try {
    dataSet = dicomParser.parseDicom(byteArray);
  } catch (err) {
    throw new ValidationError(`DICOM parse failed: ${err.message || 'invalid file'}`);
  }

  const modality = tagString(dataSet, TAGS.modality);
  const studyDescription = tagString(dataSet, TAGS.studyDescription);
  const seriesDescription = tagString(dataSet, TAGS.seriesDescription);
  const studyDate = tagString(dataSet, TAGS.studyDate);
  const studyTime = tagString(dataSet, TAGS.studyTime);

  const tags = {
    patientName: formatDicomPatientName(tagString(dataSet, TAGS.patientName)),
    patientId: tagString(dataSet, TAGS.patientId),
    patientBirthDate: formatDicomDate(tagString(dataSet, TAGS.patientBirthDate)),
    patientSex: tagString(dataSet, TAGS.patientSex),
    studyDate: formatDicomDate(studyDate),
    studyTime: formatDicomTime(studyTime),
    modality,
    manufacturer: tagString(dataSet, TAGS.manufacturer),
    manufacturerModel: tagString(dataSet, TAGS.manufacturerModel),
    studyDescription,
    seriesDescription,
    laterality: tagString(dataSet, TAGS.laterality),
    institutionName: tagString(dataSet, TAGS.institutionName),
    accessionNumber: tagString(dataSet, TAGS.accessionNumber),
    sopInstanceUid: tagString(dataSet, TAGS.sopInstanceUid),
    studyInstanceUid: tagString(dataSet, TAGS.studyInstanceUid),
    seriesInstanceUid: tagString(dataSet, TAGS.seriesInstanceUid)
  };

  const suggestedCategory = suggestMediaCategory(modality, studyDescription, seriesDescription);
  const capturedAt = tags.studyDate
    ? `${tags.studyDate}${tags.studyTime ? `T${tags.studyTime}` : ''}`
    : undefined;

  const summary = [
    tags.modality && `Modality: ${tags.modality}`,
    tags.studyDescription && `Study: ${tags.studyDescription}`,
    tags.seriesDescription && `Series: ${tags.seriesDescription}`,
    tags.manufacturer && `${tags.manufacturer}${tags.manufacturerModel ? ` ${tags.manufacturerModel}` : ''}`,
    tags.laterality && `Eye: ${tags.laterality}`
  ].filter(Boolean).join(' · ');

  return {
    tags,
    suggestedCategory,
    capturedAt,
    summary,
    byteSize: buffer.length
  };
}

export { TAGS };
