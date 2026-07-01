/**
 * Topography CSV import — Pentacam, Sirius / CSO Phoenix, and common export variants.
 * Project 4 + P3: maps to KC registry topography + laser refractive work-up fields.
 */
(function (global) {
  'use strict';

  const FIELD_ALIASES = {
    eye: ['eye', 'side', 'laterality', 'oculus', 'r_l', 'rl', 'side_'],
    patientName: ['patient', 'patient_name', 'pat_name', 'name', 'lastname', 'last_name', 'vorname', 'nachname'],
    patientId: ['patient_id', 'pat_id', 'patid', 'mrn', 'id'],
    capturedAt: ['date', 'exam_date', 'examination_date', 'scan_date', 'datetime', 'examtime', 'time', 'datum', 'untersuchungsdatum', 'acquisition_date', 'measurement_date'],
    kmax: ['kmax', 'k_max', 'k_max_front_d', 'max_k', 'maximum_k', 'kmax_front', 'kmax_ant', 'simk_max', 'k_maximum', 'kmax_ant_d', 'max_keratometry'],
    kmean: ['kmean', 'km', 'k_mean', 'simk2', 'average_k', 'mean_k', 'simk_mean', 'kmean_front', 'mean_k_ant', 'avg_k'],
    k1: ['k1', 'simk_flat', 'flattest_k', 'k1_front', 'rf', 'simk1', 'k_flat', 'k1_ant', 'simk1_ant'],
    k2: ['k2', 'simk_steep', 'steepest_k', 'k2_front', 'rs', 'simk2_steep', 'k_steep', 'k2_ant', 'simk2_ant'],
    thinnestPachy: ['pachy_min', 'pachymin', 'thinnest_pachymetry', 'min_pachy', 'pachymetry_min', 'thinnest', 'min_thickness', 'dt', 'thin_pach', 'minimum_pachymetry', 'pachy_thinnest', 'thinnest_loc'],
    centralPachy: ['pachy_apex', 'central_pachymetry', 'pachy_central', 'apex_pachy', 'pachymetry', 'pachy_mid', 'cct', 'central_thickness', 'corneal_thickness', 'pachy_center'],
    badD: ['bad_d', 'badd', 'final_d', 'dfinal', 'd_final', 'bad', 'belin_d', 'deviation_index', 'belin_ambr', 'ba_ratio', 'df', 'd_index'],
    abcd: ['abcd', 'abcd_classification', 'abcd_grade', 'abcd_class'],
    anteriorElevation: ['ele_f_tp', 'anterior_elevation', 'front_elevation', 'elevation_front', 'ant_elevation', 'elevation_ant', 'max_ant_elevation'],
    posteriorElevation: ['ele_b_tp', 'posterior_elevation', 'back_elevation', 'elevation_back', 'post_elevation', 'elevation_post', 'max_post_elevation'],
    coneLocation: ['cone_location', 'kmax_location', 'apex_location', 'thinnest_location'],
    artMax: ['art_max', 'artmax'],
    isv: ['isv', 'index_surface_variance'],
    iva: ['iva', 'index_vertical_asymmetry'],
    cki: ['cki', 'center_keratoconus_index', 'keratoconus_index', 'ki'],
    iha: ['iha', 'index_height_asymmetry'],
    ihd: ['ihd', 'index_height_decentration']
  };

  const SIRIUS_EXTRA_ALIASES = {
    device: ['device', 'topographer', 'instrument'],
    capturedAt: ['data', 'data_esame', 'exam_datetime'],
    kmax: ['kmax_scheimpflug', 'kmax_topo'],
    thinnestPachy: ['spessore_minimo', 'min_pachymetry_um']
  };

  const EYE_SUFFIX = /^(.*)_(od|os|right|left|r|l)$/i;
  const EYE_PREFIX = /^(od|os|right|left|r|l)_(.+)$/i;
  const SIRIUS_HEADER_MARKERS = /sirius|cso|phoenix|scheimpflug|osiris|isv|iva|cki|iha|ihd|tomograph|antares/i;

  let _activeAliases = FIELD_ALIASES;
  let _parseCtx = { device: 'Pentacam', source: 'pentacam_csv' };

  function mergeAliases(base, extra) {
    const merged = { ...base };
    for (const [field, aliases] of Object.entries(extra)) {
      merged[field] = [...new Set([...(merged[field] || []), ...aliases])];
    }
    return merged;
  }

  function setParseContext(device) {
    const isSirius = device === 'Sirius';
    _activeAliases = isSirius ? mergeAliases(FIELD_ALIASES, SIRIUS_EXTRA_ALIASES) : FIELD_ALIASES;
    _parseCtx = {
      device: isSirius ? 'Sirius' : 'Pentacam',
      source: isSirius ? 'sirius_csv' : 'pentacam_csv'
    };
  }

  function normalizeHeader(h) {
    return String(h || '')
      .trim()
      .toLowerCase()
      .replace(/[°µμ]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function detectDelimiter(line) {
    const semicolons = (line.match(/;/g) || []).length;
    const commas = (line.match(/,/g) || []).length;
    const tabs = (line.match(/\t/g) || []).length;
    if (tabs > semicolons && tabs > commas) return '\t';
    return semicolons > commas ? ';' : ',';
  }

  function parseCsvLine(line, delimiter) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur.trim());
    return out;
  }

  function splitLines(text) {
    return String(text || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  function looksLikeHeader(cells) {
    const joined = cells.map(normalizeHeader).join(' ');
    return /kmax|k_max|pachy|bad|eye|simk|patient|date|exam|isv|iva|cki|cct|scheimpflug|sirius/.test(joined);
  }

  function looksLikeSiriusHeaders(normHeaders) {
    return SIRIUS_HEADER_MARKERS.test(normHeaders.join(' '));
  }

  function findHeaderIndex(rows) {
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
      if (looksLikeHeader(rows[i])) return i;
    }
    return 0;
  }

  function aliasField(normHeader) {
    for (const [field, aliases] of Object.entries(_activeAliases)) {
      if (aliases.includes(normHeader)) return field;
    }
    return null;
  }

  function parseEye(raw) {
    const v = String(raw || '').trim().toUpperCase();
    if (!v) return null;
    if (v === 'OD' || v === 'R' || v === 'RIGHT' || v === 'RE' || v === 'O.D.' || v === '0') return 'OD';
    if (v === 'OS' || v === 'L' || v === 'LEFT' || v === 'LE' || v === 'O.S.' || v === '1') return 'OS';
    return null;
  }

  function parseNum(raw) {
    if (raw == null || raw === '') return null;
    const s = String(raw).trim().replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function parseDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const dmY = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (dmY) {
      const [, d, m, y] = dmY;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return null;
  }

  function rowToObject(headers, row) {
    const obj = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i] != null ? String(row[i]).trim() : '';
    });
    return obj;
  }

  function siriusIndexNotes(mapped) {
    const parts = [];
    if (mapped.isv != null) parts.push(`ISV ${mapped.isv}`);
    if (mapped.iva != null) parts.push(`IVA ${mapped.iva}`);
    if (mapped.cki != null) parts.push(`CKI ${mapped.cki}`);
    if (mapped.iha != null) parts.push(`IHA ${mapped.iha}`);
    if (mapped.ihd != null) parts.push(`IHD ${mapped.ihd}`);
    return parts.length ? parts.join(' · ') : null;
  }

  function mapObjectToReading(obj, forcedEye) {
    const mapped = {};
    let eye = forcedEye || null;
    let patientName = null;
    let patientId = null;
    let capturedAt = null;

    for (const [key, val] of Object.entries(obj)) {
      if (!val) continue;
      const field = aliasField(key);
      if (field === 'eye') eye = parseEye(val) || eye;
      else if (field === 'patientName') patientName = val;
      else if (field === 'patientId') patientId = val;
      else if (field === 'capturedAt' && !capturedAt) capturedAt = parseDate(val);
      else if (field) mapped[field] = field === 'abcd' ? val : parseNum(val) ?? val;
    }

    if (!eye) return null;
    if (mapped.kmax == null && mapped.thinnestPachy == null && mapped.badD == null && mapped.kmean == null && mapped.cki == null) {
      return null;
    }

    const badD = mapped.badD ?? (mapped.cki != null && _parseCtx.device === 'Sirius' ? mapped.cki : null);
    const indexNotes = siriusIndexNotes(mapped);

    return {
      eye,
      device: _parseCtx.device,
      capturedAt: capturedAt || new Date().toISOString().slice(0, 10),
      patientName: patientName || null,
      patientId: patientId || null,
      kmax: mapped.kmax ?? null,
      kmean: mapped.kmean ?? null,
      k1: mapped.k1 ?? null,
      k2: mapped.k2 ?? null,
      thinnestPachy: mapped.thinnestPachy ?? null,
      centralPachy: mapped.centralPachy ?? null,
      badD,
      abcd: mapped.abcd ? String(mapped.abcd).trim() : null,
      anteriorElevation: mapped.anteriorElevation ?? null,
      posteriorElevation: mapped.posteriorElevation ?? null,
      coneLocation: mapped.coneLocation ?? null,
      source: _parseCtx.source,
      notes: indexNotes,
      rawFields: { ...obj }
    };
  }

  function parseWideFormat(normHeaders, dataRows) {
    const byEyeField = { OD: {}, OS: {} };
    const shared = {};
    let hasWide = false;

    normHeaders.forEach((h, idx) => {
      if (!h) return;
      let m = h.match(EYE_SUFFIX);
      if (m) {
        hasWide = true;
        const eye = parseEye(m[2]);
        const base = normalizeHeader(m[1]);
        const field = aliasField(base);
        if (eye && field) byEyeField[eye][field] = idx;
        return;
      }
      m = h.match(EYE_PREFIX);
      if (m) {
        hasWide = true;
        const eye = parseEye(m[1]);
        const base = normalizeHeader(m[2]);
        const field = aliasField(base);
        if (eye && field) byEyeField[eye][field] = idx;
        return;
      }
      const field = aliasField(h);
      if (field) shared[field] = idx;
    });

    if (!hasWide) return [];

    const readings = [];
    for (const row of dataRows) {
      if (!row.some((c) => String(c).trim())) continue;
      for (const eye of ['OD', 'OS']) {
        const obj = {};
        for (const [field, colIdx] of Object.entries(byEyeField[eye])) {
          obj[field] = row[colIdx];
        }
        for (const [field, colIdx] of Object.entries(shared)) {
          if (field !== 'eye') obj[field] = row[colIdx];
        }
        const reading = mapObjectToReading(
          Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v])),
          eye
        );
        if (reading) {
          if (shared.patientName != null) reading.patientName = row[shared.patientName] || reading.patientName;
          if (shared.patientId != null) reading.patientId = row[shared.patientId] || reading.patientId;
          if (shared.capturedAt != null) {
            const d = parseDate(row[shared.capturedAt]);
            if (d) reading.capturedAt = d;
          }
          readings.push(reading);
        }
      }
    }
    return readings;
  }

  function parseTopographyCsv(text, options = {}) {
    const warnings = [];
    const lines = splitLines(text);
    if (!lines.length) {
      return { readings: [], warnings: ['File is empty'], format: 'unknown', device: options.device || 'Pentacam' };
    }

    const delimiter = detectDelimiter(lines[0]);
    const rows = lines.map((l) => parseCsvLine(l, delimiter));
    const headerIdx = findHeaderIndex(rows);
    const normHeaders = rows[headerIdx].map(normalizeHeader);
    const dataRows = rows.slice(headerIdx + 1);

    let device = 'Pentacam';
    if (options.device === 'Sirius') {
      device = 'Sirius';
    } else if (options.device === 'Pentacam') {
      device = 'Pentacam';
    } else if (looksLikeSiriusHeaders(normHeaders)) {
      device = 'Sirius';
      warnings.push('Detected Sirius / CSO Phoenix export format');
    }

    setParseContext(device);

    if (headerIdx > 0) {
      warnings.push(`Skipped ${headerIdx} metadata row(s) before header`);
    }

    let readings = parseWideFormat(normHeaders, dataRows);
    let format = 'wide';

    if (!readings.length) {
      format = 'long';
      for (const row of dataRows) {
        if (!row.some((c) => String(c).trim())) continue;
        const obj = rowToObject(normHeaders, row);
        const reading = mapObjectToReading(obj);
        if (reading) readings.push(reading);
        else warnings.push('Skipped row with no recognizable topography values');
      }
    }

    readings = dedupeReadings(readings);

    return {
      readings,
      warnings,
      format,
      delimiter,
      rowCount: dataRows.length,
      device
    };
  }

  function parsePentacamCsv(text) {
    return parseTopographyCsv(text, { device: 'Pentacam' });
  }

  function parseSiriusCsv(text) {
    return parseTopographyCsv(text, { device: 'Sirius' });
  }

  function dedupeReadings(readings) {
    const seen = new Set();
    return readings.filter((r) => {
      const key = `${r.eye}|${r.capturedAt}|${r.kmax}|${r.thinnestPachy}|${r.device}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function importNote(reading) {
    if (reading.source === 'sirius_csv') {
      return reading.notes
        ? `Imported from Sirius / CSO Phoenix CSV (${reading.notes})`
        : 'Imported from Sirius / CSO Phoenix CSV';
    }
    return 'Imported from Pentacam CSV';
  }

  function toKcTopoRow(reading, kcPatientId) {
    return {
      kcPatientId,
      kcTopoEye: reading.eye,
      kcTopoCapturedAt: reading.capturedAt,
      kcTopoDevice: reading.device || 'Pentacam',
      kcTopoKmax: reading.kmax,
      kcTopoKmean: reading.kmean,
      kcTopoK1: reading.k1,
      kcTopoK2: reading.k2,
      kcTopoThinnestPachy: reading.thinnestPachy,
      kcTopoCentralPachy: reading.centralPachy,
      kcTopoBadD: reading.badD,
      kcTopoAbcd: reading.abcd,
      kcTopoConeLocation: reading.coneLocation,
      kcTopoProgressionFlag: 'None',
      kcTopoNotes: importNote(reading),
      source: reading.source || 'pentacam_csv'
    };
  }

  function toLaserWorkupPatches(readings) {
    const device = readings[0]?.device || 'Pentacam';
    const patches = { topography: { device, od: {}, os: {}, shared: {} }, corneal: { od: {}, os: {} } };
    for (const r of readings) {
      const side = r.eye === 'OS' ? 'os' : 'od';
      Object.assign(patches.topography[side], {
        badD: r.badD,
        abcd: r.abcd,
        coneLocation: r.coneLocation,
        anteriorElevation: r.anteriorElevation,
        posteriorElevation: r.posteriorElevation
      });
      Object.assign(patches.corneal[side], {
        kmax: r.kmax,
        k1: r.k1,
        k2: r.k2,
        pachymetry: r.centralPachy,
        thinnestPachy: r.thinnestPachy
      });
      const kcFlag = r.badD != null && r.badD >= 1.6;
      if (kcFlag) {
        patches.corneal[side].keratoconus = 'Yes';
      }
    }
    return patches;
  }

  function formatPreviewRow(r) {
    return {
      eye: r.eye,
      date: r.capturedAt,
      device: r.device || '—',
      kmax: r.kmax ?? '—',
      kmean: r.kmean ?? '—',
      pachyMin: r.thinnestPachy ?? '—',
      badD: r.badD ?? '—',
      patient: r.patientName || r.patientId || '—'
    };
  }

  const sharedApi = {
    parseTopographyCsv,
    parsePentacamCsv,
    parseSiriusCsv,
    toKcTopoRow,
    toLaserWorkupPatches,
    formatPreviewRow,
    parseEye,
    parseDate
  };

  global.CorneaPentacamImport = sharedApi;
  global.CorneaSiriusImport = {
    parseSiriusCsv,
    toKcTopoRow: sharedApi.toKcTopoRow,
    toLaserWorkupPatches: sharedApi.toLaserWorkupPatches,
    formatPreviewRow: sharedApi.formatPreviewRow
  };
  global.CorneaTopographyImport = sharedApi;
})(typeof window !== 'undefined' ? window : globalThis);
