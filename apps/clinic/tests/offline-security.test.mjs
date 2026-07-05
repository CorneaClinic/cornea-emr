/**
 * Project 3 — offline encryption round-trip (Node Web Crypto).
 * Run: node apps/clinic/tests/offline-security.test.mjs
 */
import { webcrypto } from 'crypto';

const crypto = webcrypto;

function b64FromBytes(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function bytesFromB64(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

async function deriveKeyFromPassword(password) {
  const enc = new TextEncoder();
  const salt = enc.encode('test-salt');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptJson(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(obj))
  );
  return { iv: b64FromBytes(iv), ct: b64FromBytes(new Uint8Array(cipher)) };
}

async function decryptJson(key, wrapped) {
  const iv = bytesFromB64(wrapped.iv);
  const ct = bytesFromB64(wrapped.ct);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(plain));
}

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log('  ✓', msg);
  } else {
    failed += 1;
    console.error('  ✗', msg);
  }
}

async function run() {
  console.log('offline-security.test.mjs\n');
  const key = await deriveKeyFromPassword('TestPass123');
  const sample = { fullName: 'Jane Doe', phone: '+91 9876543210', diagnosis: 'Keratoconus' };
  const wrapped = await encryptJson(key, sample);
  const restored = await decryptJson(key, wrapped);
  assert(restored.fullName === sample.fullName, 'decrypt restores fullName');
  assert(restored.diagnosis === sample.diagnosis, 'decrypt restores clinical field');
  assert(wrapped.iv && wrapped.ct, 'produces iv and ciphertext');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
