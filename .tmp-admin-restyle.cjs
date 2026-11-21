const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const files = [
  ...fs.readdirSync('src/components/admin/views').map(f => `src/components/admin/views/${f}`),
  'src/components/admin/AdminFeatureStatus.tsx',
  'src/components/admin/AdminLawyerReviewPanel.tsx',
  'src/components/admin/LawyerDirectoryTable.tsx',
  'src/components/admin/LawyerVerificationQueue.tsx',
  'src/app/admin/lawyers/[lawyerId]/page.tsx',
  'src/app/admin/error.tsx',
].filter(f => f.endsWith('.tsx') && !f.endsWith('AdminDashboardView.tsx'));

for (const file of files) {
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace(/const cardClass = '[^']+';/g, match => `const cardClass = 'admin-card${match.includes('p-6') ? ' p-6' : ''}';`);
  source = source.replace(/\s+style=\{\{ boxShadow: '[^']+' \}\}/g, '');
  source = source.replaceAll('font-cormorant', 'font-lora').replaceAll('text-[#7D6855]', 'text-[#705744]').replaceAll('text-[#A69584]', 'text-[#806955]');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'className' && node.initializer) {
      const raw = node.initializer.getText(ast);
      const tag = node.parent.parent.tagName?.getText(ast);
      const text = raw.slice(raw.startsWith('{`') ? 2 : 1);
      let classes = [];
      if (text.includes('max-w-7xl') && text.includes('mx-auto') || text.includes('max-w-5xl') && text.includes('mx-auto') || file.endsWith('error.tsx') && text.includes('max-w-3xl')) {
        edits.push({ start: node.initializer.getStart(ast), end: node.initializer.end, value: '"admin-page"' });
        return;
      }
      if (['input', 'select', 'textarea'].includes(tag) && !text.includes('sr-only')) classes.push('admin-field');
      else if (tag === 'table') classes.push('admin-table');
      else if (text.includes('overflow-x-auto') && !text.includes('flex')) classes.push('admin-table-scroll');
      else if (tag === 'button' || tag === 'Link' && text.includes('rounded') && !text.includes('tracking-[0.')) {
        if (text.includes('cardClass') || text.includes('cursor-pointer p-4')) classes.push('admin-filter');
        else {
          classes.push('admin-button');
          if (text.includes('bg-[#C58B3C]')) classes.push('admin-button-primary');
          else if (text.includes('bg-[#23150F]') || text.includes('bg-[#34150F]')) classes.push('admin-button-dark');
        }
      } else if (tag === 'label' && text.includes('cursor-pointer')) classes.push('admin-decision');
      else if (text.includes('rounded-3xl') && text.includes('bg-[#EFE5D8]')) classes.push('admin-card');
      else if (text.includes('rounded') && (text.includes('bg-[#F5EDE2]') || text.includes('bg-[#FAF6F0]'))) classes.push('admin-inset');
      else if (text.includes('rounded') && (text.includes('bg-[#E5D7C5]') || text.includes('bg-[#E8DCCB]') || text.includes('bg-[#C58B3C]/10'))) classes.push('admin-plate');
      if (tag === 'span' && text.includes('rounded-full') && text.includes('font-semibold')) {
        const tone = text.includes('emerald') ? 'success' : text.includes('amber') ? 'warning' : text.includes('rose') ? 'danger' : text.includes('indigo') ? 'info' : 'neutral';
        classes.push('admin-status', `admin-status-${tone}`);
      }
      if (classes.length && (raw.startsWith('"') || raw.startsWith('{`'))) {
        const offset = raw.startsWith('{`') ? 2 : 1;
        edits.push({ start: node.initializer.getStart(ast) + offset, end: node.initializer.getStart(ast) + offset, value: classes.join(' ') + ' ' });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  fs.writeFileSync(file, source);
  console.log(path.basename(file) + ': ' + edits.length + ' material bindings');
}

const shellPath = 'src/components/admin/AdminShell.tsx';
let shell = fs.readFileSync(shellPath, 'utf8');
shell = shell.replace(/navClass\((?:settingsActive|false)\)/g, 'navClass()');
shell = shell.replace('className="flex h-dvh flex-col bg-[#EFE5D8] text-[#34150F] selection:bg-[#C58B3C]/30"', 'className="admin-portal flex h-dvh flex-col"');
shell = shell.replace('<header className="z-40', '<a href="#admin-main-content" className="admin-skip-link">Skip to content</a>\n    <header className="admin-header z-40');
shell = shell.replace('className="hidden w-64 shrink-0 flex-col justify-between overflow-y-auto border-r border-[#D1BEA8] bg-[#DECEB8] p-5 md:flex"', 'className="admin-sidebar hidden shrink-0 flex-col justify-between overflow-y-auto md:flex"');
shell = shell.replace('<nav aria-label="Main navigation" className="space-y-2">{links()}</nav>', '<div><p className="admin-sidebar-label">Administration</p><nav aria-label="Main navigation" className="space-y-3">{links()}</nav></div>');
shell = shell.replaceAll('space-y-2 border-t border-[#C8B59E] pt-4', 'admin-sidebar-footer space-y-2');
shell = shell.replace('className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-[#493226] bg-[#2A1810] p-2 text-xs shadow-xl"', 'className="admin-account-menu absolute right-0 top-full z-50 mt-3 w-60 max-w-[calc(100vw-32px)] p-3 text-xs"');
shell = shell.replaceAll('hover:bg-[#3E271D]', 'hover:bg-[#DCC9B5]').replaceAll('border-[#493226]', 'border-[#CBB6A1]');
const start = shell.indexOf('      {mobileOpen && <div');
const end = shell.indexOf('      <main', start);
const mobile = `      <AdminDialog open={mobileOpen} onClose={() => setMobileOpen(false)} labelledBy="admin-navigation-title" variant="navigation">
        <div>
          <div className="mb-6 flex items-center justify-between gap-2 px-2"><h2 id="admin-navigation-title" className="text-base">Administration</h2><button type="button" aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="admin-button admin-icon-button">×</button></div>
          <nav aria-label="Mobile navigation" className="space-y-3">{links(true)}</nav>
        </div>
        <div className="admin-sidebar-footer space-y-2"><Link href="/admin/settings" onClick={() => setMobileOpen(false)} aria-current={settingsActive ? 'page' : undefined} className={navClass()}><GearIcon className="h-5 w-5" />Settings</Link><form action={signOutAction}><button type="submit" className={navClass()}><LogoutIcon className="h-5 w-5" />Sign out</button></form></div>
      </AdminDialog>
`;
if (start < 0 || end < 0) throw new Error('Mobile shell boundaries missing');
shell = shell.slice(0, start) + mobile + shell.slice(end);
shell = shell.replace('aria-controls="admin-mobile-navigation"', 'aria-haspopup="dialog"');
shell = shell.replace('id="admin-main-content" className="min-w-0 flex-1 overflow-y-auto bg-[#EFE5D8]"', 'id="admin-main-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto"').replace('className="client-view-enter"', 'className="admin-view-enter"');
fs.writeFileSync(shellPath, shell);
