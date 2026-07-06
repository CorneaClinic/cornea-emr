import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('virusScanService', () => {
  let scanUploadBuffer;

  const baseArgs = {
    buffer: Buffer.from('clean-file-content'),
    mimeType: 'image/jpeg',
    originalFilename: 'scan.jpg',
    clinicId: 'clinic-1',
    assetId: 'asset-1',
    checksum: 'abc123'
  };

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn());
    delete process.env.MEDIA_VIRUS_SCAN_HOOK_URL;
    delete process.env.MEDIA_VIRUS_SCAN_HOOK_SECRET;
    delete process.env.MEDIA_VIRUS_SCAN_REQUIRED;
    vi.resetModules();
    ({ scanUploadBuffer } = await import('../src/services/virusScanService.js'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadWithHook(opts = {}) {
    process.env.MEDIA_VIRUS_SCAN_HOOK_URL = opts.url || 'http://scan.test/hook';
    if (opts.secret) process.env.MEDIA_VIRUS_SCAN_HOOK_SECRET = opts.secret;
    if (opts.required) process.env.MEDIA_VIRUS_SCAN_REQUIRED = 'true';
    vi.resetModules();
    ({ scanUploadBuffer } = await import('../src/services/virusScanService.js'));
  }

  it('skips scan when hook URL is not configured', async () => {
    const result = await scanUploadBuffer(baseArgs);
    expect(result).toEqual({ scanned: false, skipped: true, reason: 'hook_not_configured' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns clean when hook approves upload', async () => {
    await loadWithHook();
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ clean: true })
    });

    const result = await scanUploadBuffer(baseArgs);
    expect(result).toEqual({ scanned: true, clean: true });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('http://scan.test/hook');
    const body = JSON.parse(init.body);
    expect(body.assetId).toBe('asset-1');
    expect(body.contentBase64).toBe(baseArgs.buffer.toString('base64'));
  });

  it('sends Authorization header when secret is set', async () => {
    await loadWithHook({ secret: 'hook-secret' });
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ clean: true })
    });

    await scanUploadBuffer(baseArgs);
    const [, init] = fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer hook-secret');
  });

  it('blocks upload when hook reports malware', async () => {
    await loadWithHook();
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ clean: false, threat: 'EICAR-Test-File' })
    });

    await expect(scanUploadBuffer(baseArgs)).rejects.toThrow(/Upload blocked: EICAR-Test-File/);
  });

  it('skips on hook HTTP error when scan is not required', async () => {
    await loadWithHook();
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'scanner down' })
    });

    const result = await scanUploadBuffer(baseArgs);
    expect(result.scanned).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/hook_error_503/);
  });

  it('blocks on hook HTTP error when scan is required', async () => {
    await loadWithHook({ required: true });
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: 'scanner down' })
    });

    await expect(scanUploadBuffer(baseArgs)).rejects.toThrow(/virus scan hook failed/);
  });

  it('blocks on network error when scan is required', async () => {
    await loadWithHook({ required: true });
    fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await expect(scanUploadBuffer(baseArgs)).rejects.toThrow(/virus scan hook unavailable/);
  });
});
