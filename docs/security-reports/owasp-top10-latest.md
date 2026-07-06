# OWASP Top 10 (2021) — Cornea EMR

Generated: 2026-07-06T13:35:46.086Z

**Overall:** PARTIAL — mitigated 6, partial 4, open 0

| ID | Risk | Status | Key evidence |
|----|------|--------|--------------|
| A01 | Broken Access Control | mitigated | RBAC via requirePermission middleware; gap: Formal vendor pen-test on sync/push paths pending |
| A02 | Cryptographic Failures | mitigated | HTTPS/TLS on clinic + API (Cloudflare); gap: Rotate secrets on schedule (ops) |
| A03 | Injection | mitigated | Parameterized PostgreSQL queries |
| A04 | Insecure Design | partial | Offline-first sync with conflict resolution; gap: Staging mirror for safe pre-release testing |
| A05 | Security Misconfiguration | partial | Production CORS allowlist enforced at startup; gap: Quarterly role review (ops) |
| A06 | Vulnerable and Outdated Components | partial | npm audit in CI; gap: Track CVE response SLA |
| A07 | Identification and Authentication Failures | mitigated | Session families + refresh rotation; gap: Optional jti binding on logout (Wave 3) |
| A08 | Software and Data Integrity Failures | partial | SHA-256 checksum dedup on media uploads; gap: Wire external scanner in production when available |
| A09 | Security Logging and Monitoring Failures | mitigated | audit_logs table + auditMutation; gap: Centralized log aggregation (ops) |
| A10 | Server-Side Request Forgery (SSRF) | mitigated | No user-controlled outbound fetch in API |

## Operator next steps

1. `npm run verify:security` — automated P6 checks
2. `npm run pentest:self-check` — static remediation scan
3. `npm run security:auth-sessions` — session posture (needs credentials)
4. Reactivate vendor per `docs/PENTEST_ENGAGEMENT.md` when ready
