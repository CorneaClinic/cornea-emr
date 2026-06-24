/**

 * Production RBAC roles and permission matrix.

 * Permissions are enforced server-side; UI hiding is not sufficient.

 */



export const ROLES = Object.freeze([

  'admin',

  'cornea_consultant',

  'ophthalmologist',

  'doctor_in_training',

  'optometrist',

  'technician',

  'receptionist'

]);



/** @typedef {typeof ROLES[number]} Role */



export const PERMISSIONS = Object.freeze({

  AUTH_READ_PROFILE: 'auth:read_profile',

  USERS_MANAGE: 'users:manage',

  PATIENTS_READ: 'patients:read',

  PATIENTS_WRITE: 'patients:write',

  VISITS_READ: 'visits:read',

  VISITS_WRITE: 'visits:write',

  VISITS_FINALIZE: 'visits:finalize',

  VISITS_DELETE: 'visits:delete',

  REFRACTION_WRITE: 'refraction:write',

  VITALS_WRITE: 'vitals:write',

  KP_READ: 'kp:read',

  KP_WRITE: 'kp:write',

  KP_RESERVE: 'kp:reserve',

  KC_READ: 'kc:read',

  KC_WRITE: 'kc:write',

  KERATITIS_READ: 'keratitis:read',

  KERATITIS_WRITE: 'keratitis:write',

  RESEARCH_READ: 'research:read',

  RESEARCH_EXPORT: 'research:export',

  MEDIA_READ: 'media:read',

  MEDIA_WRITE: 'media:write',

  ICD_MANAGE: 'icd:manage',

  EXPORT_MANAGE: 'export:manage',

  AUDIT_READ: 'audit:read',

  CLINIC_SETTINGS: 'clinic:settings'

});



/** Full clinical access (ophthalmologist / cornea consultant). */

const CLINICAL_SENIOR = Object.freeze([

  PERMISSIONS.AUTH_READ_PROFILE,

  PERMISSIONS.PATIENTS_READ,

  PERMISSIONS.PATIENTS_WRITE,

  PERMISSIONS.VISITS_READ,

  PERMISSIONS.VISITS_WRITE,

  PERMISSIONS.VISITS_FINALIZE,

  PERMISSIONS.VISITS_DELETE,

  PERMISSIONS.REFRACTION_WRITE,

  PERMISSIONS.VITALS_WRITE,

  PERMISSIONS.KP_READ,

  PERMISSIONS.KP_WRITE,

  PERMISSIONS.KP_RESERVE,

  PERMISSIONS.KC_READ,

  PERMISSIONS.KC_WRITE,

  PERMISSIONS.KERATITIS_READ,

  PERMISSIONS.KERATITIS_WRITE,

  PERMISSIONS.RESEARCH_READ,

  PERMISSIONS.RESEARCH_EXPORT,

  PERMISSIONS.MEDIA_READ,

  PERMISSIONS.MEDIA_WRITE,

  PERMISSIONS.AUDIT_READ

]);



/** Assists ophthalmologist — same as senior clinical except visit delete. */

const CLINICAL_TRAINEE = Object.freeze(

  CLINICAL_SENIOR.filter((p) => p !== PERMISSIONS.VISITS_DELETE)

);



/** @type {Record<Role, readonly string[]>} */

export const ROLE_PERMISSIONS = Object.freeze({

  admin: Object.values(PERMISSIONS),



  cornea_consultant: CLINICAL_SENIOR,

  ophthalmologist: CLINICAL_SENIOR,

  doctor_in_training: CLINICAL_TRAINEE,



  optometrist: [

    PERMISSIONS.AUTH_READ_PROFILE,

    PERMISSIONS.PATIENTS_READ,

    PERMISSIONS.VISITS_READ,

    PERMISSIONS.VISITS_WRITE,

    PERMISSIONS.REFRACTION_WRITE,

    PERMISSIONS.MEDIA_READ,

    PERMISSIONS.MEDIA_WRITE,

    PERMISSIONS.AUDIT_READ

  ],



  technician: [

    PERMISSIONS.AUTH_READ_PROFILE,

    PERMISSIONS.PATIENTS_READ,

    PERMISSIONS.VISITS_READ,

    PERMISSIONS.VISITS_WRITE,

    PERMISSIONS.VITALS_WRITE,

    PERMISSIONS.MEDIA_READ,

    PERMISSIONS.MEDIA_WRITE,

    PERMISSIONS.AUDIT_READ

  ],



  receptionist: [

    PERMISSIONS.AUTH_READ_PROFILE,

    PERMISSIONS.PATIENTS_READ,

    PERMISSIONS.PATIENTS_WRITE,

    PERMISSIONS.VISITS_READ,

    PERMISSIONS.AUDIT_READ

  ]

});



/** Human-readable role labels for API responses. */

export const ROLE_LABELS = Object.freeze({

  admin: 'Administrator',

  cornea_consultant: 'Cornea Consultant',

  ophthalmologist: 'Ophthalmologist',

  doctor_in_training: 'General Doctor in Training',

  optometrist: 'Optometrist',

  technician: 'Nurse / Technician',

  receptionist: 'Receptionist'

});



/**

 * @param {string | undefined | null} role

 * @returns {role is Role}

 */

export function isValidRole(role) {

  return ROLES.includes(/** @type {Role} */ (role));

}



/**

 * @param {string | undefined | null} role

 * @param {string} permission

 */

export function roleHasPermission(role, permission) {

  if (!isValidRole(role)) return false;

  return ROLE_PERMISSIONS[role].includes(permission);

}



/**

 * @param {string | undefined | null} role

 * @param {...string} permissions

 */

export function roleHasAnyPermission(role, ...permissions) {

  return permissions.some((p) => roleHasPermission(role, p));

}



/**

 * @param {string | undefined | null} role

 * @param {...Role} allowedRoles

 */

export function roleMatches(role, ...allowedRoles) {

  return isValidRole(role) && allowedRoles.includes(role);

}


