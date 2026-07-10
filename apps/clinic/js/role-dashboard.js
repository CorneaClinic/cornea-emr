/**
 * Role-based home dashboard — client-only profiles.
 * Maps cloud + offline roles to widgets/actions without schema changes.
 */
(function (global) {
  'use strict';

  const LAYOUT_KEY = 'corneaRoleDashLayout';

  /** Normalize cloud/offline role ids to dashboard profile keys. */
  const ROLE_ALIASES = Object.freeze({
    admin: 'administrator',
    administrator: 'administrator',
    medical_director: 'medical_director',
    cornea_consultant: 'cornea_consultant',
    consultant: 'cornea_consultant',
    ophthalmologist: 'general_ophthalmologist',
    general_ophthalmologist: 'general_ophthalmologist',
    doctor_in_training: 'cornea_fellow',
    cornea_fellow: 'cornea_fellow',
    resident: 'cornea_fellow',
    optometrist: 'optometrist',
    technician: 'ophthalmic_technician',
    ophthalmic_technician: 'ophthalmic_technician',
    nurse: 'nurse',
    ot_nurse: 'ot_nurse',
    ot_coordinator: 'ot_coordinator',
    receptionist: 'receptionist',
    refractive_surgeon: 'refractive_surgeon',
    eye_bank_technician: 'eye_bank_technician',
    research_coordinator: 'research_coordinator'
  });

  const PROFILE_LABELS = Object.freeze({
    receptionist: 'Receptionist',
    optometrist: 'Optometrist',
    ophthalmic_technician: 'Ophthalmic Technician',
    nurse: 'Nurse',
    ot_nurse: 'OT Nurse',
    ot_coordinator: 'OT Coordinator',
    general_ophthalmologist: 'General Ophthalmologist',
    cornea_fellow: 'Cornea Fellow',
    cornea_consultant: 'Cornea Consultant',
    refractive_surgeon: 'Refractive Surgeon',
    eye_bank_technician: 'Eye Bank Technician',
    research_coordinator: 'Research Coordinator',
    administrator: 'Administrator',
    medical_director: 'Medical Director'
  });

  function action(label, icon, cspAction, args, opts = {}) {
    return { label, icon, cspAction, args: args || [], soon: !!opts.soon, section: opts.section || null };
  }

  function widget(id, title, icon, opts = {}) {
    return {
      id,
      title,
      icon,
      hint: opts.hint || '',
      valueId: opts.valueId || null,
      defaultValue: opts.defaultValue != null ? opts.defaultValue : '—',
      soon: !!opts.soon,
      linkTab: opts.linkTab || null,
      linkAction: opts.linkAction || null,
      linkArgs: opts.linkArgs || [],
      category: opts.category || 'ops'
    };
  }

  const PROFILES = Object.freeze({
    receptionist: {
      showTodayActivity: true,
      showInstituteMetrics: false,
      widgets: [
        widget('todays_appts', "Today's Appointments", 'fa-calendar-days', { valueId: 'roleW_todaysAppts', hint: 'Open Appointments for the live schedule.', linkTab: 'appointmentsTab' }),
        widget('walkins', 'Walk-in Patients', 'fa-person-walking', { hint: 'Track walk-ins via Patient Flow.', linkTab: 'flowTab' }),
        widget('waiting', 'Patients Waiting', 'fa-hourglass-half', { hint: 'Station queues live in Patient Flow.', linkTab: 'flowTab' }),
        widget('registered', 'Patients Registered', 'fa-user-check', { valueId: 'roleW_registered', linkTab: 'recordsTab' }),
        widget('payments', 'Pending Payments', 'fa-money-bill', { soon: true, hint: 'Billing module reserved.' })
      ],
      actions: [
        action('New Patient', 'fa-user-plus', 'newPatient', [], { section: 'patient_form' }),
        action('Search Patient', 'fa-magnifying-glass', 'switchTab', ['recordsTab'], { section: 'records' }),
        action('Appointments', 'fa-calendar-days', 'switchTab', ['appointmentsTab'], { section: 'appointments_recall' }),
        action('Patient Flow', 'fa-route', 'switchTab', ['flowTab'], { section: 'patient_flow' })
      ],
      panels: ['recent', 'appointments', 'announcements', 'productivity', 'safety']
    },
    optometrist: {
      showTodayActivity: true,
      showInstituteMetrics: false,
      widgets: [
        widget('todays_patients', "Today's Patients", 'fa-users', { valueId: 'roleW_todayVisits', linkTab: 'flowTab' }),
        widget('va_queue', 'Visual Acuity Queue', 'fa-eye', { hint: 'Continue VA in General Cornea Clinic.', linkTab: 'formTab' }),
        widget('refraction_queue', 'Refraction Queue', 'fa-glasses', { hint: 'Refraction section of the visit form.', linkTab: 'formTab' }),
        widget('inv_pending', 'Investigations Pending', 'fa-flask', { hint: 'Clinical Media & imaging follow-up.', linkTab: 'clinicalMediaTab' })
      ],
      actions: [
        action('Visual Acuity', 'fa-eye', 'switchTab', ['formTab'], { section: 'patient_form' }),
        action('Refraction', 'fa-glasses', 'switchTab', ['formTab'], { section: 'patient_form' }),
        action('Contact Lens', 'fa-circle', 'navComingSoon', ['Contact Lens Centre'], { soon: true }),
        action('KC Screening', 'fa-chart-line', 'switchTab', ['kcRegistryTab'], { section: 'kc_registry' })
      ],
      panels: ['recent', 'productivity', 'safety']
    },
    ophthalmic_technician: {
      showTodayActivity: true,
      showInstituteMetrics: false,
      widgets: [
        widget('inv_today', "Today's Investigations", 'fa-microscope', { hint: 'Capture and review in Clinical Media.', linkTab: 'clinicalMediaTab' }),
        widget('pentacam', 'Pentacam Queue', 'fa-circle-nodes', { soon: true }),
        widget('asoct', 'AS-OCT Queue', 'fa-wave-square', { soon: true }),
        widget('specular', 'Specular Queue', 'fa-border-all', { soon: true }),
        widget('photo', 'Photography Queue', 'fa-camera', { linkTab: 'clinicalMediaTab' })
      ],
      actions: [
        action('Capture Images', 'fa-camera', 'switchTab', ['clinicalMediaTab'], { section: 'clinical_media' }),
        action('Upload Media', 'fa-cloud-arrow-up', 'switchTab', ['clinicalMediaTab'], { section: 'clinical_media' }),
        action('Quality Check', 'fa-check-double', 'switchTab', ['clinicalMediaTab'], { section: 'clinical_media' })
      ],
      panels: ['recent', 'system']
    },
    nurse: {
      showTodayActivity: true,
      showInstituteMetrics: false,
      widgets: [
        widget('waiting_n', 'Waiting Patients', 'fa-hourglass-half', { linkTab: 'flowTab' }),
        widget('meds', 'Medication Administration', 'fa-pills', { soon: true }),
        widget('procedures', 'Procedures', 'fa-syringe', { linkTab: 'flowTab' }),
        widget('dressing', 'Dressing Changes', 'fa-bandage', { soon: true }),
        widget('vitals', 'Vitals', 'fa-heart-pulse', { hint: 'Record vitals in the visit form.', linkTab: 'formTab' })
      ],
      actions: [
        action('Patient Flow', 'fa-route', 'switchTab', ['flowTab'], { section: 'patient_flow' }),
        action('New Visit', 'fa-stethoscope', 'switchTab', ['formTab'], { section: 'patient_form' }),
        action('Search Patient', 'fa-magnifying-glass', 'switchTab', ['recordsTab'], { section: 'records' })
      ],
      panels: ['recent', 'safety', 'productivity']
    },
    ot_nurse: {
      showTodayActivity: false,
      showInstituteMetrics: false,
      widgets: [
        widget('ot_list', "Today's OT List", 'fa-hospital', { soon: true }),
        widget('block', 'Patients in Block Room', 'fa-syringe', { soon: true }),
        widget('theatre', 'Patients in Theatre', 'fa-bed-pulse', { soon: true }),
        widget('instruments', 'Instrument Checklist', 'fa-clipboard-check', { soon: true }),
        widget('sterile', 'Sterilization Status', 'fa-shield-halved', { soon: true }),
        widget('pending_cases', 'Pending Cases', 'fa-list-check', { soon: true })
      ],
      actions: [
        action('WHO Checklist', 'fa-clipboard-list', 'navComingSoon', ['WHO Checklist'], { soon: true }),
        action('Keratoplasty', 'fa-hand-holding-medical', 'switchTab', ['keratoplastyTab'], { section: 'keratoplasty' }),
        action('Patient Flow', 'fa-route', 'switchTab', ['flowTab'], { section: 'patient_flow' })
      ],
      panels: ['surgical', 'safety', 'announcements']
    },
    ot_coordinator: {
      showTodayActivity: false,
      showInstituteMetrics: true,
      widgets: [
        widget('ot_sched', "Today's OT Schedule", 'fa-calendar-check', { soon: true }),
        widget('ot_util', 'OT Utilisation', 'fa-chart-pie', { soon: true }),
        widget('delays', 'Delays', 'fa-clock', { soon: true }),
        widget('cancelled', 'Cancelled Cases', 'fa-ban', { soon: true }),
        widget('eb_res', 'Eye Bank Reservations', 'fa-hand-holding-heart', { linkTab: 'keratoplastyTab' }),
        widget('equip', 'Equipment Status', 'fa-screwdriver-wrench', { soon: true })
      ],
      actions: [
        action('Keratoplasty Centre', 'fa-hand-holding-medical', 'switchTab', ['keratoplastyTab'], { section: 'keratoplasty' }),
        action('Appointments', 'fa-calendar-days', 'switchTab', ['appointmentsTab'], { section: 'appointments_recall' }),
        action('Surgical Centre', 'fa-hospital', 'navComingSoon', ['Surgical Centre'], { soon: true })
      ],
      panels: ['surgical', 'system', 'announcements']
    },
    general_ophthalmologist: {
      showTodayActivity: true,
      showInstituteMetrics: false,
      widgets: [
        widget('clinic', "Today's Clinic", 'fa-stethoscope', { valueId: 'roleW_todayVisits', linkTab: 'flowTab' }),
        widget('urgent', 'Urgent Cases', 'fa-triangle-exclamation', { hint: 'Triage via Patient Flow.', linkTab: 'flowTab' }),
        widget('referrals', 'Referrals', 'fa-share', { hint: 'Opinion & referral tools in the visit form.', linkTab: 'formTab' }),
        widget('followup', 'Follow-up Due', 'fa-calendar-plus', { linkTab: 'appointmentsTab' })
      ],
      actions: [
        action('Patient Search', 'fa-magnifying-glass', 'switchTab', ['recordsTab'], { section: 'records' }),
        action('Clinical Notes', 'fa-notes-medical', 'switchTab', ['formTab'], { section: 'patient_form' }),
        action('Investigations', 'fa-images', 'switchTab', ['clinicalMediaTab'], { section: 'clinical_media' })
      ],
      panels: ['recent', 'appointments', 'safety', 'productivity']
    },
    cornea_fellow: {
      showTodayActivity: true,
      showInstituteMetrics: false,
      widgets: [
        widget('clinic_f', "Today's Clinic", 'fa-stethoscope', { valueId: 'roleW_todayVisits', linkTab: 'flowTab' }),
        widget('teaching', 'Teaching Cases', 'fa-chalkboard-user', { soon: true }),
        widget('interesting', 'Interesting Cases', 'fa-star', { linkTab: 'clinicalMediaTab' }),
        widget('pending_sx', 'Pending Surgery', 'fa-hospital', { soon: true }),
        widget('research_cases', 'Research Cases', 'fa-flask', { linkTab: 'researchTab' }),
        widget('learning', 'Learning Tasks', 'fa-book-open', { soon: true }),
        widget('videos', 'Recent Surgical Videos', 'fa-video', { linkTab: 'clinicalMediaTab' })
      ],
      actions: [
        action('Clinic Visit', 'fa-stethoscope', 'switchTab', ['formTab'], { section: 'patient_form' }),
        action('Clinical Media', 'fa-images', 'switchTab', ['clinicalMediaTab'], { section: 'clinical_media' }),
        action('Research', 'fa-chart-line', 'switchTab', ['researchTab'], { section: 'research_analytics' }),
        action('Keratoplasty', 'fa-hand-holding-medical', 'switchTab', ['keratoplastyTab'], { section: 'keratoplasty' })
      ],
      panels: ['recent', 'research', 'announcements', 'productivity']
    },
    cornea_consultant: {
      showTodayActivity: true,
      showInstituteMetrics: true,
      widgets: [
        widget('clinic_c', "Today's Clinic", 'fa-stethoscope', { valueId: 'roleW_todayVisits', linkTab: 'flowTab' }),
        widget('urgent_ref', 'Urgent Referrals', 'fa-truck-medical', { linkTab: 'flowTab' }),
        widget('sx_decisions', 'Pending Surgical Decisions', 'fa-scale-balanced', { soon: true }),
        widget('postop', 'Postoperative Reviews', 'fa-user-doctor', { linkTab: 'appointmentsTab' }),
        widget('ulcers', 'Corneal Ulcers', 'fa-virus', { linkTab: 'keratitisTab' }),
        widget('rejection', 'Graft Rejections', 'fa-heart-crack', { linkTab: 'keratoplastyTab' }),
        widget('emergency', 'Emergency Consultations', 'fa-bell', { linkTab: 'flowTab' })
      ],
      actions: [
        action('AI Surgical Advisor', 'fa-robot', 'navComingSoon', ['AI Surgical Advisor'], { soon: true }),
        action('Surgical Centre', 'fa-hospital', 'navComingSoon', ['Surgical Centre'], { soon: true }),
        action('Research Dashboard', 'fa-chart-line', 'switchTab', ['researchTab'], { section: 'research_analytics' }),
        action('Keratitis Centre', 'fa-virus', 'switchTab', ['keratitisTab'], { section: 'keratitis_ulcer' })
      ],
      panels: ['recent', 'surgical', 'research', 'safety', 'announcements']
    },
    refractive_surgeon: {
      showTodayActivity: true,
      showInstituteMetrics: false,
      widgets: [
        widget('lasik', "Today's LASIK", 'fa-bolt', { soon: true }),
        widget('smile', "Today's SMILE", 'fa-eye', { soon: true }),
        widget('prk', "Today's PRK", 'fa-sun', { soon: true }),
        widget('screening', 'Screening Queue', 'fa-list-ol', { soon: true }),
        widget('postop_r', 'Post-op Reviews', 'fa-calendar-check', { linkTab: 'appointmentsTab' })
      ],
      actions: [
        action('AI Refractive Planner', 'fa-wand-magic-sparkles', 'navComingSoon', ['AI Refractive Planner'], { soon: true }),
        action('Clinic Visit', 'fa-stethoscope', 'switchTab', ['formTab'], { section: 'patient_form' }),
        action('Appointments', 'fa-calendar-days', 'switchTab', ['appointmentsTab'], { section: 'appointments_recall' })
      ],
      panels: ['recent', 'surgical', 'announcements']
    },
    eye_bank_technician: {
      showTodayActivity: false,
      showInstituteMetrics: true,
      widgets: [
        widget('inventory', 'Donor Tissue Inventory', 'fa-boxes-stacked', { valueId: 'kpiTissueAvailable', linkTab: 'keratoplastyTab' }),
        widget('reserved', 'Reserved Tissue', 'fa-lock', { linkTab: 'keratoplastyTab' }),
        widget('requests', 'Pending Requests', 'fa-inbox', { linkTab: 'keratoplastyTab' }),
        widget('expired', 'Expired Tissue', 'fa-hourglass-end', { soon: true }),
        widget('transport', 'Transportation', 'fa-truck', { soon: true }),
        widget('specular_r', 'Specular Reports', 'fa-file-medical', { soon: true })
      ],
      actions: [
        action('Keratoplasty Centre', 'fa-hand-holding-medical', 'switchTab', ['keratoplastyTab'], { section: 'keratoplasty' }),
        action('Clinical Media', 'fa-images', 'switchTab', ['clinicalMediaTab'], { section: 'clinical_media' })
      ],
      panels: ['surgical', 'system']
    },
    research_coordinator: {
      showTodayActivity: false,
      showInstituteMetrics: true,
      widgets: [
        widget('registry_new', 'New Registry Entries', 'fa-file-circle-plus', { linkTab: 'researchTab' }),
        widget('incomplete', 'Incomplete Data', 'fa-triangle-exclamation', { linkTab: 'researchTab' }),
        widget('studies', 'Clinical Studies', 'fa-flask', { soon: true }),
        widget('outcomes', 'Outcome Reports', 'fa-chart-column', { linkTab: 'researchTab' }),
        widget('exports', 'Export Requests', 'fa-file-export', { linkTab: 'researchTab' }),
        widget('analytics', 'Analytics', 'fa-chart-pie', { soon: true })
      ],
      actions: [
        action('Export Registry', 'fa-file-export', 'switchTab', ['researchTab'], { section: 'research_analytics' }),
        action('Research Dashboard', 'fa-chart-line', 'switchTab', ['researchTab'], { section: 'research_analytics' }),
        action('Clinical Media', 'fa-images', 'switchTab', ['clinicalMediaTab'], { section: 'clinical_media' })
      ],
      panels: ['research', 'announcements', 'productivity']
    },
    administrator: {
      showTodayActivity: true,
      showInstituteMetrics: true,
      widgets: [
        widget('users', 'Users', 'fa-user-gear', { linkTab: 'databaseTab' }),
        widget('audit', 'Audit Logs', 'fa-clipboard-list', { linkTab: 'auditTrailTab' }),
        widget('health', 'System Health', 'fa-heart-pulse', { valueId: 'dashSysDb' }),
        widget('cloud', 'Cloud Status', 'fa-cloud', { valueId: 'dashSysCloud' }),
        widget('storage', 'Storage', 'fa-hard-drive', { soon: true }),
        widget('backups', 'Backups', 'fa-box-archive', { soon: true }),
        widget('perf', 'Performance', 'fa-gauge', { soon: true })
      ],
      actions: [
        action('Database', 'fa-database', 'switchTab', ['databaseTab'], { section: 'database' }),
        action('Audit Trail', 'fa-clipboard-list', 'switchTab', ['auditTrailTab'], { section: 'audit_trail' }),
        action('Export', 'fa-file-export', 'exportDatabase', [], { section: 'database' })
      ],
      panels: ['system', 'announcements', 'recent']
    },
    medical_director: {
      showTodayActivity: true,
      showInstituteMetrics: true,
      widgets: [
        widget('stats', "Today's Statistics", 'fa-chart-simple', { valueId: 'roleW_todayVisits' }),
        widget('volume', 'Patient Volume', 'fa-users', { valueId: 'statTotalPatients' }),
        widget('sx_vol', 'Surgical Volume', 'fa-hospital', { soon: true }),
        widget('ot_u', 'OT Utilisation', 'fa-chart-pie', { soon: true }),
        widget('outcomes', 'Visual Outcomes', 'fa-eye', { linkTab: 'researchTab' }),
        widget('complications', 'Complication Rates', 'fa-notes-medical', { soon: true }),
        widget('eb_status', 'Eye Bank Status', 'fa-hand-holding-heart', { valueId: 'kpiTissueAvailable', linkTab: 'keratoplastyTab' }),
        widget('research_act', 'Research Activity', 'fa-flask', { linkTab: 'researchTab' }),
        widget('finance', 'Financial Overview', 'fa-coins', { soon: true }),
        widget('kpis', 'Hospital KPIs', 'fa-building', { hint: 'See Institute Metrics below.' })
      ],
      actions: [
        action('Research Dashboard', 'fa-chart-line', 'switchTab', ['researchTab'], { section: 'research_analytics' }),
        action('Institute Records', 'fa-folder-open', 'switchTab', ['recordsTab'], { section: 'records' }),
        action('Audit Trail', 'fa-clipboard-list', 'switchTab', ['auditTrailTab'], { section: 'audit_trail' })
      ],
      panels: ['recent', 'surgical', 'research', 'system', 'announcements']
    }
  });

  function escapeHtml(str) {
    if (global.escapeHtml) return global.escapeHtml(str);
    const d = document.createElement('div');
    d.textContent = String(str == null ? '' : str);
    return d.innerHTML;
  }

  function getIdentity() {
    if (global.__corneaCloudMode && global.__corneaUser) {
      const u = global.__corneaUser;
      return {
        source: 'cloud',
        name: u.fullName || u.email || 'User',
        email: u.email || '',
        role: u.role || 'ophthalmologist',
        roleLabel: u.roleLabel || u.role || 'User',
        hospital: u.clinicName || u.clinicSlug || 'Cornea Clinic',
        sections: u.emrSections || null
      };
    }
    const offline = global.CorneaOfflineAuth?.getCurrentUser?.();
    if (offline) {
      return {
        source: 'offline',
        name: offline.fullName || offline.username || 'User',
        email: offline.username || '',
        role: offline.role || 'receptionist',
        roleLabel: offline.roleLabel || offline.role || 'User',
        hospital: 'Cornea Clinic (local)',
        sections: global.CorneaOfflineAuth?.ROLE_SECTIONS?.[offline.role] || null
      };
    }
    return {
      source: 'none',
      name: 'Guest',
      email: '',
      role: 'receptionist',
      roleLabel: 'Guest',
      hospital: 'Cornea Clinic',
      sections: null
    };
  }

  function resolveProfileKey(role) {
    const key = ROLE_ALIASES[String(role || '').toLowerCase()] || 'general_ophthalmologist';
    return PROFILES[key] ? key : 'general_ophthalmologist';
  }

  function readLayout(profileKey) {
    const all = (() => {
      try {
        return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
      } catch (_) {
        return {};
      }
    })();
    return all[profileKey] || { hidden: [] };
  }

  function writeLayout(profileKey, layout) {
    let all = {};
    try {
      all = JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}');
    } catch (_) { /* ignore */ }
    all[profileKey] = layout;
    try {
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(all));
    } catch (_) { /* ignore */ }
  }

  function sectionAllowed(section, sections) {
    if (!section || !sections) return true;
    return sections[section] !== false;
  }

  function renderHeader(identity, profileKey) {
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set('roleDashUserName', identity.name);
    set('roleDashUserRole', PROFILE_LABELS[profileKey] || identity.roleLabel);
    set('roleDashHospital', identity.hospital);
    updateClock();
    const cloud = global.__corneaCloudMode && global.CorneaApi?.isEnabled?.();
    set('roleDashCloud', cloud ? 'Cloud connected' : (global.navigator.onLine === false ? 'Offline' : 'Local / not signed in'));
    set('roleDashDb', global.db ? 'Database active' : 'Database unavailable');
  }

  function renderWidgets(profile, profileKey, identity) {
    const grid = document.getElementById('roleDashboardWidgets');
    if (!grid) return;
    const layout = readLayout(profileKey);
    const hidden = new Set(layout.hidden || []);

    grid.innerHTML = profile.widgets.map((w) => {
      if (hidden.has(w.id)) return '';
      const valueHtml = w.valueId
        ? `<div class="role-widget-value" data-role-value-src="${escapeHtml(w.valueId)}">—</div>`
        : `<div class="role-widget-value">${escapeHtml(w.defaultValue)}</div>`;
      const soon = w.soon ? '<span class="nav-soon-badge nav-soon-badge-inline">Soon</span>' : '';
      let actionAttr = '';
      if (w.linkTab) {
        actionAttr = ` data-csp-action="switchTab" data-csp-args='${JSON.stringify([w.linkTab])}'`;
      } else if (w.linkAction) {
        actionAttr = ` data-csp-action="${escapeHtml(w.linkAction)}" data-csp-args='${JSON.stringify(w.linkArgs)}'`;
      } else if (w.soon) {
        actionAttr = ` data-csp-action="navComingSoon" data-csp-args='${JSON.stringify([w.title])}'`;
      }
      return `<article class="role-widget card" data-role-widget="${escapeHtml(w.id)}">
        <div class="card-header">
          <div class="card-header-left">
            <div class="card-icon blue"><i class="fa-solid ${escapeHtml(w.icon)}" aria-hidden="true"></i></div>
            <span class="card-title">${escapeHtml(w.title)}</span>
          </div>
          ${soon}
          <button type="button" class="btn-secondary btn-sm role-widget-hide" data-csp-action="hideRoleWidget" data-csp-args='${JSON.stringify([w.id])}' title="Hide widget" aria-label="Hide ${escapeHtml(w.title)}">Hide</button>
        </div>
        <div class="card-body">
          ${valueHtml}
          ${w.hint ? `<p class="form-hint">${escapeHtml(w.hint)}</p>` : ''}
          ${actionAttr ? `<button type="button" class="btn-secondary btn-sm"${actionAttr}>Open</button>` : ''}
        </div>
      </article>`;
    }).join('');

    syncWidgetValues();
  }

  function syncWidgetValues() {
    document.querySelectorAll('[data-role-value-src]').forEach((el) => {
      const srcId = el.getAttribute('data-role-value-src');
      const src = srcId ? document.getElementById(srcId) : null;
      if (src && src.textContent != null) el.textContent = src.textContent;
    });
    const today = document.getElementById('statTodayVisits')?.textContent;
    const total = document.getElementById('statTotalPatients')?.textContent;
    const map = {
      roleW_todayVisits: today,
      roleW_registered: total,
      roleW_todaysAppts: '—'
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el && val != null) el.textContent = val;
      document.querySelectorAll(`[data-role-value-src="${id}"]`).forEach((node) => {
        if (val != null) node.textContent = val;
      });
    });
  }

  function renderActions(profile, identity) {
    const host = document.getElementById('roleQuickActions');
    if (!host) return;
    const sections = identity.sections;
    host.innerHTML = profile.actions
      .filter((a) => sectionAllowed(a.section, sections))
      .map((a) => {
        const soonClass = a.soon ? ' quick-action-soon' : '';
        const sectionAttr = a.section ? ` data-emr-section="${escapeHtml(a.section)}"` : '';
        return `<button type="button" class="quick-action-btn${soonClass}" data-csp-action="${escapeHtml(a.cspAction)}" data-csp-args='${JSON.stringify(a.args)}'${sectionAttr}>
          <i class="fa-solid ${escapeHtml(a.icon)}" aria-hidden="true"></i>${escapeHtml(a.label)}
        </button>`;
      }).join('');
  }

  function applyPanels(profile) {
    const want = new Set(profile.panels || []);
    document.querySelectorAll('[data-dash-panel]').forEach((el) => {
      const key = el.getAttribute('data-dash-panel');
      el.hidden = key ? !want.has(key) : false;
    });
  }

  function applyShell(profile) {
    const today = document.getElementById('dashTodaySection');
    const institute = document.getElementById('dashInstituteSection');
    const legacyActions = document.getElementById('dashLegacyActionsSection');
    if (today) today.hidden = !profile.showTodayActivity;
    if (institute) institute.hidden = !profile.showInstituteMetrics;
    if (legacyActions) legacyActions.hidden = true;
  }

  function hideRoleWidget(widgetId) {
    const identity = getIdentity();
    const profileKey = resolveProfileKey(identity.role);
    const layout = readLayout(profileKey);
    if (!layout.hidden.includes(widgetId)) layout.hidden.push(widgetId);
    writeLayout(profileKey, layout);
    render();
  }

  function resetRoleLayout() {
    const identity = getIdentity();
    const profileKey = resolveProfileKey(identity.role);
    writeLayout(profileKey, { hidden: [] });
    render();
  }

  function render() {
    const shell = document.getElementById('roleDashboardShell');
    if (!shell) return;
    const identity = getIdentity();
    const profileKey = resolveProfileKey(identity.role);
    const profile = PROFILES[profileKey];
    if (!profile) return;

    shell.hidden = false;
    renderHeader(identity, profileKey);
    applyShell(profile);
    renderWidgets(profile, profileKey, identity);
    renderActions(profile, identity);
    applyPanels(profile);

    const title = document.getElementById('roleDashProfileTitle');
    if (title) title.textContent = `${PROFILE_LABELS[profileKey] || 'Role'} dashboard`;
  }

  function onDashboardRefresh() {
    render();
    syncWidgetValues();
    updateClock();
  }

  function updateClock() {
    const el = document.getElementById('roleDashDate');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function runQuickSearch() {
    const input = document.getElementById('roleDashSearch');
    const q = (input?.value || '').trim();
    if (typeof global.switchTab === 'function') {
      global.switchTab('recordsTab');
    }
    if (!q) return;
    const searchEl = document.getElementById('searchInput')
      || document.getElementById('recordSearch')
      || document.querySelector('#recordsTab input[type="search"], #recordsTab input[type="text"]');
    if (searchEl) {
      searchEl.value = q;
      searchEl.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof global.filterRecords === 'function') global.filterRecords();
    }
  }

  function wireSearch() {
    const input = document.getElementById('roleDashSearch');
    if (!input || input.dataset.roleDashWired === '1') return;
    input.dataset.roleDashWired = '1';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runQuickSearch();
      }
    });
  }

  function init() {
    wireSearch();
    render();
    updateClock();
    if (!global.__roleDashClock) {
      global.__roleDashClock = setInterval(updateClock, 30000);
    }
  }

  global.CorneaRoleDashboard = {
    PROFILES,
    ROLE_ALIASES,
    PROFILE_LABELS,
    getIdentity,
    resolveProfileKey,
    render,
    onDashboardRefresh,
    hideRoleWidget,
    resetRoleLayout,
    syncWidgetValues,
    runQuickSearch,
    init
  };

  global.hideRoleWidget = hideRoleWidget;
  global.resetRoleLayout = resetRoleLayout;
  global.runRoleDashSearch = runQuickSearch;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);

/* deploy-marker: role-dashboard */

