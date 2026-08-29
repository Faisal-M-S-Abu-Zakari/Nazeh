export const canonicalIdToNumber = (id: string): number => {
  const numeric = Number(id);
  if (Number.isSafeInteger(numeric) && numeric > 0) return numeric;
  return Math.abs(
    Array.from(id).reduce(
      (value, character) => ((value * 31) + character.charCodeAt(0)) | 0,
      7,
    ),
  ) || 1;
};