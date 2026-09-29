export const FAMILY_NATIONAL_ID_INDEX_NAME = "family_members_national_id_normalized_unique";

export const FAMILY_NATIONAL_ID_INDEX_QUERY = `
  SELECT
    index_class.relname AS index_name,
    index_info.indisunique AS is_unique,
    index_info.indisvalid AS is_valid,
    index_info.indisready AS is_ready,
    index_info.indnatts AS attribute_count,
    access_method.amname AS access_method,
    operator_class.opcname AS operator_class,
    pg_get_expr(index_info.indexprs, index_info.indrelid) AS expression,
    pg_get_expr(index_info.indpred, index_info.indrelid) AS predicate
  FROM pg_index AS index_info
  JOIN pg_class AS table_class
    ON table_class.oid = index_info.indrelid
  JOIN pg_namespace AS table_schema
    ON table_schema.oid = table_class.relnamespace
  JOIN pg_class AS index_class
    ON index_class.oid = index_info.indexrelid
  JOIN pg_am AS access_method
    ON access_method.oid = index_class.relam
  JOIN pg_opclass AS operator_class
    ON operator_class.oid = index_info.indclass[0]
  WHERE table_schema.nspname = 'public'
    AND table_class.relname = 'family_members'
    AND index_class.relname = $1
`;

export type FamilyNationalIdIndexCatalogRow = {
  index_name: string;
  is_unique: boolean;
  is_valid: boolean;
  is_ready: boolean;
  attribute_count: number;
  access_method: string;
  operator_class: string;
  expression: string | null;
  predicate: string | null;
};

const indexFunctions = new Set(["lower", "btrim"]);

function stripGroupingParentheses(expression: string): string {
  let result = "";
  const functionParentheses: boolean[] = [];
  let inString = false;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (inString) {
      result += character;
      if (character === "'" && expression[index + 1] === "'") {
        result += expression[index + 1];
        index += 1;
      } else if (character === "'") {
        inString = false;
      }
      continue;
    }
    if (character === "'") {
      inString = true;
      result += character;
      continue;
    }
    if (character === "(") {
      const previousWord = result.match(/([a-z_][a-z0-9_$]*)\s*$/)?.[1];
      const isFunctionParenthesis = previousWord ? indexFunctions.has(previousWord) : false;
      functionParentheses.push(isFunctionParenthesis);
      if (isFunctionParenthesis) result += character;
      continue;
    }
    if (character === ")") {
      if (functionParentheses.pop()) result += character;
      continue;
    }
    result += character;
  }
  return result;
}

function normalizeSqlExpression(expression: string): string {
  let normalized = "";
  let inString = false;
  let index = 0;
  while (index < expression.length) {
    const character = expression[index];
    if (inString) {
      normalized += character;
      if (character === "'" && expression[index + 1] === "'") {
        normalized += expression[index + 1];
        index += 2;
        continue;
      }
      if (character === "'") inString = false;
      index += 1;
      continue;
    }
    if (character === "'") {
      inString = true;
      normalized += character;
      index += 1;
      continue;
    }
    if (character === '"') {
      let identifier = "";
      index += 1;
      while (index < expression.length) {
        if (expression[index] === '"' && expression[index + 1] === '"') {
          identifier += '"';
          index += 2;
          continue;
        }
        if (expression[index] === '"') {
          index += 1;
          break;
        }
        identifier += expression[index];
        index += 1;
      }
      normalized += identifier.toLowerCase();
      continue;
    }
    if (/\s/.test(character)) {
      if (!normalized.endsWith(" ")) normalized += " ";
      index += 1;
      continue;
    }
    normalized += character.toLowerCase();
    index += 1;
  }
  return stripGroupingParentheses(normalized
    .replace(/::(?:pg_catalog\.)?(?:text|character varying|varchar)\b/g, "")
    .replace(/\bpg_catalog\./g, "")
    .replace(/\b(?:public\.)?family_members\./g, "")
    .trim());
}

function stripOuterParentheses(expression: string): string {
  let value = expression.trim();
  while (value.startsWith("(") && value.endsWith(")")) {
    let depth = 0;
    let inString = false;
    let wrapsWholeExpression = true;
    for (let index = 0; index < value.length; index += 1) {
      const character = value[index];
      if (inString) {
        if (character === "'" && value[index + 1] === "'") {
          index += 1;
          continue;
        }
        if (character === "'") inString = false;
        continue;
      }
      if (character === "'") inString = true;
      else if (character === "(") depth += 1;
      else if (character === ")") {
        depth -= 1;
        if (depth === 0 && index !== value.length - 1) {
          wrapsWholeExpression = false;
          break;
        }
      }
    }
    if (!wrapsWholeExpression) break;
    value = value.slice(1, -1).trim();
  }
  return value;
}

function splitTopLevelAnd(expression: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  let inString = false;
  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (inString) {
      if (character === "'" && expression[index + 1] === "'") {
        index += 1;
        continue;
      }
      if (character === "'") inString = false;
      continue;
    }
    if (character === "'") inString = true;
    else if (character === "(") depth += 1;
    else if (character === ")") depth -= 1;
    else if (
      depth === 0 &&
      expression.slice(index, index + 3) === "and" &&
      (index === 0 || /\s/.test(expression[index - 1])) &&
      (index + 3 === expression.length || /\s/.test(expression[index + 3]))
    ) {
      parts.push(expression.slice(start, index).trim());
      start = index + 3;
      index += 2;
    }
  }
  if (!parts.length) return [expression];
  parts.push(expression.slice(start).trim());
  return parts;
}

function normalizePredicate(predicate: string): string {
  const unwrapped = stripOuterParentheses(normalizeSqlExpression(predicate));
  const parts = splitTopLevelAnd(unwrapped);
  if (parts.length === 1) return stripOuterParentheses(parts[0]);
  return parts.map(normalizePredicate).sort().join(" and ");
}

const expectedExpression = normalizeSqlExpression(
  "lower(btrim(national_id))",
);
const expectedPredicate = normalizePredicate(
  "national_id IS NOT NULL AND btrim(national_id) <> ''",
);

export function isExpectedFamilyNationalIdIndex(
  row: FamilyNationalIdIndexCatalogRow,
): boolean {
  return row.index_name === FAMILY_NATIONAL_ID_INDEX_NAME
    && row.is_unique
    && row.is_valid
    && row.is_ready
    && Number(row.attribute_count) === 1
    && row.access_method === "btree"
    && row.operator_class === "text_ops"
    && row.expression !== null
    && normalizeSqlExpression(row.expression) === expectedExpression
    && row.predicate !== null
    && normalizePredicate(row.predicate) === expectedPredicate;
}

export function assertFamilyNationalIdIndex(
  rows: readonly FamilyNationalIdIndexCatalogRow[],
): void {
  if (!rows.some(isExpectedFamilyNationalIdIndex)) {
    throw new Error(
      `Database schema is not ready: public.${FAMILY_NATIONAL_ID_INDEX_NAME} must be a valid unique btree index on the normalized national ID expression with its nonblank-ID predicate. Apply the reviewed family national-ID index migration before starting the API.`,
    );
  }
}