/**
 * Minimal valid DICOM Part 10 buffer for e2e parse/ingest tests.
 */

function u16LE(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n);
  return b;
}

function u32LE(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function tag(group, element) {
  const b = Buffer.alloc(4);
  b.writeUInt16LE(group, 0);
  b.writeUInt16LE(element, 2);
  return b;
}

function padEven(buf) {
  if (buf.length % 2 === 0) return buf;
  return Buffer.concat([buf, Buffer.from([0x20])]);
}

function elExplicit(group, elem, vr, valueBytes) {
  const val = padEven(valueBytes);
  const t = tag(group, elem);
  const vrBuf = Buffer.from(vr, 'ascii');
  if (vr === 'OB' || vr === 'OW' || vr === 'SQ' || vr === 'UN' || vr === 'UT') {
    return Buffer.concat([t, vrBuf, Buffer.alloc(2), u32LE(val.length), val]);
  }
  return Buffer.concat([t, vrBuf, u16LE(val.length), val]);
}

function strVal(s) {
  return Buffer.from(s);
}

function buildFileMeta() {
  const syntaxUID = '1.2.840.10008.1.2.1';
  const body = Buffer.concat([
    elExplicit(0x0002, 0x0001, 'OB', Buffer.from([0x00, 0x01])),
    elExplicit(0x0002, 0x0010, 'UI', Buffer.from(`${syntaxUID}\0`)),
    elExplicit(0x0002, 0x0012, 'UI', Buffer.from('1.2.3.4.5\0'))
  ]);
  const groupLen = elExplicit(0x0002, 0x0000, 'UL', u32LE(body.length));
  return Buffer.concat([groupLen, body]);
}

export function buildMinimalDicomBuffer() {
  const dataSet = Buffer.concat([
    elExplicit(0x0008, 0x0060, 'CS', strVal('OT')),
    elExplicit(0x0008, 0x1030, 'LO', strVal('Pentacam HR')),
    elExplicit(0x0010, 0x0010, 'PN', strVal('Doe^John')),
    elExplicit(0x0010, 0x0020, 'LO', strVal('PW-DICOM-E2E'))
  ]);
  const preamble = Buffer.alloc(128, 0);
  const magic = Buffer.from('DICM');
  return Buffer.concat([preamble, magic, buildFileMeta(), dataSet]);
}
