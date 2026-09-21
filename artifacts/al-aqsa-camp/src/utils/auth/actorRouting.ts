/**
 * Paths inside the nested `/actor` wouter route are relative to that route.
 * Authorization, on the other hand, always operates on canonical full paths.
 */
export function normalizeActorPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || '/';
  if (path === '/actor' || path.startsWith('/actor/')) {
    return path.replace(/\/+$/, '') || '/actor';
  }
  return `/actor${path === '/' ? '' : path.startsWith('/') ? path : `/${path}`}`;
}

export function actorNestedPath(pathname: string): string {
  const normalized = normalizeActorPath(pathname);
  return normalized === '/actor' ? '/' : normalized.slice('/actor'.length);
}