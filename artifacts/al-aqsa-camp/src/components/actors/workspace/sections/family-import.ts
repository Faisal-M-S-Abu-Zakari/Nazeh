import ExcelJS from 'exceljs';
import type { FamilyImportInput } from '@workspace/api-client-react';

export const FAMILY_SHEET_NAME = 'الأسر';
export const MEMBER_SHEET_NAME = 'أفراد الأسرة';
export const MAX_WORKBOOK_BYTES = 5 * 1024 * 1024;
export const MAX_UNCOMPRESSED_XLSX_BYTES = 24 * 1024 * 1024;
export const MAX_XLSX_ENTRY_BYTES = 8 * 1024 * 1024;
export const MAX_XLSX_ENTRIES = 100;
export const MAX_XLSX_COMPRESSION_RATIO = 500;
export const MAX_IMPORT_FAMILIES = 100;
export const MAX_IMPORT_MEMBERS = 500;
export const MAX_IMPORT_JSON_BYTES = 75 * 1024;

const FAMILY_HEADER_ROW = 3;
const MEMBER_HEADER_ROW = 3;
const FAMILY_HEADERS = [
  'مرجع الأسرة*',
  'استيراد؟ (نعم/لا)',
  'القطاع (الاسم المطابق تمامًا)',
  'المأوى (الرمز، اختياري)',
  'اسم رب الأسرة*',
  'الهاتف',
  'ملاحظات الأسرة',
];
const MEMBER_HEADERS = [
  'مرجع الأسرة*',
  'الاسم الكامل*',
  'رقم الهوية',
  'الجنس (ذكر/أنثى/آخر)',
  'تاريخ الميلاد (YYYY-MM-DD)',
  'صلة القرابة*',
  'حالة حرجة؟ (نعم/لا)',
  'ملاحظات',
];

export type CampOption = { id: string; name: string };
export type SectorOption = { id: string; campId: string; name: string };
export type ShelterOption = { id: string; sectorId: string; code: string };

export type FamilyImportPreview = {
  families: FamilyImportInput['families'];
  errors: string[];
  duplicateNationalIdRows: number[];
  sourceFamilyCount: number;
  ignoredExampleCount: number;
};

const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const normalizeNationalId = (value: string): string =>
  value.replace(/[ \t\r\n\f\v]+/g, ' ').replace(/^ +| +$/g, '').toLocaleLowerCase('en-US');

const isBlankRow = (row: unknown[]): boolean =>
  row.every((cell) => cell == null || String(cell).trim() === '');

function toRows(sheet: ExcelJS.Worksheet): unknown[][] {
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > MAX_IMPORT_MEMBERS + FAMILY_HEADER_ROW + 1) {
      throw new Error('rows-limit');
    }
    const cells = Array.from({ length: sheet.columnCount }, (_, index) => {
      const value = row.getCell(index + 1).value;
      if (value instanceof Date || value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return value ?? '';
      }
      throw new Error('unsupported-cell');
    });
    rows[rowNumber - 1] = cells;
  });
  return rows;
}

function validateHeader(rows: unknown[][], headers: string[], headerRow: number, sheetName: string, errors: string[]) {
  const row = rows[headerRow] ?? [];
  const values = row.map((value) => text(value));
  const duplicates = values.filter((value, index) => value && values.indexOf(value) !== index);
  if (duplicates.length) errors.push(`ورقة «${sheetName}»: يوجد عنوان عمود مكرر في الصف ${headerRow + 1}.`);
  if (headers.some((header) => !values.includes(header))) {
    errors.push(`ورقة «${sheetName}»: عناوين الأعمدة غير مكتملة أو غير مطابقة للقالب.`);
  }
  const indexes = new Map<string, number>();
  headers.forEach((header) => indexes.set(header, values.indexOf(header)));
  return { rows, indexes };
}

/**
 * Checks the ZIP central directory before ExcelJS inflates any workbook XML.
 * This rejects ZIP64/multidisk archives, oversized entries, high expansion
 * ratios, encryption, unsupported compression, and unsafe/duplicate paths.
 */
