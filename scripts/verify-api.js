/**
 * Verify Cornea EMR API endpoints.
 * Usage: SEED_ADMIN_PASSWORD=... node scripts/verify-api.js
 */
const API = process.env.API_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@corneaclinic.local';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD;

if (!PASSWORD) {
  console.error('Set SEED_ADMIN_PASSWORD (or run: npm run seed and use the printed password).');
  process.exit(1);
}

async function check(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (err) {
    console.error(`✗ ${name}:`, err.message);
    return false;
  }
}

let token = '';

const ok = [];
ok.push(await check('GET /health', async () => {
  const res = await fetch(`${API}/health`);
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(JSON.stringify(data));
}));

ok.push(await check('POST /api/v1/auth/login', async () => {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  const data = await res.json();
  if (!res.ok || !data.accessToken) throw new Error(JSON.stringify(data));
  token = data.accessToken;
}));

ok.push(await check('GET /api/v1/auth/me', async () => {
  const res = await fetch(`${API}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok || !data.user?.email) throw new Error(JSON.stringify(data));
}));

ok.push(await check('GET /api/v1/icd/status', async () => {
  const res = await fetch(`${API}/api/v1/icd/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (!res.ok || typeof data.data?.configured !== 'boolean') throw new Error(JSON.stringify(data));
}));

const passed = ok.filter(Boolean).length;
console.log(`\n${passed}/${ok.length} checks passed`);
process.exit(passed === ok.length ? 0 : 1);
