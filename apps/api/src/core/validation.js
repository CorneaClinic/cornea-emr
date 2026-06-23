import { ValidationError } from './errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param {Record<string, unknown>} query
 * @param {{ defaultLimit?: number, maxLimit?: number }} [options]
 */
export function parsePagination(query, options = {}) {
  const defaultLimit = options.defaultLimit ?? 50;
  const maxLimit = options.maxLimit ?? 200;

  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(String(query.limit ?? String(defaultLimit)), 10) || defaultLimit)
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * @param {number} total
 * @param {number} page
 * @param {number} limit
 */
export function buildPaginationMeta(total, page, limit) {
  return {
    page,
    limit,
    total,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0
  };
}

/**
 * @param {unknown} value
 * @param {string} field
 */
export function requireUuid(value, field) {
  const str = requireString(value, field);
  if (!UUID_RE.test(str)) {
    throw new ValidationError(`Invalid ${field}: must be a UUID`);
  }
  return str;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {{ min?: number, max?: number }} [options]
 */
export function requireString(value, field, options = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    throw new ValidationError(`${field} is required`);
  }
  const str = String(value).trim();
  if (options.min != null && str.length < options.min) {
    throw new ValidationError(`${field} must be at least ${options.min} characters`);
  }
  if (options.max != null && str.length > options.max) {
    throw new ValidationError(`${field} must be at most ${options.max} characters`);
  }
  return str;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {{ min?: number, max?: number }} [options]
 */
export function optionalString(value, field, options = {}) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return null;
  }
  return requireString(value, field, options);
}

/**
 * @param {unknown} value
 * @param {string} field
 */
export function parseDate(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const str = String(value).trim();
  if (!DATE_RE.test(str)) {
    throw new ValidationError(`${field} must be YYYY-MM-DD`);
  }
  return str;
}

/**
 * @param {unknown} value
 * @param {string} field
 */
export function requireDate(value, field) {
  const date = parseDate(value, field);
  if (!date) {
    throw new ValidationError(`${field} is required`);
  }
  return date;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {readonly string[]} allowed
 */
export function parseEnum(value, field, allowed) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const str = String(value).trim();
  if (!allowed.includes(str)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return str;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {readonly string[]} allowed
 */
export function requireEnum(value, field, allowed) {
  const parsed = parseEnum(value, field, allowed);
  if (!parsed) {
    throw new ValidationError(`${field} is required`);
  }
  return parsed;
}

/**
 * @param {unknown} value
 * @param {string} field
 */
export function optionalInt(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) {
    throw new ValidationError(`${field} must be an integer`);
  }
  return n;
}

/**
 * @param {unknown} value
 * @param {string} field
 */
export function optionalNumber(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const n = Number(value);
  if (Number.isNaN(n)) {
    throw new ValidationError(`${field} must be a number`);
  }
  return n;
}

/**
 * @param {unknown} value
 * @param {string} field
 */
export function optionalBool(value, field) {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value === 'boolean') return value;
  const str = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(str)) return true;
  if (['false', '0', 'no'].includes(str)) return false;
  throw new ValidationError(`${field} must be a boolean`);
}

/**
 * @param {unknown} value
 * @param {string} field
 */
export function optionalObject(value, field) {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new ValidationError(`${field} must be an object`);
  }
  return value;
}

/**
 * @param {string | Date | null | undefined} value
 */
export function formatDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

/**
 * @param {string} sortParam
 * @param {Record<string, string>} allowedFields
 * @param {string} defaultSort
 */
export function parseSort(sortParam, allowedFields, defaultSort) {
  const raw = sortParam ? String(sortParam).trim() : defaultSort;
  const [field, direction = 'asc'] = raw.split(':');
  const column = allowedFields[field];
  if (!column) {
    throw new ValidationError(`Invalid sort field: ${field}`);
  }
  const dir = direction.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
  return `${column} ${dir}`;
}

/**
 * @param {string} q
 * @param {string[]} columns
 * @param {unknown[]} params
 */
export function appendSearch(q, columns, params) {
  if (!q?.trim()) {
    return { clause: '', params };
  }
  params.push(`%${q.trim()}%`);
  const idx = params.length;
  const clause = columns.map((col) => `${col} ILIKE $${idx}`).join(' OR ');
  return { clause: `(${clause})`, params };
}
