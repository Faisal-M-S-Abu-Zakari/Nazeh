import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const web = createRequire(new URL('artifacts/al-aqsa-camp/package.json', root));
const mobile = createRequire(new URL('artifacts/al-aqsa-camp-mobile/package.json', root));

// Security floors for the affected release lines, not a blanket major upgrade.
const floors: Record<string, Record<number, string>> = {
  '@smithy/config-resolver': { 4: '4.4.0' },
  '@tiptap/core': { 2: '3.30.4', 3: '3.30.4' },
  axios: { 1: '1.20.0' },
  'brace-expansion': { 5: '5.0.12' },
  compression: { 1: '1.8.2' },
  'decode-uri-component': { 0: '0.5.1' },
  effect: { 3: '3.20.0' },
  esbuild: { 0: '0.28.1' },
  'fast-copy': { 4: '4.1.0' },
  'fast-uri': { 3: '3.1.9' },
  'fast-xml-parser': { 5: '5.12.0' },
  'follow-redirects': { 1: '1.16.0' },
  'form-data': { 4: '4.0.6' },
  'http-cache-semantics': { 4: '4.3.0' },
  'js-yaml': { 4: '4.3.2' },
  'linkify-it': { 5: '5.0.2' },
  lodash: { 4: '4.18.0' },
  'markdown-it': { 14: '14.3.3' },
  nanoid: { 3: '3.3.18' },
  next: { 15: '15.5.28', 16: '16.4.1' },
  'node-forge': { 1: '1.4.3' },
  nodemailer: { 7: '10.1.4', 8: '10.1.4', 9: '10.1.4', 10: '10.1.4' },
  picomatch: { 4: '4.0.4' },
  postcss: { 8: '8.5.23' },
  'postcss-selector-parser': { 6: '6.1.5', 7: '7.1.6' },
  'prosemirror-view': { 1: '1.42.3' },
  'proxy-addr': { 2: '2.0.8' },
  qs: { 6: '6.16.0' },
  sharp: { 0: '0.35.5' },
  'shell-quote': { 1: '1.11.0' },
  'source-map-js': { 1: '1.2.2' },
  tar: { 7: '7.5.21' },
  uuid: { 3: '11.1.1', 7: '11.1.1', 8: '11.1.1', 9: '11.1.1', 11: '11.1.1' },
};

function atLeast(version: string, minimum: string) {
  const actual = version.split('.').map(Number);
  const required = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (actual[i] !== required[i]) return actual[i]! > required[i]!;
  }
  return true;
}

function assertPatched(name: string, version: string) {
  const minimum = floors[name]?.[Number(version.split('.')[0])];
  if (minimum) assert.ok(atLeast(version, minimum), `${name}@${version} needs >=${minimum}`);
}

test('workspace lockfile keeps the affected dependency lines patched', () => {
  const lock = readFileSync(new URL('pnpm-lock.yaml', root), 'utf8');
  const packages = [...lock.matchAll(/^  '?(.+)@(\d+\.\d+\.\d+)'?:$/gm)];
  assert.ok(packages.length > 500, 'must inspect package entries, not an empty inventory');
  for (const [, name, version] of packages) assertPatched(name!, version!);
});

test('preserved migration lockfile also keeps affected dependencies patched', () => {
  const lock = JSON.parse(readFileSync(new URL('.migration-backup/package-lock.json', root), 'utf8'));
  assert.equal(lock.lockfileVersion, 3);
  for (const [path, value] of Object.entries(lock.packages)) {
    if (!path) continue;
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    assertPatched(name, (value as { version: string }).version);
  }
});

test('Expo query parser still decodes Arabic and tolerates malformed UTF-8', () => {
  const router = createRequire(mobile.resolve('expo-router/package.json'));
  const query = router('query-string');
  const parsed = query.parse('name=%D8%B9%D9%84%D9%8A&broken=%E0%A4&tag=a&tag=b');
  assert.equal(parsed.name, 'علي');
  assert.equal(parsed.broken, '%E0%A4');
  assert.deepEqual(parsed.tag, ['a', 'b']);
  assert.equal(query.parse(query.stringify({ name: 'علي' })).name, 'علي');
  // The vulnerable fallback recursively split long malformed sequences.
  const malformed = '%FE%FF'.repeat(10_000);
  assert.equal(typeof query.parse(`value=${malformed}`).value, 'string');
});

test('Expo native project UUID generation retains its CommonJS API', () => {
  const expo = createRequire(mobile.resolve('expo/package.json'));
  const plugins = createRequire(expo.resolve('@expo/config-plugins/package.json'));
  const xcode = plugins('xcode');
  const project = xcode.project('unused.pbxproj');
  project.hash = { project: { objects: {} } };
  assert.match(project.generateUuid(), /^[A-F0-9]{24}$/);
  const ngrok = createRequire(mobile.resolve('@expo/ngrok/package.json'));
  assert.match(ngrok('uuid').v4(), /^[0-9a-f-]{36}$/);
});

test('Excel exports remain readable with the patched UUID dependency', async () => {
  const ExcelJS = web('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Families');
  sheet.addRow(['Family', 'Members']);
  sheet.addRow(['Test household', 4]);
  sheet.addConditionalFormatting({
    ref: 'B2:B2',
    rules: [{ type: 'dataBar', minLength: 0, maxLength: 100, cfvo: [{ type: 'min' }, { type: 'max' }] }],
  });
  const data = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(data);
  assert.equal(restored.getWorksheet('Families').getCell('B2').value, 4);
});
