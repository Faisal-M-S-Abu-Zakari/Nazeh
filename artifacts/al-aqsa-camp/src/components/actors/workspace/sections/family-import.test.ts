import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import {
  createFamilyWorkbook,
  FAMILY_SHEET_NAME,
  MEMBER_SHEET_NAME,
  MAX_XLSX_ENTRIES,
  MAX_XLSX_ENTRY_BYTES,
  parseFamilyWorkbook,
  preflightXlsxArchive,
  type SectorOption,
  type ShelterOption,
} from './family-import';

const campId = '10000000-0000-4000-8000-000000000001';
const sectors: SectorOption[] = [{ id: '20000000-0000-4000-8000-000000000001', campId, name: 'قطاع تجريبي' }];
const shelters: ShelterOption[] = [{ id: '30000000-0000-4000-8000-000000000001', sectorId: sectors[0].id, code: 'خيمة-تجريبية' }];

async function workbookBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
  const output = await workbook.xlsx.writeBuffer();
  return output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
}

function populatedWorkbook() {
  const workbook = createFamilyWorkbook('مخيم تجريبي', sectors, shelters);
  workbook.getWorksheet(FAMILY_SHEET_NAME)!.addRow([
    'TEST-002', 'نعم', 'قطاع تجريبي', 'خيمة-تجريبية', 'رب أسرة تجريبي', '0590000000', '',
  ]);
  workbook.getWorksheet(MEMBER_SHEET_NAME)!.addRow([
    'TEST-002', 'فرد تجريبي', 'TEST-NATIONAL-001', 'ذكر', '2012-06-03', 'ابن', 'لا', '',
  ]);
  return workbook;
}

test('parses synthetic family and member rows and ignores the excluded example', async () => {
  const preview = await parseFamilyWorkbook(await workbookBuffer(populatedWorkbook()), campId, sectors, shelters);
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.families.length, 1);
  assert.equal(preview.families[0].headName, 'رب أسرة تجريبي');
  assert.equal(preview.families[0].shelterId, shelters[0].id);
  assert.equal(preview.families[0].members.length, 1);
  assert.equal(preview.families[0].members[0].birthDate, '2012-06-03');
  assert.equal(preview.ignoredExampleCount, 1);
});

test('reports duplicate national ID row numbers without returning any importable families', async () => {
  const workbook = populatedWorkbook();
  workbook.getWorksheet(MEMBER_SHEET_NAME)!.addRow([
    'TEST-002', 'فرد تجريبي ثانٍ', ' test-national-001  ', 'أنثى', '', 'ابنة', 'لا', '',
  ]);
  const preview = await parseFamilyWorkbook(await workbookBuffer(workbook), campId, sectors, shelters);
  assert.ok(preview.errors.some((error) => error.includes('مكررة')));
  assert.deepEqual(preview.duplicateNationalIdRows, [6, 7]);
  assert.equal(preview.families.length, 0);
});

test('rejects ambiguous sector labels rather than choosing one', async () => {
  const ambiguousSectors = [...sectors, { ...sectors[0], id: '20000000-0000-4000-8000-000000000002' }];
  const preview = await parseFamilyWorkbook(await workbookBuffer(populatedWorkbook()), campId, ambiguousSectors, shelters);
  assert.ok(preview.errors.some((error) => error.includes('غير فريد')));
  assert.equal(preview.families.length, 0);
});

test('rejects formula cells and malformed sheet layouts', async () => {
  const formulaWorkbook = populatedWorkbook();
  formulaWorkbook.getWorksheet(FAMILY_SHEET_NAME)!.getCell('B6').value = { formula: '1+1', result: 2 };
  const formulaPreview = await parseFamilyWorkbook(await workbookBuffer(formulaWorkbook), campId, sectors, shelters);
  assert.ok(formulaPreview.errors.some((error) => error.includes('الصيغ')));

  const malformed = new ExcelJS.Workbook();
  malformed.addWorksheet(FAMILY_SHEET_NAME).addRow(['not the template']);
  const malformedPreview = await parseFamilyWorkbook(await workbookBuffer(malformed), campId, sectors, shelters);
  assert.ok(malformedPreview.errors.some((error) => error.includes('ورقتي')));
});

test('preflight rejects oversized files, ZIP entries, and entry counts before workbook parsing', async () => {
  assert.throws(
    () => preflightXlsxArchive(new ArrayBuffer(5 * 1024 * 1024 + 1)),
    /حجم الملف/,
  );
  assert.throws(() => preflightXlsxArchive(new ArrayBuffer(22)), /أرشيف XLSX/);

  const oversizedEntry = await workbookBuffer(createFamilyWorkbook('مخيم تجريبي', sectors, shelters));
  const entryView = new DataView(oversizedEntry);
  let centralDirectoryOffset = -1;
  for (let offset = 0; offset < oversizedEntry.byteLength - 4; offset += 1) {
    if (entryView.getUint32(offset, true) === 0x02014b50) {
      centralDirectoryOffset = offset;
      break;
    }
  }
  assert.notEqual(centralDirectoryOffset, -1);
  entryView.setUint32(centralDirectoryOffset + 24, MAX_XLSX_ENTRY_BYTES + 1, true);
  assert.throws(() => preflightXlsxArchive(oversizedEntry), /تتجاوز حدود الأمان/);

  const tooManyEntries = await workbookBuffer(createFamilyWorkbook('مخيم تجريبي', sectors, shelters));
  const eocdView = new DataView(tooManyEntries);
  let eocdOffset = tooManyEntries.byteLength - 22;
  while (eocdOffset >= 0 && eocdView.getUint32(eocdOffset, true) !== 0x06054b50) eocdOffset -= 1;
  assert.ok(eocdOffset >= 0);
  eocdView.setUint16(eocdOffset + 8, MAX_XLSX_ENTRIES + 1, true);
  eocdView.setUint16(eocdOffset + 10, MAX_XLSX_ENTRIES + 1, true);
  assert.throws(() => preflightXlsxArchive(tooManyEntries), /الحدود الآمنة/);
});