export type AuthLifecyclePort = {
  getToken: () => string | null;
  setToken: (token: string) => void;
  clearToken: () => void;
  clearQueries: () => void;
  navigate: (path: string) => void;
};

/** Small browser-independent seam used by the web auth UI and lifecycle tests. */
export const createAuthLifecycle = (port: AuthLifecyclePort) => ({
  restore: () => port.getToken(),
  login: (token: string, destination: string) => {
    port.clearQueries();
    port.setToken(token);
    port.navigate(destination);
  },
  logout: (destination: string) => {
    port.clearToken();
    port.clearQueries();
    port.navigate(destination);
  },
  unauthorized: (pathname: string, loginPath: string) => {
    port.clearToken();
    port.clearQueries();
    if (!pathname.includes(loginPath)) port.navigate(loginPath);
  },
  synchronizedRefresh: async (refresh: () => Promise<unknown>) => {
    if (!port.getToken()) return false;
    await refresh();
    return true;
  },
});