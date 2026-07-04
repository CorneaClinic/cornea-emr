# Clinical backlog (post-stabilization)

**Started:** 2026-07-04  
**Gate lifted:** Operator chose to start deferred Top 20 items while vendor pen-test remains postponed.

---

## Sequence

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| B1 | Contact lens outcomes in research tab | **Done** | Cohort `contact-lens`, overview stats, CSV/FHIR export |
| B2 | Mobile-optimized visit summary | Planned | Responsive print/summary view |
| B3 | Teaching case library + anonymization | Planned | Builds on `teaching_case` media category |
| B4 | LDAP/SSO | Planned | Large — identity provider integration |

---

## B1 — Contact lens outcomes

### What shipped

- **API:** `contactLensOutcomesService.js` — parses `contactLensJSON` from visit payloads, cohort listing, overview counts
- **Research cohort:** `contact-lens` in `/api/v1/research-analytics/cohort/:type`
- **Dashboard:** Visit count + unique patient count on Research tab
- **Offline:** Local IndexedDB fallback from `patients` store when cloud unavailable
- **FHIR:** Anonymized cohort export includes contact lens type observation

### Verify

1. Sign in to cloud with research export permission
2. Open **Research** tab → confirm **CL visits** / **CL patients** stats
3. Cohort builder → **Contact lens fitting outcomes** → table + CSV export
4. API unit tests: `npm run test --workspace=apps/api -- contact-lens-outcomes`

### Data source

Contact lens data is captured in the visit form (`contactLensJSON` hidden field) and synced to `visits.payload` JSONB. Only visits with documented indication, final Rx, complications, or history are included.

---

## References

- [PRODUCTION_STABILIZATION_ROADMAP.md](./PRODUCTION_STABILIZATION_ROADMAP.md) — original deferred list
- [STABILIZATION_MODE.md](./STABILIZATION_MODE.md) — ops rhythm; backlog exit criteria
