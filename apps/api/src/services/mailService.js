import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../core/logger.js';

/** @type {import('nodemailer').Transporter | null} */
let transporter = null;

function getTransporter() {
  if (!env.smtp.enabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user
        ? { user: env.smtp.user, pass: env.smtp.pass }
        : undefined
    });
  }
  return transporter;
}

/**
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.text
 * @param {string} [params.html]
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
export async function sendMail({ to, subject, text, html }) {
  const transport = getTransporter();
  if (!transport) {
    return { sent: false, reason: 'smtp_disabled' };
  }

  try {
    await transport.sendMail({
      from: env.smtp.from,
      to,
      subject,
      text,
      html: html || text
    });
    return { sent: true };
  } catch (err) {
    logger.error({ err, to }, 'Failed to send email');
    return { sent: false, reason: err.message };
  }
}

/**
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.resetUrl
 */
export async function sendPasswordResetEmail({ to, resetUrl }) {
  const subject = 'Cornea Clinic — reset your password';
  const text = [
    'You requested a password reset for your Cornea Clinic account.',
    '',
    `Open this link to choose a new password (expires in 1 hour):`,
    resetUrl,
    '',
    'If you did not request this, you can ignore this email.'
  ].join('\n');

  const html = `
    <p>You requested a password reset for your Cornea Clinic account.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>This link expires in one hour. If you did not request this, ignore this email.</p>
  `;

  return sendMail({ to, subject, text, html });
}

/** Reset cached transporter (tests). */
export function resetMailTransport() {
  transporter = null;
}
