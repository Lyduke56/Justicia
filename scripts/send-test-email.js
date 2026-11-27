#!/usr/bin/env node
/**
 * email:test: sends one sample notification email through Gmail SMTP, to check GMAIL_USER and
 * GMAIL_APP_PASSWORD in .env.local. Uses the app's real email layout and content.
 * Run: npm run email:test -- you@example.com
 * Never prints the password.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const nodemailer = require('nodemailer');
const { loadEnv } = require('./lib/env.cjs');

loadEnv();
const to = process.argv[2];
if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  console.error('Usage: npm run email:test -- you@example.com');
  process.exit(1);
}
const user = process.env.GMAIL_USER?.trim();
const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '');
if (!user || !pass) {
  console.error('❌ Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local first.');
  process.exit(1);
}

const root = path.join(__dirname, '..');
function load(file, modules = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, { exports, require: (name) => modules[name] });
  return exports;
}
const layout = load('src/lib/email/layout.ts');
const preferences = load('src/lib/account/preferences.ts');
const attorney = load('src/lib/utils/attorneyName.ts');
const emails = load('src/lib/email/notificationEmails.ts', {
  '@/lib/account/preferences': preferences,
  '@/lib/utils/attorneyName': attorney,
});

// The same cleaned-up address the app puts in email buttons (src/lib/siteUrl.ts).
const siteUrl = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/siteUrl.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: siteUrl, process: { env: process.env }, URL }
);
const site = siteUrl.publicSiteUrl();
const sample = emails.buildNotificationEmail({
  type: 'meeting_starting',
  title: 'Consultation starting soon',
  body: 'Your video consultation with Atty. Maria Santos starts in 15 minutes (9:00 AM - 10:00 AM). Open Messages to join the meeting.',
  payload: {},
  role: 'client',
  recipientName: 'Justicia tester',
  appUrl: site,
});

const name = (process.env.EMAIL_FROM_NAME || 'Justicia').replace(/["\r\n]/g, '');
nodemailer
  .createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } })
  .sendMail({
    from: `"${name}" <${user}>`,
    to,
    subject: `[Test] ${sample.subject}`,
    html: layout.renderEmailHtml(sample.content),
    text: layout.renderEmailText(sample.content),
  })
  .then((info) => console.log(`✅ Sent from ${user} to ${to} (${info.messageId}). Check the inbox and the spam folder.`))
  .catch((err) => {
    console.error(`❌ Gmail refused: ${err.message}`);
    if (/535|Username and Password not accepted|BadCredentials/i.test(err.message)) {
      console.error('   Use an App Password (https://myaccount.google.com/apppasswords), not the normal Gmail password.');
    }
    process.exit(1);
  });
