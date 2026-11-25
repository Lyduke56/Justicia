/**
 * The Justicia email layout, shared by every email the app sends (and by the Supabase Auth
 * templates generated with `npm run email:templates`).
 *
 * Built for email clients, not browsers: nested tables, inline styles, a "bulletproof" button
 * (a coloured table cell, so it still shows when images are blocked), a hidden preheader, and a
 * 600px column that shrinks to the screen on phones. Text is escaped; `**bold**` is the only
 * formatting allowed in paragraphs. Every email also gets a plain-text version.
 */

export type EmailTone = 'info' | 'success' | 'warning' | 'error';

export interface EmailContent {
  /** Inbox preview text (hidden in the email body). */
  preheader: string;
  heading: string;
  /** e.g. "Dear Juan," */
  greeting?: string;
  paragraphs: string[];
  /** A highlighted box (reason for a decision, a reviewer's message, …). */
  callout?: { tone: EmailTone; title: string; body: string };
  /** Numbered next steps. */
  steps?: string[];
  /** The main action. `url` may be a template variable such as {{ .ConfirmationURL }}. */
  action?: { label: string; url: string };
  /** Paragraphs after the button. */
  closing?: string[];
  /** Small print above the footer (why they got this email, what to do if it wasn't them). */
  footerNote?: string;
}

const COLORS = {
  page: '#E5D8CB',
  card: '#F7EFE5',
  rim: '#E2D1BE',
  espresso: '#34150F',
  ink: '#4A3426',
  muted: '#8C7A6A',
  caramel: '#C58B3C',
  buttonText: '#F7EFE5',
};

const TONES: Record<EmailTone, { border: string; background: string; title: string }> = {
  info: { border: '#C58B3C', background: '#FBF3E6', title: '#7A4E14' },
  success: { border: '#1F7A3A', background: '#EEF6EE', title: '#174D2A' },
  warning: { border: '#B7791F', background: '#FDF5E7', title: '#6B4513' },
  error: { border: '#B42318', background: '#FCEFEC', title: '#7A1A12' },
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Segoe UI', Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes, then turns **bold** into <strong> and line breaks into <br>. */
function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, `<strong style="color:${COLORS.espresso};font-weight:700;">$1</strong>`)
    .replace(/\n/g, '<br />');
}

/** URLs are escaped for the attribute but template variables ({{ … }}) pass through untouched. */
function attr(url: string): string {
  return escapeHtml(url);
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.65;color:${COLORS.ink};">${inline(text)}</p>`;
}

function callout(c: NonNullable<EmailContent['callout']>): string {
  const tone = TONES[c.tone];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;border-collapse:separate;">
  <tr>
    <td style="background:${tone.background};border-left:4px solid ${tone.border};border-radius:10px;padding:16px 18px;">
      <p style="margin:0 0 6px;font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${tone.title};">${escapeHtml(c.title)}</p>
      <p style="margin:0;font-family:${SANS};font-size:15px;line-height:1.6;color:${COLORS.ink};">${inline(c.body)}</p>
    </td>
  </tr>
</table>`;
}

function steps(items: string[]): string {
  const rows = items
    .map(
      (item, i) => `<tr>
    <td width="34" valign="top" style="padding:0 0 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="24" height="24" align="center" valign="middle" style="width:24px;height:24px;border-radius:12px;background:${COLORS.caramel};font-family:${SERIF};font-size:12px;font-weight:700;color:#FFFFFF;">${i + 1}</td>
      </tr></table>
    </td>
    <td valign="top" style="padding:2px 0 12px;font-family:${SANS};font-size:15px;line-height:1.5;color:${COLORS.ink};">${inline(item)}</td>
  </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px;">${rows}</table>`;
}

function button(action: NonNullable<EmailContent['action']>): string {
  const href = attr(action.url);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;">
  <tr>
    <td align="center" bgcolor="${COLORS.espresso}" style="border-radius:12px;background:${COLORS.espresso};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${SANS};font-size:14px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.buttonText};text-decoration:none;border-radius:12px;">${escapeHtml(action.label)}</a>
    </td>
  </tr>
</table>
<p style="margin:0 0 20px;font-family:${SANS};font-size:12.5px;line-height:1.55;color:${COLORS.muted};">Button not working? Copy this link into your browser:<br /><a href="${href}" target="_blank" style="color:#946525;word-break:break-all;">${href}</a></p>`;
}

export function renderEmailHtml(content: EmailContent): string {
  const body = [
    content.greeting ? paragraph(content.greeting) : '',
    ...content.paragraphs.map(paragraph),
    content.callout ? callout(content.callout) : '',
    content.steps?.length ? steps(content.steps) : '',
    content.action ? button(content.action) : '',
    ...(content.closing ?? []).map(paragraph),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(content.heading)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .j-shell { padding: 16px 10px !important; }
    .j-body { padding: 28px 22px !important; }
    .j-heading { font-size: 22px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(content.preheader)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">
  <tr>
    <td class="j-shell" align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;border-collapse:separate;">
        <tr>
          <td align="center" style="padding:0 0 18px;font-family:${SERIF};font-size:22px;letter-spacing:0.32em;color:${COLORS.espresso};">JUSTICIA</td>
        </tr>
        <tr>
          <td style="background:${COLORS.card};border:1px solid ${COLORS.rim};border-radius:18px;overflow:hidden;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td height="6" style="height:6px;line-height:6px;font-size:0;background:${COLORS.caramel};border-radius:18px 18px 0 0;">&nbsp;</td></tr>
              <tr>
                <td class="j-body" style="padding:36px 40px 28px;">
                  <h1 class="j-heading" style="margin:0 0 20px;font-family:${SERIF};font-size:25px;line-height:1.3;font-weight:700;color:${COLORS.espresso};">${escapeHtml(content.heading)}</h1>
                  ${body}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:22px 24px 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${COLORS.muted};">
            ${content.footerNote ? `${inline(content.footerNote)}<br /><br />` : ''}<span style="font-family:${SERIF};color:${COLORS.espresso};">Justicia</span> &middot; AI-Powered Philippine Legal Assistance
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Plain-text version of the same email. */
export function renderEmailText(content: EmailContent): string {
  const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1');
  return [
    content.heading,
    content.greeting,
    ...content.paragraphs,
    content.callout ? `${content.callout.title}:\n${content.callout.body}` : '',
    ...(content.steps ?? []).map((s, i) => `${i + 1}. ${s}`),
    content.action ? `${content.action.label}: ${content.action.url}` : '',
    ...(content.closing ?? []),
    content.footerNote,
    'Justicia · AI-Powered Philippine Legal Assistance',
  ]
    .filter(Boolean)
    .map((s) => plain(s as string))
    .join('\n\n');
}
