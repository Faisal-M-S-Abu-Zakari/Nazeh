/**
 * Keep the current React state reference when a synchronized cache snapshot
 * has the same persisted values. Cache data is JSON-serializable by design.
 */
export function preserveSnapshotIdentity<T extends object>(current: T, next: T): T {
  return JSON.stringify(current) === JSON.stringify(next) ? current : next;
}