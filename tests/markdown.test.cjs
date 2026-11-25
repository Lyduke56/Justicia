// AI response Markdown (src/lib/markdown/parse.ts): block and inline parsing, link safety, and
// tolerance for responses that are still streaming in.
// Run: node --test tests/markdown.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const md = {};
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/lib/markdown/parse.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  { exports: md, String, RegExp, Math, parseInt }
);
const plain = (v) => JSON.parse(JSON.stringify(v));
const text = (value) => ({ type: 'text', value });

test('headings become heading blocks instead of "### Test" text', () => {
  assert.deepEqual(plain(md.parseMarkdown('### Test')), [{ type: 'heading', level: 3, children: [text('Test')] }]);
  assert.deepEqual(plain(md.parseMarkdown('# Title #')), [{ type: 'heading', level: 1, children: [text('Title')] }]);
  // "#hashtag" is not a heading
  assert.equal(md.parseMarkdown('#hashtag')[0].type, 'paragraph');
});

test('paragraphs keep single line breaks and split on blank lines', () => {
  const blocks = plain(md.parseMarkdown('Line one\nline two\n\nNext paragraph'));
  assert.deepEqual(blocks, [
    { type: 'paragraph', children: [text('Line one'), { type: 'break' }, text('line two')] },
    { type: 'paragraph', children: [text('Next paragraph')] },
  ]);
});

test('bold, italic, strikethrough and inline code', () => {
  assert.deepEqual(plain(md.parseInline('A **bold** and *italic* and __b__ and _i_ ~~gone~~ `code *x*`')), [
    text('A '),
    { type: 'strong', children: [text('bold')] },
    text(' and '),
    { type: 'em', children: [text('italic')] },
    text(' and '),
    { type: 'strong', children: [text('b')] },
    text(' and '),
    { type: 'em', children: [text('i')] },
    text(' '),
    { type: 'del', children: [text('gone')] },
    text(' '),
    { type: 'code', value: 'code *x*' },
  ]);
  // snake_case words are not italic
  assert.deepEqual(plain(md.parseInline('use snake_case_name')), [text('use snake_case_name')]);
  // escaped markers stay literal
  assert.deepEqual(plain(md.parseInline('\\*not italic\\*')), [text('*not italic*')]);
});

test('ordered, unordered and nested lists', () => {
  const [list] = plain(md.parseMarkdown('1. First\n2. Second\n   - nested a\n   - nested b\n3. Third'));
  assert.equal(list.type, 'list');
  assert.equal(list.ordered, true);
  assert.equal(list.items.length, 3);
  assert.deepEqual(list.items[0], [{ type: 'paragraph', children: [text('First')] }]);
  assert.equal(list.items[1][1].type, 'list');
  assert.equal(list.items[1][1].ordered, false);
  assert.equal(list.items[1][1].items.length, 2);

  const [bullets] = plain(md.parseMarkdown('- a\n* b\n+ c'));
  assert.equal(bullets.items.length, 3);
  const [startAt] = plain(md.parseMarkdown('4. four\n5. five'));
  assert.equal(startAt.start, 4);
});

test('a list right after a sentence still becomes a list', () => {
  const blocks = plain(md.parseMarkdown('You need:\n- a valid ID\n- the contract'));
  assert.deepEqual(blocks.map((b) => b.type), ['paragraph', 'list']);
});

test('code blocks, quotes, rules and tables', () => {
  const blocks = plain(md.parseMarkdown('```ts\nconst a = 1;\n```\n\n> quoted **text**\n\n---\n\n| Law | Year |\n|:--|--:|\n| RA 386 | 1949 |'));
  assert.deepEqual(blocks[0], { type: 'code', lang: 'ts', value: 'const a = 1;' });
  assert.equal(blocks[1].type, 'quote');
  assert.equal(blocks[1].children[0].children[1].type, 'strong');
  assert.deepEqual(blocks[2], { type: 'hr' });
  assert.equal(blocks[3].type, 'table');
  assert.deepEqual(blocks[3].align, ['left', 'right']);
  assert.deepEqual(blocks[3].rows[0], [[text('RA 386')], [text('1949')]]);
});

test('links: only http(s) and mailto become links; HTML stays text', () => {
  assert.deepEqual(plain(md.parseInline('[Lawphil](https://lawphil.net)')), [
    { type: 'link', href: 'https://lawphil.net', children: [text('Lawphil')] },
  ]);
  // javascript: URLs are never links
  assert.deepEqual(plain(md.parseInline('[click](javascript:alert(1))')).some((n) => n.type === 'link'), false);
  // bare URLs are linked without trailing punctuation
  const auto = plain(md.parseInline('See https://sc.judiciary.gov.ph.'));
  assert.deepEqual(auto[1], { type: 'link', href: 'https://sc.judiciary.gov.ph', children: [text('https://sc.judiciary.gov.ph')] });
  assert.deepEqual(plain(md.parseInline('<script>alert(1)</script>')), [text('<script>alert(1)</script>')]);
  assert.equal(md.safeHref('mailto:help@justicia.ph'), 'mailto:help@justicia.ph');
  assert.equal(md.safeHref('data:text/html,hi'), null);
});

test('streaming: unfinished markers are hidden, unclosed fences render as code', () => {
  assert.deepEqual(plain(md.parseMarkdown('Some **bold', { streaming: true })), [{ type: 'paragraph', children: [text('Some bold')] }]);
  assert.deepEqual(plain(md.parseMarkdown('Read [the la', { streaming: true })), [{ type: 'paragraph', children: [text('Read')] }]);
  // a finished **bold** at the very end is kept
  assert.equal(plain(md.parseMarkdown('Done **now**', { streaming: true }))[0].children[1].type, 'strong');
  const code = plain(md.parseMarkdown('```\nlet x', { streaming: true }));
  assert.deepEqual(code, [{ type: 'code', lang: '', value: 'let x' }]);
});