export function preflightXlsxArchive(buffer: ArrayBuffer): void {
  if (buffer.byteLength < 22 || buffer.byteLength > MAX_WORKBOOK_BYTES) {
    throw new Error('حجم الملف أو بنية أرشيف Excel غير مقبولة.');
  }
  const view = new DataView(buffer);
  const minEocdOffset = Math.max(0, buffer.byteLength - 22 - 65_535);
  let eocdOffset = -1;
  for (let offset = buffer.byteLength - 22; offset >= minEocdOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error('الملف ليس أرشيف XLSX صالحاً.');
  const diskNumber = view.getUint16(eocdOffset + 4, true);
  const centralDirectoryDisk = view.getUint16(eocdOffset + 6, true);
  const entriesOnDisk = view.getUint16(eocdOffset + 8, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const centralDirectoryBytes = view.getUint32(eocdOffset + 12, true);
  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const commentLength = view.getUint16(eocdOffset + 20, true);
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === 0xffff ||
    centralDirectoryBytes === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    eocdOffset + 22 + commentLength !== buffer.byteLength ||
    entryCount < 1 ||
    entryCount > MAX_XLSX_ENTRIES ||
    centralDirectoryOffset + centralDirectoryBytes !== eocdOffset
  ) {
    throw new Error('أرشيف Excel متعدد الأجزاء أو يتجاوز الحدود الآمنة.');
  }

  const decoder = new TextDecoder();
  const entryNames = new Set<string>();
  let cursor = centralDirectoryOffset;
  let totalUncompressedBytes = 0;
  let hasContentTypes = false;
  let hasWorkbookXml = false;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > eocdOffset || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error('فهرس أرشيف Excel غير صالح.');
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const filenameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const entryCommentLength = view.getUint16(cursor + 32, true);
    const diskStart = view.getUint16(cursor + 34, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const next = cursor + 46 + filenameLength + extraLength + entryCommentLength;
    if (
      next > eocdOffset ||
      (flags & 1) !== 0 ||
      (method !== 0 && method !== 8) ||
      diskStart !== 0 ||
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff ||
      uncompressedSize > MAX_XLSX_ENTRY_BYTES ||
      (uncompressedSize > 0 && (compressedSize === 0 || uncompressedSize / compressedSize > MAX_XLSX_COMPRESSION_RATIO))
    ) {
      throw new Error('إحدى خلايا الملف أو مرفقاته تتجاوز حدود الأمان.');
    }
    const name = decoder.decode(new Uint8Array(buffer, cursor + 46, filenameLength));
    if (
      !name ||
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').includes('..') ||
      entryNames.has(name) ||
      localHeaderOffset + 30 > centralDirectoryOffset ||
      view.getUint32(localHeaderOffset, true) !== 0x04034b50
    ) {
      throw new Error('اسم أو رأس ملف داخل أرشيف Excel غير صالح.');
    }
    const localFilenameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const localDataOffset = localHeaderOffset + 30 + localFilenameLength + localExtraLength;
    if (localDataOffset + compressedSize > centralDirectoryOffset) {
      throw new Error('بيانات ملف مضغوط خارج حدود أرشيف Excel.');
    }
    entryNames.add(name);
    hasContentTypes ||= name === '[Content_Types].xml';
    hasWorkbookXml ||= name === 'xl/workbook.xml';
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > MAX_UNCOMPRESSED_XLSX_BYTES) {
      throw new Error('الحجم بعد فك ضغط الملف يتجاوز الحد الآمن.');
    }
    cursor = next;
  }
  if (cursor !== centralDirectoryOffset + centralDirectoryBytes || !hasContentTypes || !hasWorkbookXml) {
    throw new Error('ملف Excel يفتقد مكونات XLSX المطلوبة.');
  }
}

function parseYesNo(value: unknown): boolean | undefined {
  const normalized = text(value).toLocaleLowerCase();
  if (['نعم', 'yes', 'true', '1'].includes(normalized)) return true;
  if (['لا', 'no', 'false', '0'].includes(normalized)) return false;
  return undefined;
}

function parseGender(value: unknown): 'MALE' | 'FEMALE' | 'OTHER' | undefined {
  const normalized = text(value).toLocaleLowerCase();
  if (['ذكر', 'male', 'm'].includes(normalized)) return 'MALE';
  if (['أنثى', 'انثى', 'female', 'f'].includes(normalized)) return 'FEMALE';
  if (['آخر', 'اخر', 'أخرى', 'other'].includes(normalized)) return 'OTHER';
  return undefined;
}

function parseDate(value: unknown): string | undefined | null {
  if (value == null || value === '') return undefined;
  let candidate: string;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    candidate = value.toISOString().slice(0, 10);
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    candidate = value.trim();
  } else {
    return null;
  }
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === candidate ? candidate : null;
}

