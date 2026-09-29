export function normalizeLocationName(value: string): string | undefined {
  const name = value.trim();
  return name.length > 0 && name.length <= 160 ? name : undefined;
}

export function trimLocationNameInput(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value;
  const body = value as Record<string, unknown>;
  return typeof body.name === "string" ? { ...body, name: body.name.trim() } : value;
}