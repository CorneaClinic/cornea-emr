/**
 * Test SMTP configuration from apps/api/.env
 * Usage: node scripts/test-smtp.js recipient@example.com
 */
import 'dotenv/config';
import nodemailer from 'nodemailer';

const to = process.argv[2];
if (!to) {
  console.error('Usage: node scripts/test-smtp.js <recipient-email>');
  process.exit(1);
}

const host = process.env.SMTP_HOST;
const from = process.env.SMTP_FROM;
if (!host || !from) {
  console.error('Set SMTP_HOST and SMTP_FROM in .env first.');
  process.exit(1);
}

const port = Number(process.env.SMTP_PORT || 587);
const secure = process.env.SMTP_SECURE === 'true';

const transport = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined
});

try {
  await transport.verify();
  console.log('SMTP connection OK');
  const info = await transport.sendMail({
    from,
    to,
    subject: 'Cornea Clinic — SMTP test',
    text: 'If you received this, SMTP is configured correctly.'
  });
  console.log('Test email sent:', info.messageId);
} catch (err) {
  console.error('SMTP test failed:', err.message);
  process.exit(1);
}
