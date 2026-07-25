/**
 * AES-256-GCM helpers for local PHI encryption (Project 3).
 * Session key lives in memory (+ sessionStorage for soft reloads).
 * Cloud key is derived from stable user/clinic/device ids — NOT the rotating access token.
 */
(function idbCryptoModule(global) {
  'use strict';

  const ENC_VERSION = 1;
  const HKDF_SALT = 'cornea-emr-local-v1';
  const HKDF_INFO = 'phi-records';
  const HKDF_INFO_LEGACY_TOKEN = 'phi-records';
  const HKDF_INFO_STABLE = 'phi-records-cloud-v2';
  const SESSION_KEY_STORAGE = 'corneaIdbSessionKey';
  const SESSION_KEY_META = 'corneaIdbSessionKeyMeta';

  /** @type {CryptoKey | null} */
  let sessionKey = null;
  /** @type {{ mode: string, fingerprint?: string } | null} */
  let sessionKeyMeta = null;

  function b64FromBytes(bytes) {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let s = '';
    const chunk = 0x8000;
    for (let i = 0; i < arr.length; i += chunk) {
      s += String.fromCharCode.apply(null, arr.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  function bytesFromB64(b64) {
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }

  async function importAesKey(rawBytes, extractable = true) {
    return crypto.subtle.importKey(
      'raw',
      rawBytes,
      { name: 'AES-GCM', length: 256 },
      extractable,
      ['encrypt', 'decrypt']
    );
  }

  async function persistSessionKey() {
    if (!sessionKey) {
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
      sessionStorage.removeItem(SESSION_KEY_META);
      return;
    }
    try {
      const raw = await crypto.subtle.exportKey('raw', sessionKey);
      sessionStorage.setItem(SESSION_KEY_STORAGE, b64FromBytes(new Uint8Array(raw)));
      if (sessionKeyMeta) {
        sessionStorage.setItem(SESSION_KEY_META, JSON.stringify(sessionKeyMeta));
      }
    } catch (err) {
      console.warn('[CorneaIdbCrypto] Could not persist session key:', err?.message || err);
    }
  }

  async function restoreSessionKeyFromStorage() {
    const b64 = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (!b64) return false;
    try {
      sessionKey = await importAesKey(bytesFromB64(b64), true);
      try {
        sessionKeyMeta = JSON.parse(sessionStorage.getItem(SESSION_KEY_META) || 'null');
      } catch (_) {
        sessionKeyMeta = null;
      }
      return true;
    } catch (_) {
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
      sessionStorage.removeItem(SESSION_KEY_META);
      return false;
    }
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
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return importAesKey(bits, true);
  }

  async function deriveHkdfKey(ikmBytes, infoString) {
    const enc = new TextEncoder();
    const hkdfKey = await crypto.subtle.importKey('raw', ikmBytes, 'HKDF', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: enc.encode(HKDF_SALT),
        info: enc.encode(infoString)
      },
      hkdfKey,
      256
    );
    return importAesKey(bits, true);
  }

  /** Legacy (broken) cloud KDF — access token rotates and breaks decrypt. */
  async function deriveLegacyTokenCloudKey(accessToken, deviceId) {
    const enc = new TextEncoder();
    const digest = await crypto.subtle.digest(
      'SHA-256',
      enc.encode(`${accessToken}:${deviceId || 'device'}`)
    );
    return deriveHkdfKey(digest, HKDF_INFO_LEGACY_TOKEN);
  }

  /** Stable cloud KDF — survives access-token refresh. */
  async function deriveStableCloudKey(userId, clinicId, deviceId) {
    const enc = new TextEncoder();
    const material = `cornea-cloud-phi-v2:${clinicId || 'clinic'}:${userId || 'user'}:${deviceId || 'device'}`;
    const digest = await crypto.subtle.digest('SHA-256', enc.encode(material));
    return deriveHkdfKey(digest, HKDF_INFO_STABLE);
  }

  async function encryptBytes(plainBytes, key = sessionKey) {
    if (!key) throw new Error('Encryption session not unlocked');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      plainBytes
    );
    return { v: ENC_VERSION, iv: b64FromBytes(iv), ct: b64FromBytes(cipher) };
  }

  async function decryptBytes(wrapped, key = sessionKey) {
    if (!key) throw new Error('Encryption session not unlocked');
    if (!wrapped?.iv || !wrapped?.ct) throw new Error('Invalid encrypted payload');
    const iv = bytesFromB64(wrapped.iv);
    const ct = bytesFromB64(wrapped.ct);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new Uint8Array(plain);
  }

  async function encryptJson(obj, key) {
    const enc = new TextEncoder();
    return encryptBytes(enc.encode(JSON.stringify(obj)), key);
  }

  async function decryptJson(wrapped, key) {
    const bytes = await decryptBytes(wrapped, key);
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

  /**
   * Try decrypt with current key, then optional legacy keys.
   * @returns {{ data: object, usedLegacy: boolean } | null}
   */
  async function tryDecryptJsonWithFallbacks(wrapped, legacyKeys = []) {
    if (!wrapped) return null;
    if (sessionKey) {
      try {
        return { data: await decryptJson(wrapped, sessionKey), usedLegacy: false };
      } catch (_) { /* try legacy */ }
    }
    for (const key of legacyKeys) {
      if (!key) continue;
      try {
        return { data: await decryptJson(wrapped, key), usedLegacy: true };
      } catch (_) { /* next */ }
    }
    return null;
  }

  global.CorneaIdbCrypto = {
    ENC_VERSION,
    hasSessionKey() {
      return !!sessionKey;
    },
    getSessionKeyMeta() {
      return sessionKeyMeta ? { ...sessionKeyMeta } : null;
    },
    clearSessionKey() {
      sessionKey = null;
      sessionKeyMeta = null;
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
      sessionStorage.removeItem(SESSION_KEY_META);
    },
    /** Return the in-memory key without clearing it (for legacy rewrap). */
    peekSessionKey() {
      return sessionKey;
    },
    async restoreSessionKeyFromStorage() {
      return restoreSessionKeyFromStorage();
    },
    async unlockWithPassword(password, saltB64) {
      sessionKey = await deriveKeyFromPassword(password, saltB64);
      sessionKeyMeta = { mode: 'offline-password' };
      await persistSessionKey();
    },
    /**
     * Unlock using stable user/clinic/device material (preferred).
     * @param {string} accessToken — still accepted for legacy rewrap
     * @param {string} deviceId
     * @param {{ id?: string, clinicId?: string }} [user]
     */
    async unlockWithCloudSession(accessToken, deviceId, user) {
      const previousKey = sessionKey;
      const userId = user?.id || user?.sub || '';
      const clinicId = user?.clinicId || '';
      if (userId) {
        sessionKey = await deriveStableCloudKey(userId, clinicId, deviceId);
        sessionKeyMeta = {
          mode: 'cloud-stable-v2',
          fingerprint: `${clinicId}:${userId}:${deviceId || ''}`
        };
      } else {
        // Fallback only when profile is not yet available
        sessionKey = await deriveLegacyTokenCloudKey(accessToken, deviceId);
        sessionKeyMeta = { mode: 'cloud-legacy-token' };
      }
      await persistSessionKey();
      const tokenLegacy = accessToken
        ? await deriveLegacyTokenCloudKey(accessToken, deviceId).catch(() => null)
        : null;
      const legacyKeys = [];
      if (previousKey && previousKey !== sessionKey) legacyKeys.push(previousKey);
      if (tokenLegacy && tokenLegacy !== sessionKey) legacyKeys.push(tokenLegacy);
      return { legacyKeys, legacyKey: tokenLegacy };
    },
    deriveLegacyTokenCloudKey,
    deriveStableCloudKey,
    encryptJson,
    decryptJson,
    tryDecryptJsonWithFallbacks,
    encryptBlob,
    decryptBlob,
    isEncryptedPayload(value) {
      return !!(value && value.v === ENC_VERSION && value.iv && value.ct);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
