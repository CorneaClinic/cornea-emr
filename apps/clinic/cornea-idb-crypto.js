/**
 * AES-256-GCM helpers for local PHI encryption (Project 3).
 * Session key lives in memory only — cleared on lock/logout.
 */
(function idbCryptoModule(global) {
  'use strict';

  const ENC_VERSION = 1;
  const HKDF_SALT = 'cornea-emr-local-v1';
  const HKDF_INFO = 'phi-records';
  const SESSION_KEY_STORAGE = 'corneaIdbSessionKey';

  /** @type {CryptoKey | null} */
  let sessionKey = null;

  async function persistSessionKey() {
    if (!sessionKey) {
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
      return;
    }
    const raw = await crypto.subtle.exportKey('raw', sessionKey);
    sessionStorage.setItem(SESSION_KEY_STORAGE, b64FromBytes(new Uint8Array(raw)));
  }

  async function restoreSessionKeyFromStorage() {
    const b64 = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (!b64) return false;
    try {
      sessionKey = await importAesKey(bytesFromB64(b64));
      return true;
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
      return false;
    }
  }

  function b64FromBytes(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)));
  }

  function bytesFromB64(b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  async function importAesKey(rawBytes) {
    return crypto.subtle.importKey(
      'raw',
      rawBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function deriveKeyFromPassword(password, saltB64) {
    const enc = new TextEncoder();
    const salt = saltB64
      ? bytesFromB64(saltB64)
      : crypto.getRandomValues(new Uint8Array(16));
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

  async function deriveKeyFromCloudSession(accessToken, deviceId) {
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest(
      'SHA-256',
      enc.encode(`${accessToken}:${deviceId || 'device'}`)
    );
    const hkdfKey = await crypto.subtle.importKey(
      'raw',
      digest,
      'HKDF',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: enc.encode(HKDF_SALT),
        info: enc.encode(HKDF_INFO)
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptBytes(plainBytes) {
    if (!sessionKey) throw new Error('Encryption session not unlocked');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      plainBytes
    );
    return { v: ENC_VERSION, iv: b64FromBytes(iv), ct: b64FromBytes(cipher) };
  }

  async function decryptBytes(wrapped) {
    if (!sessionKey) throw new Error('Encryption session not unlocked');
    if (!wrapped?.iv || !wrapped?.ct) throw new Error('Invalid encrypted payload');
    const iv = bytesFromB64(wrapped.iv);
    const ct = bytesFromB64(wrapped.ct);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, sessionKey, ct);
    return new Uint8Array(plain);
  }

  async function encryptJson(obj) {
    const enc = new TextEncoder();
    return encryptBytes(enc.encode(JSON.stringify(obj)));
  }

  async function decryptJson(wrapped) {
    const bytes = await decryptBytes(wrapped);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(bytes));
  }

  async function encryptBlob(blob) {
    const buf = await blob.arrayBuffer();
    const wrapped = await encryptBytes(buf);
    return { ...wrapped, mimeType: blob.type || 'application/octet-stream' };
  }

  async function decryptBlob(wrapped) {
    const bytes = await decryptBytes(wrapped);
    return new Blob([bytes], { type: wrapped.mimeType || 'application/octet-stream' });
  }

  global.CorneaIdbCrypto = {
    ENC_VERSION,
    hasSessionKey() {
      return !!sessionKey;
    },
    clearSessionKey() {
      sessionKey = null;
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
    },
    async restoreSessionKeyFromStorage() {
      const ok = await restoreSessionKeyFromStorage();
      return ok;
    },
    async unlockWithPassword(password, saltB64) {
      sessionKey = await deriveKeyFromPassword(password, saltB64);
      await persistSessionKey();
    },
    async unlockWithCloudSession(accessToken, deviceId) {
      sessionKey = await deriveKeyFromCloudSession(accessToken, deviceId);
      await persistSessionKey();
    },
    encryptJson,
    decryptJson,
    encryptBlob,
    decryptBlob,
    isEncryptedPayload(value) {
      return !!(value && value.v === ENC_VERSION && value.iv && value.ct);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
