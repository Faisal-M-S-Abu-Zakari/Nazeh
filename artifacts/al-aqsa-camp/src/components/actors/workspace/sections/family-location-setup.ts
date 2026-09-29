export type LocationIdempotencyAttempt = { input: string; key: string };

export function getLocationIdempotencyAttempt(
  input: string,
  current: LocationIdempotencyAttempt | null,
  createKey: () => string,
): LocationIdempotencyAttempt {
  return current?.input === input ? current : { input, key: createKey() };
}