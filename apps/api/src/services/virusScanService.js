import { env } from '../config/env.js';
import { ValidationError } from '../core/errors.js';

/**
 * Optional malware scan hook for media uploads (Project 6).
 * Configure MEDIA_VIRUS_SCAN_HOOK_URL to POST file metadata + optional base64 body.
 *
 * Hook contract (JSON):
 *   Request:  { assetId, clinicId, filename, mimeType, byteSize, checksum, contentBase64? }
 *   Response: { clean: true } | { clean: false, threat: "name" }
 */
export async function scanUploadBuffer({
  buffer,
  mimeType,
  originalFilename,
  clinicId,
  assetId,
  checksum
}) {
  const hookUrl = env.media.virusScanHookUrl?.trim();
  if (!hookUrl) {
    return { scanned: false, skipped: true, reason: 'hook_not_configured' };
  }

  const payload = {
    assetId,
    clinicId,
    filename: originalFilename,
    mimeType,
    byteSize: buffer.length,
    checksum
  };

  if (buffer.length <= env.media.virusScanMaxPayloadBytes) {
    payload.contentBase64 = buffer.toString('base64');
  }

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (env.media.virusScanHookSecret) {
    headers.Authorization = `Bearer ${env.media.virusScanHookSecret}`;
  }

  try {
    const res = await fetch(hookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(env.media.virusScanTimeoutMs)
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail = body?.error || body?.message || `HTTP ${res.status}`;
      if (env.media.virusScanRequired) {
        throw new ValidationError(`Upload blocked: virus scan hook failed (${detail})`);
      }
      return { scanned: false, skipped: true, reason: `hook_error_${res.status}` };
    }

    if (body.clean === false) {
      const threat = body.threat || 'malware detected';
      throw new ValidationError(`Upload blocked: ${threat}`);
    }

    return { scanned: true, clean: true };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    if (env.media.virusScanRequired) {
      throw new ValidationError(`Upload blocked: virus scan hook unavailable (${err.message})`);
    }
    return { scanned: false, skipped: true, reason: err.message };
  }
}