export function createFamilyWorkbook(campName: string, sectors: SectorOption[], shelters: ShelterOption[]): ExcelJS.Workbook {
  const firstSector = sectors[0];
  const exampleShelter = firstSector ? shelters.find((shelter) => shelter.sectorId === firstSector.id) : undefined;
  const workbook = new ExcelJS.Workbook();
  const familySheet = workbook.addWorksheet(FAMILY_SHEET_NAME);
  const memberSheet = workbook.addWorksheet(MEMBER_SHEET_NAME);
  familySheet.addRows([
    [`قالب استيراد الأسر - ${campName}`],
    ['تعليمات: اترك المثال التوضيحي كما هو أو احذفه؛ لا يُستورد لأنه محدد بـ«لا». أضف كل أسرة في صف، واجعل «استيراد؟» نعم، واستخدم اسم القطاع المطابق تمامًا.'],
    ['املأ ورقة «أفراد الأسرة» واربط كل فرد بمرجع الأسرة نفسه. لا تُرسل بيانات حقيقية بالبريد أو خارج النظام.'],
    FAMILY_HEADERS,
    ['DEMO-001', 'لا', firstSector?.name ?? 'اسم القطاع', exampleShelter?.code ?? '', 'مثال توضيحي فقط', '', ''],
  ]);
  memberSheet.addRows([
    [`قالب أفراد الأسر - ${campName}`],
    ['تعليمات: المثال التالي اصطناعي بالكامل ومربوط بالأسرة DEMO-001 المستبعدة. أضف الأفراد الحقيقيين بصفوف جديدة وأدخل تاريخ الميلاد بصيغة YYYY-MM-DD.'],
    ['اترك رقم الهوية كنص للحفاظ على الأصفار في بدايته. الجنس: ذكر / أنثى / آخر.'],
    MEMBER_HEADERS,
    ['DEMO-001', 'فرد توضيحي', '0000000000', 'ذكر', '2010-01-01', 'ابن/ابنة', 'لا', ''],
  ]);
  familySheet.columns = [{ width: 20 }, { width: 18 }, { width: 32 }, { width: 22 }, { width: 28 }, { width: 20 }, { width: 35 }];
  memberSheet.columns = [{ width: 20 }, { width: 28 }, { width: 22 }, { width: 24 }, { width: 28 }, { width: 18 }, { width: 24 }, { width: 35 }];
  for (const address of ['A5', 'F5']) familySheet.getCell(address).numFmt = '@';
  for (const address of ['A5', 'C5']) memberSheet.getCell(address).numFmt = '@';
  return workbook;
}

