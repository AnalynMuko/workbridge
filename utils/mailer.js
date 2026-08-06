const createTransporter = async () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    console.warn('SMTP not configured. Mailer will be a noop. Set SMTP_HOST/PORT/USER/PASS to enable.');
    return null;
  }

  // try to import nodemailer only when needed; handle missing module gracefully
  try {
    const nodemailer = await import('nodemailer');
    return nodemailer.createTransport({ host, port, auth: { user, pass }, secure: port === 465 });
  } catch (err) {
    console.warn('nodemailer module not installed — mailer disabled. Run `npm install nodemailer` to enable.');
    return null;
  }
};

let cachedTransporter = null;

export async function sendMail({ to, subject, text, html }) {
  try {
    if (!cachedTransporter) cachedTransporter = await createTransporter();
  } catch (e) {
    console.error('error creating transporter', e);
    cachedTransporter = null;
  }

  if (!cachedTransporter) {
    console.warn('Attempted to send mail but transporter is not configured.');
    return false;
  }

  try {
    await cachedTransporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
    return true;
  } catch (err) {
    console.error('Mailer error:', err);
    return false;
  }
}
