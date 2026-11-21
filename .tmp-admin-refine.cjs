const fs = require('node:fs');
function edit(file, change) { const before = fs.readFileSync(file, 'utf8'); const after = change(before); if (before === after) throw new Error('No change: ' + file); fs.writeFileSync(file, after); }
function dialogImport(s) { return s.replace("import Link from 'next/link';", "import Link from 'next/link';\nimport { AdminDialog } from '@/components/admin/AdminDialog';"); }

edit('src/components/admin/views/AdminUsersView.tsx', s => {
  s = dialogImport(s);
  s = s.replace(/\{selected && <div className="fixed[^\n]+?<div className="flex items-start/, '{selected && <AdminDialog open onClose={() => setSelectedId(null)} labelledBy="admin-account-title" variant="drawer"><div className="flex items-start');
  s = s.replace('</aside></div>}', '</AdminDialog>}');
  s = s.replace('grid gap-4 sm:grid-cols-4', 'grid grid-cols-2 gap-5 xl:grid-cols-4');
  s = s.replace('className="mt-2 block font-lora text-3xl font-bold"', 'className="admin-plate admin-filter-count px-4 py-3"');
  return s;
});
edit('src/components/admin/views/AdminSecurityAuditView.tsx', s => {
  s = dialogImport(s);
  s = s.replace(/\{selected && <div className="fixed[^\n]+?<div className="flex items-start/, '{selected && <AdminDialog open onClose={() => setSelected(null)} labelledBy="audit-details-title"><div className="flex items-start');
  s = s.replace('</pre></div></div>}', '</pre></AdminDialog>}');
  s = s.replace('className="flex gap-2"', 'className="flex flex-wrap gap-3"');
  return s;
});
edit('src/components/admin/LawyerDirectoryTable.tsx', s => {
  s = s.replaceAll('needs_info', 'needs_resubmission');
  const start = s.indexOf('      <div className="grid grid-cols-2');
  const end = s.indexOf('      {/*', s.indexOf('      </div>', start) + 12);
  if (start < 0 || end < start) throw new Error('Directory metric boundaries');
  s = s.slice(0, start) + `      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        {[
          { id: 'all', label: 'Total roster', count: counts.all, note: 'Registered attorneys' },
          { id: 'approved', label: 'Verified counsel', count: counts.approved, note: 'Approved credentials' },
          { id: 'pending', label: 'Pending review', count: counts.pending, note: 'Awaiting credential review' },
          { id: 'rejected', label: 'Not approved', count: counts.rejected, note: 'Applications declined' },
        ].map((item) => <button key={item.id} type="button" aria-pressed={selectedStatus === item.id} onClick={() => setSelectedStatus(item.id)} className="admin-card admin-filter p-5">
          <span className="block text-xs font-semibold text-[#705744]">{item.label}</span>
          <span className="admin-plate admin-filter-count px-4 py-3">{item.count}</span>
          <span className="mt-4 block text-[11px] text-[#705744]">{item.note}</span>
        </button>)}
      </div>

` + s.slice(end);
  s = s.replace('flex flex-col md:flex-row md:items-center justify-between gap-4', 'flex flex-col gap-5');
  s = s.replace('relative flex-1 max-w-md', 'relative w-full max-w-xl');
  s = s.replace('type="text"\n            placeholder=', 'type="search"\n            aria-label="Search lawyer directory"\n            placeholder=');
  s = s.replace('flex flex-wrap items-center gap-1.5 p-1 rounded-2xl bg-[#E8DCCB]/50 border border-[#D5C7B5]/60 text-xs font-semibold overflow-x-auto', 'admin-filter-bar');
  s = s.replace('key={tab.id}\n              onClick', 'key={tab.id}\n              type="button"\n              aria-pressed={selectedStatus === tab.id}\n              onClick');
  s = s.replace('className={`admin-button admin-button-dark px-3', 'className={`admin-button admin-filter px-3');
  s = s.replace('bg-[#23150F] text-[#ded7cb] text-[11px] uppercase tracking-wider font-semibold border-b border-[#352219]', 'text-[11px] font-semibold');
  s = s.replaceAll(' animate-pulse', '').replaceAll(' animate-ping', '');
  return s;
});
edit('src/components/admin/LawyerVerificationQueue.tsx', s => {
  s = dialogImport(s);
  s = s.replace('flex flex-col md:flex-row md:items-center justify-between gap-4', 'flex flex-col gap-5');
  s = s.replace('flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none', 'admin-filter-bar');
  s = s.replace('relative w-full md:w-72', 'relative w-full max-w-xl');
  s = s.replace('type="text"\n            value={searchQuery}', 'type="search"\n            aria-label="Search lawyer applications"\n            value={searchQuery}');
  s = s.replace(/onClick=\{\(\) => setActiveTab\('([^']+)'\)\}/g, (_, tab) => `type="button" aria-pressed={activeTab === '${tab}'} onClick={() => setActiveTab('${tab}')}`);
  s = s.replaceAll('admin-button admin-button-primary px-4 py-2', 'admin-button admin-filter px-4 py-2').replaceAll('admin-button admin-button-dark px-4 py-2', 'admin-button admin-filter px-4 py-2');
  s = s.replace('className="admin-button px-4 py-2 rounded-xl bg-emerald', 'className="admin-button admin-button-success px-4 py-2 rounded-xl bg-emerald');
  s = s.replace('className="admin-button px-3.5 py-2 rounded-xl bg-amber', 'className="admin-button admin-button-warning px-3.5 py-2 rounded-xl bg-amber');
  s = s.replace('className="admin-button px-3.5 py-2 rounded-xl bg-red', 'className="admin-button admin-button-danger px-3.5 py-2 rounded-xl bg-red');
  s = s.replace(/<div className="fixed inset-0 z-50[^\n]+>\s*<div\s+className="admin-card w-full max-w-lg[^\n]+"\s*>/, '<AdminDialog open onClose={() => setModalState((previous) => ({ ...previous, open: false }))} labelledBy="verification-decision-title">\n          <div className="space-y-5">');
  const last = s.lastIndexOf('        </div>');
  s = s.slice(0, last) + s.slice(last).replace('        </div>', '        </AdminDialog>');
  s = s.replace('<h3 className="font-lora text-2xl font-bold text-[#34150F]">\n                  {modalState', '<h3 id="verification-decision-title" className="font-lora text-xl text-[#34150F]">\n                  {modalState');
  s = s.replace('onClick={() => setModalState({ open: false, lawyer: null, decision: \'approved\', note: \'\' })}\n                className=', 'onClick={() => setModalState({ open: false, lawyer: null, decision: \'approved\', note: \'\' })}\n                aria-label="Close verification decision"\n                className=');
  s = s.replace('className="font-semibold text-[#34150F] block"', 'htmlFor="verification-info-note" className="font-semibold text-[#34150F] block"').replace('className="font-semibold text-[#34150F] block"', 'className="font-semibold text-[#34150F] block"');
  // The two conditional fields are mutually exclusive; each shares its label id.
  s = s.replaceAll('<textarea\n                    rows=', '<textarea\n                    id="verification-info-note"\n                    rows=');
  s = s.replace('className="flex items-center justify-end gap-3 pt-3', 'className="flex flex-wrap items-center justify-end gap-3 pt-3');
  return s;
});
edit('src/components/admin/AdminLawyerReviewPanel.tsx', s => {
  s = s.replace('className="text-xs font-semibold text-[#34150F] block"', 'htmlFor="lawyer-review-note" className="text-xs font-semibold text-[#34150F] block"');
  s = s.replace('<textarea\n            rows=', '<textarea\n            id="lawyer-review-note"\n            rows=');
  s = s.replace('className="flex items-center justify-between pt-2"', 'className="flex flex-wrap items-center justify-between gap-5 pt-2"');
  s = s.replace('className="grid grid-cols-1 sm:grid-cols-3 gap-3"', 'className="grid grid-cols-1 gap-4 xl:grid-cols-3"');
  return s;
});
for (const file of ['src/components/admin/AdminLawyerReviewPanel.tsx', 'src/components/admin/LawyerVerificationQueue.tsx']) edit(file, s => {
  return s.replaceAll("'bg-emerald-700 hover:bg-emerald-800'", "'admin-button-success'").replaceAll("'bg-amber-600 hover:bg-amber-700'", "'admin-button-warning'").replaceAll("'bg-red-700 hover:bg-red-800'", "'admin-button-danger'");
});
edit('src/components/admin/views/AdminVerificationQueueView.tsx', s => s.replace('className="px-5 py-3 rounded-2xl', 'className="admin-plate px-5 py-3 rounded-2xl'));