export async function parseFamilyWorkbook(
  buffer: ArrayBuffer,
  campId: string,
  sectors: SectorOption[],
  shelters: ShelterOption[],
): Promise<FamilyImportPreview> {
  const errors: string[] = [];
  const empty: FamilyImportPreview = {
    families: [],
    errors,
    duplicateNationalIdRows: [],
    sourceFamilyCount: 0,
    ignoredExampleCount: 0,
  };
  let workbook: ExcelJS.Workbook;
  try {
    preflightXlsxArchive(buffer);
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(new Uint8Array(buffer) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  } catch {
    errors.push('تعذر قراءة الملف؛ تأكد أنه ملف Excel بصيغة .xlsx صالح وضمن الحدود الآمنة.');
    return empty;
  }
  if (
    workbook.worksheets.length !== 2 ||
    !workbook.getWorksheet(FAMILY_SHEET_NAME) ||
    !workbook.getWorksheet(MEMBER_SHEET_NAME)
  ) {
    errors.push('يجب أن يحتوي الملف على ورقتي «الأسر» و«أفراد الأسرة» فقط.');
    return empty;
  }
  const familySheet = workbook.getWorksheet(FAMILY_SHEET_NAME)!;
  const memberSheet = workbook.getWorksheet(MEMBER_SHEET_NAME)!;
  if (
    familySheet.rowCount > MAX_IMPORT_FAMILIES + FAMILY_HEADER_ROW + 1 ||
    memberSheet.rowCount > MAX_IMPORT_MEMBERS + MEMBER_HEADER_ROW + 1 ||
    familySheet.columnCount > 20 ||
    memberSheet.columnCount > 20
  ) {
    errors.push('تجاوز الملف الحد الأقصى للصفوف أو الأعمدة المسموح به.');
    return empty;
  }
  let familyRows: unknown[][];
  let memberRows: unknown[][];
  try {
    familyRows = toRows(familySheet);
    memberRows = toRows(memberSheet);
  } catch {
    errors.push('القالب لا يقبل الصيغ أو الخلايا المركبة؛ استخدم قيماً نصية أو رقمية مباشرة.');
    return empty;
  }
  const familyParsed = validateHeader(familyRows, FAMILY_HEADERS, FAMILY_HEADER_ROW, FAMILY_SHEET_NAME, errors);
  const memberParsed = validateHeader(memberRows, MEMBER_HEADERS, MEMBER_HEADER_ROW, MEMBER_SHEET_NAME, errors);
  if (errors.length) return empty;

  const familyRecords = new Map<string, { included: boolean; row: number; values: Record<string, unknown> }>();
  for (let index = FAMILY_HEADER_ROW + 1; index < familyParsed.rows.length; index += 1) {
    const row = familyParsed.rows[index] ?? [];
    if (isBlankRow(row)) continue;
    const value = (header: string) => row[familyParsed.indexes.get(header)!];
    const ref = text(value(FAMILY_HEADERS[0]));
    const include = parseYesNo(value(FAMILY_HEADERS[1]));
    if (!ref || include === undefined) {
      errors.push(`ورقة «الأسر»، الصف ${index + 1}: أدخل مرجعاً وخيار استيراد «نعم» أو «لا».`);
      continue;
    }
    if (familyRecords.has(ref)) {
      errors.push(`ورقة «الأسر»، الصف ${index + 1}: مرجع الأسرة مكرر.`);
      continue;
    }
    familyRecords.set(ref, {
      included: include,
      row: index + 1,
      values: Object.fromEntries(FAMILY_HEADERS.map((header) => [header, value(header)])),
    });
    if (!include) empty.ignoredExampleCount += 1;
  }
  empty.sourceFamilyCount = [...familyRecords.values()].filter((record) => record.included).length;
  if (!empty.sourceFamilyCount) errors.push('لا توجد أسر محددة للاستيراد؛ اجعل خيار «استيراد؟» نعم.');
  if (empty.sourceFamilyCount > MAX_IMPORT_FAMILIES) errors.push('الحد الأقصى هو 100 أسرة في الملف الواحد.');

  const recordsByRef = new Map<string, Array<{ row: number; values: unknown[] }>>();
  for (let index = MEMBER_HEADER_ROW + 1; index < memberParsed.rows.length; index += 1) {
    const row = memberParsed.rows[index] ?? [];
    if (isBlankRow(row)) continue;
    const refIndex = memberParsed.indexes.get(MEMBER_HEADERS[0])!;
    const ref = text(row[refIndex]);
    if (!ref) {
      errors.push(`ورقة «أفراد الأسرة»، الصف ${index + 1}: مرجع الأسرة مطلوب.`);
      continue;
    }
    const family = familyRecords.get(ref);
    if (!family) {
      errors.push(`ورقة «أفراد الأسرة»، الصف ${index + 1}: مرجع الأسرة غير موجود في ورقة الأسر.`);
      continue;
    }
    if (!family.included) continue;
    const members = recordsByRef.get(ref) ?? [];
    members.push({ row: index + 1, values: row });
    recordsByRef.set(ref, members);
  }
  const memberRowCount = [...recordsByRef.values()].reduce((sum, members) => sum + members.length, 0);
  if (memberRowCount > MAX_IMPORT_MEMBERS) errors.push('الحد الأقصى هو 500 فرد في الملف الواحد.');

  const parsedFamilies: FamilyImportInput['families'] = [];
  const nationalIdRows = new Map<string, number[]>();
  for (const [ref, familyRecord] of familyRecords) {
    if (!familyRecord.included) continue;
    const value = (header: string) => familyRecord.values[header];
    const headName = text(value(FAMILY_HEADERS[4]));
    const sectorName = text(value(FAMILY_HEADERS[2]));
    const shelterCode = text(value(FAMILY_HEADERS[3]));
    const headPhoneValue = value(FAMILY_HEADERS[5]);
    const criticalNotes = text(value(FAMILY_HEADERS[6]));
    if (!headName || !sectorName) {
      errors.push(`ورقة «الأسر»، الصف ${familyRecord.row}: اسم رب الأسرة والقطاع مطلوبان.`);
      continue;
    }
    if (headPhoneValue != null && headPhoneValue !== '' && typeof headPhoneValue !== 'string') {
      errors.push(`ورقة «الأسر»، الصف ${familyRecord.row}: اكتب رقم الهاتف كنص للحفاظ على أرقامه.`);
      continue;
    }
    const matchingSectors = sectors.filter((sector) => sector.campId === campId && sector.name.trim() === sectorName);
    if (matchingSectors.length !== 1) {
      errors.push(matchingSectors.length
        ? `ورقة «الأسر»، الصف ${familyRecord.row}: اسم القطاع غير فريد داخل المخيم؛ يلزم توضيح الاختيار.`
        : `ورقة «الأسر»، الصف ${familyRecord.row}: القطاع غير موجود في المخيم المحدد.`);
      continue;
    }
    const sector = matchingSectors[0];
    let shelterId: string | undefined;
    if (shelterCode) {
      const matchingShelters = shelters.filter((shelter) => shelter.sectorId === sector.id && shelter.code.trim() === shelterCode);
      if (matchingShelters.length !== 1) {
        errors.push(matchingShelters.length
          ? `ورقة «الأسر»، الصف ${familyRecord.row}: رمز المأوى غير فريد في القطاع.`
          : `ورقة «الأسر»، الصف ${familyRecord.row}: المأوى غير موجود في القطاع المحدد.`);
        continue;
      }
      shelterId = matchingShelters[0].id;
    }
    const memberRows = recordsByRef.get(ref) ?? [];
    if (!memberRows.length) {
      errors.push(`ورقة «الأسر»، الصف ${familyRecord.row}: أضف فرداً واحداً على الأقل في ورقة أفراد الأسرة.`);
      continue;
    }
    const members: FamilyImportInput['families'][number]['members'] = [];
    for (const memberRow of memberRows) {
      const at = (header: string) => memberRow.values[memberParsed.indexes.get(header)!];
      const fullName = text(at(MEMBER_HEADERS[1]));
      const nationalIdValue = at(MEMBER_HEADERS[2]);
      const nationalId = text(nationalIdValue);
      const gender = parseGender(at(MEMBER_HEADERS[3]));
      const birthDate = parseDate(at(MEMBER_HEADERS[4]));
      const relationship = text(at(MEMBER_HEADERS[5]));
      const criticalCaseValue = at(MEMBER_HEADERS[6]);
      const criticalCase = criticalCaseValue == null || criticalCaseValue === '' ? false : parseYesNo(criticalCaseValue);
      const memberNotes = text(at(MEMBER_HEADERS[7]));
      if (typeof nationalIdValue === 'number') {
        errors.push(`ورقة «أفراد الأسرة»، الصف ${memberRow.row}: اكتب رقم الهوية كنص لتجنب فقدان الأصفار.`);
      }
      if (!fullName || !gender || birthDate === null || !relationship || criticalCase === undefined) {
        errors.push(`ورقة «أفراد الأسرة»، الصف ${memberRow.row}: الاسم والجنس والقرابة والحقول الاختيارية غير صالحة.`);
        continue;
      }
      if (nationalId) {
        const normalizedId = normalizeNationalId(nationalId);
        const rows = nationalIdRows.get(normalizedId) ?? [];
        rows.push(memberRow.row);
        nationalIdRows.set(normalizedId, rows);
      }
      members.push({
        fullName,
        ...(nationalId ? { nationalId } : {}),
        gender,
        ...(typeof birthDate === 'string' ? { birthDate } : {}),
        relationship,
        criticalCase,
        ...(memberNotes ? { criticalNotes: memberNotes } : {}),
      });
    }
    parsedFamilies.push({
      campId,
      sectorId: sector.id,
      ...(shelterId ? { shelterId } : {}),
      headName,
      ...(text(headPhoneValue) ? { headPhone: text(headPhoneValue) } : {}),
      ...(criticalNotes ? { criticalNotes } : {}),
      members,
    });
  }
  empty.duplicateNationalIdRows = [...nationalIdRows.values()].filter((rows) => rows.length > 1).flat();
  if (empty.duplicateNationalIdRows.length) errors.push('توجد أرقام هوية مكررة داخل الملف؛ راجع أرقام الصفوف الموضحة.');
  if (errors.length) return { ...empty, errors };
  const jsonBytes = new TextEncoder().encode(JSON.stringify({ families: parsedFamilies })).byteLength;
  if (jsonBytes > MAX_IMPORT_JSON_BYTES) {
    errors.push('حجم البيانات المجمعة أكبر من الحد الآمن للإرسال؛ قسّم الملف إلى ملفات أصغر.');
    return { ...empty, errors };
  }
  return { ...empty, families: parsedFamilies };
}