import ldap from 'ldapjs';
import { env } from '../config/env.js';
import { buildLdapSearchFilter, isLdapConfigured } from './ssoConfig.js';
import { UnauthorizedError } from '../core/errors.js';

/**
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ dn: string, email: string, fullName: string }>}
 */
export function authenticateLdapUser(email, password) {
  if (!isLdapConfigured()) {
    throw new Error('LDAP SSO is not configured');
  }
  if (!email?.trim() || !password) {
    throw new UnauthorizedError('Email and password are required');
  }

  const client = ldap.createClient({
    url: env.sso.ldapUrl,
    tlsOptions: { rejectUnauthorized: env.sso.ldapTlsRejectUnauthorized }
  });

  return new Promise((resolve, reject) => {
    client.on('error', (err) => reject(err));

    client.bind(env.sso.ldapBindDn, env.sso.ldapBindPassword, (bindErr) => {
      if (bindErr) {
        client.destroy();
        reject(new UnauthorizedError('LDAP authentication service unavailable'));
        return;
      }

      const filter = buildLdapSearchFilter(env.sso.ldapSearchFilter, email);
      client.search(
        env.sso.ldapSearchBase,
        { scope: 'sub', filter, attributes: ['dn', 'mail', 'cn', 'displayName', 'uid'] },
        (searchErr, res) => {
          if (searchErr) {
            client.destroy();
            reject(searchErr);
            return;
          }

          /** @type {ldap.SearchEntry | null} */
          let entry = null;

          res.on('searchEntry', (e) => {
            if (!entry) entry = e;
          });

          res.on('error', (err) => {
            client.destroy();
            reject(err);
          });

          res.on('end', () => {
            if (!entry) {
              client.destroy();
              reject(new UnauthorizedError('Invalid email or password'));
              return;
            }

            const userDn = entry.objectName || entry.dn?.toString();
            const attrs = entry.pojo?.attributes || [];
            const attrMap = Object.fromEntries(
              attrs.map((a) => [a.type, Array.isArray(a.values) ? a.values[0] : a.values])
            );
            const resolvedEmail = String(attrMap.mail || email).trim().toLowerCase();
            const fullName = String(attrMap.displayName || attrMap.cn || resolvedEmail).trim();

            const userClient = ldap.createClient({
              url: env.sso.ldapUrl,
              tlsOptions: { rejectUnauthorized: env.sso.ldapTlsRejectUnauthorized }
            });

            userClient.bind(userDn, password, (userBindErr) => {
              userClient.destroy();
              client.destroy();
              if (userBindErr) {
                reject(new UnauthorizedError('Invalid email or password'));
                return;
              }
              resolve({ dn: userDn, email: resolvedEmail, fullName });
            });
          });
        }
      );
    });
  });
}
