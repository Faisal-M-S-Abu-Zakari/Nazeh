import { LOCALSTORAGE_SESSION_KEY } from "@/constants/sessionKey"
import { AUTH_ROUTES } from "@/constants/routes"

export const logout = async () => {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } finally {
    localStorage.removeItem(LOCALSTORAGE_SESSION_KEY);
    window.location.href = AUTH_ROUTES.LOGIN;
  }
}
