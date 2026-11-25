#!/usr/bin/env node
/**
 * Builds the Supabase Auth email templates (sign-up confirmation, password reset, …) from the
 * app's email layout (src/lib/email/layout.ts), so onboarding emails match every other Justicia
 * email. Output: supabase/templates/*.html. Paste each into Supabase Dashboard → Authentication →
 * Email Templates (see supabase/README.md). Run: npm run email:templates
 *
 * The {{ .ConfirmationURL }}-style placeholders are Supabase's own template variables; Supabase
 * fills them in when it sends the email, so verification and reset links work exactly as before.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const layout = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(path.join(root, 'src/lib/email/layout.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: layout }
);

const templates = [
  {
    file: 'confirm-signup.html',
    subject: 'Confirm your Justicia account',
    content: {
      preheader: 'One click to activate your Justicia account.',
      heading: 'Confirm your email address',
      paragraphs: [
        'Welcome to Justicia! Please confirm that **{{ .Email }}** is your email address to activate your account.',
      ],
      steps: [
        'Click **Verify Email Address** below.',
        'Sign in to Justicia with your email and password.',
        'Clients can book a verified lawyer or ask the AI legal assistant. Lawyers can finish their application for review.',
      ],
      action: { label: 'Verify Email Address', url: '{{ .ConfirmationURL }}' },
      footerNote: "If you didn't create a Justicia account, you can safely ignore this email.",
    },
  },
  {
    file: 'reset-password.html',
    subject: 'Reset your Justicia password',
    content: {
      preheader: 'Use this link to set a new password for your Justicia account.',
      heading: 'Reset your password',
      paragraphs: ['We received a request to reset the password for your Justicia account.'],
      action: { label: 'Set a New Password', url: '{{ .ConfirmationURL }}' },
      closing: [
        'For your security, this link works once and expires in **1 hour**. Setting a new password also signs you out on your other devices.',
      ],
      footerNote: "If you didn't ask to reset your password, you can ignore this email. Your password won't change.",
    },
  },
  {
    file: 'magic-link.html',
    subject: 'Your Justicia sign-in link',
    content: {
      preheader: 'Your one-time link to sign in to Justicia.',
      heading: 'Sign in to Justicia',
      paragraphs: ['Click the button below to sign in. The link works once and expires soon.'],
      action: { label: 'Sign In', url: '{{ .ConfirmationURL }}' },
      footerNote: "If you didn't try to sign in, you can ignore this email.",
    },
  },
  {
    file: 'change-email.html',
    subject: 'Confirm your new Justicia email',
    content: {
      preheader: 'Confirm the new email address for your Justicia account.',
      heading: 'Confirm your new email',
      paragraphs: ['You asked to change your Justicia sign-in email from **{{ .Email }}** to **{{ .NewEmail }}**.'],
      action: { label: 'Confirm New Email', url: '{{ .ConfirmationURL }}' },
      footerNote: "If you didn't ask for this change, sign in and change your password right away.",
    },
  },
  {
    file: 'invite.html',
    subject: "You're invited to Justicia",
    content: {
      preheader: 'Accept your invitation to Justicia.',
      heading: "You've been invited to Justicia",
      paragraphs: ['An account has been created for you on Justicia. Accept the invitation to set your password and sign in.'],
      action: { label: 'Accept Invitation', url: '{{ .ConfirmationURL }}' },
      footerNote: "If you weren't expecting this invitation, you can ignore this email.",
    },
  },
];

const outDir = path.join(root, 'supabase', 'templates');
fs.mkdirSync(outDir, { recursive: true });
for (const t of templates) {
  const html = layout.renderEmailHtml(t.content);
  fs.writeFileSync(path.join(outDir, t.file), `<!-- Subject: ${t.subject} -->\n${html}\n`);
  console.log(`wrote supabase/templates/${t.file}  (subject: ${t.subject})`);
}
