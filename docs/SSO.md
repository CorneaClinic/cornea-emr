# LDAP / SSO (backlog B4)

Optional enterprise sign-in for the Cornea EMR API and clinic UI. **Local email/password remains the default** when SSO environment variables are not set.

---

## Supported methods

| Method | Flow | Clinic UI |
|--------|------|-----------|
| **OIDC** | Authorization code → API callback → redirect to `sso-callback.html` with access token | “Sign in with organization SSO” |
| **LDAP** | Service account search + user bind | “Sign in with directory (LDAP)” |

Users are linked by `users.auth_provider` + `users.external_subject`, or matched by email and upgraded. New users can be auto-provisioned when enabled.

---

## Database migration

Run on the API host:

```bash
npm run api:migrate
```

Migration `023_sso_auth.sql` adds `auth_provider` (`local` \| `ldap` \| `oidc`) and `external_subject`.

---

## Environment variables

### Shared

| Variable | Default | Description |
|----------|---------|-------------|
| `CLINIC_PUBLIC_URL` | First `CORS_ORIGIN` | Clinic origin for OIDC return URLs (e.g. `https://corneaclinic.visionemr.net`) |
| `SSO_DEFAULT_ROLE` | `ophthalmologist` | Role for auto-provisioned users |
| `SSO_AUTO_PROVISION` | `false` | Create users when no match exists |
| `SSO_DEFAULT_CLINIC_ID` | First active clinic | Target clinic for provisioning/linking |

### OIDC

| Variable | Required when enabled |
|----------|----------------------|
| `SSO_OIDC_ENABLED` | `true` |
| `SSO_OIDC_ISSUER` | IdP issuer URL |
| `SSO_OIDC_CLIENT_ID` | OAuth client ID |
| `SSO_OIDC_CLIENT_SECRET` | OAuth client secret |
| `SSO_OIDC_REDIRECT_URI` | e.g. `https://your-api.example.com/api/v1/auth/sso/oidc/callback` |
| `SSO_OIDC_SCOPES` | Optional; default `openid email profile` |

Register the redirect URI with your identity provider (Azure AD, Okta, Keycloak, etc.).

### LDAP

| Variable | Required when enabled |
|----------|----------------------|
| `SSO_LDAP_ENABLED` | `true` |
| `SSO_LDAP_URL` | e.g. `ldaps://ldap.example.com:636` |
| `SSO_LDAP_BIND_DN` | Service account DN |
| `SSO_LDAP_BIND_PASSWORD` | Service account password |
| `SSO_LDAP_SEARCH_BASE` | Search base OU |
| `SSO_LDAP_SEARCH_FILTER` | Default `(mail={{email}})` |
| `SSO_LDAP_TLS_REJECT_UNAUTHORIZED` | Default `true` |

---

## API endpoints

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/v1/auth/sso/config` | Public |
| GET | `/api/v1/auth/sso/oidc/login?returnUrl=` | Public → redirect to IdP |
| GET | `/api/v1/auth/sso/oidc/callback` | Public → redirect to clinic |
| POST | `/api/v1/auth/sso/ldap/login` | Public (rate limited) |

---

## Clinic flow

1. Cloud sign-in modal loads SSO options from `/api/v1/auth/sso/config`.
2. **OIDC:** browser navigates to API login URL → IdP → callback sets refresh cookie → redirect to `sso-callback.html` with access token → `Cornea.html?cloud=1`.
3. **LDAP:** same email/password fields; directory button POSTs to LDAP login endpoint.

---

## Verify

1. With SSO disabled: local login unchanged; SSO panel hidden.
2. Enable LDAP or OIDC on staging; confirm `/api/v1/auth/sso/config` shows `enabled: true`.
3. Unit tests: `npm test -- sso-config` (in `apps/api`).

---

## Security notes

- OIDC state is a short-lived JWT signed with `JWT_SECRET`.
- LDAP bind failures return generic “Invalid email or password”.
- Rate limits match `/auth/login`.
- Do not enable `SSO_AUTO_PROVISION` in production without an IdP you trust to assert identity.
