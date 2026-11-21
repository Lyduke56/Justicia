const fs = require('node:fs');
const ts = require('typescript');
const files = require('node:child_process').execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split('\n').filter(f => f.endsWith('.tsx'));
for (const file of files) {
  let source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === 'className') {
      let literal = node.initializer;
      if (literal && ts.isJsxExpression(literal)) literal = literal.expression;
      if (literal && ts.isTemplateExpression(literal)) literal = literal.head;
      if (literal && (ts.isStringLiteral(literal) || ts.isTemplateHead(literal))) {
        const text = literal.text;
        const surface = /\badmin-(card|plate|inset|field|button|status|decision)\b/.test(text);
        if (surface) {
          const action = /\badmin-(button|status)\b/.test(text);
          const cleaned = text.split(/\s+/).filter(token => {
            if (/^(bg-|border(?:-|$)|rounded(?:-|$)|shadow(?:-|$))/.test(token)) return false;
            if (/^(hover:bg-|hover:border-|focus:ring-|focus:border-|focus:outline-|focus-visible:outline-)/.test(token)) return false;
            if (action && /^(text-\[#|text-white|text-(?:emerald|rose|red|amber|indigo|stone)-|hover:text-)/.test(token)) return false;
            return Boolean(token);
          }).join(' ');
          const isHead = ts.isTemplateHead(literal);
          edits.push({ start: literal.getStart(ast) + 1, end: literal.end - (isHead ? 2 : 1), value: cleaned + (isHead ? ' ' : '') });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  for (const e of edits.sort((a,b) => b.start-a.start)) source = source.slice(0,e.start) + e.value + source.slice(e.end);
  fs.writeFileSync(file, source);
}
