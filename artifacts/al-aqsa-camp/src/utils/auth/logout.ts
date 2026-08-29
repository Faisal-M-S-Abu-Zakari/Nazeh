import { AUTH_ROUTES } from "@/constants/routes"
import { clearAuthToken } from "./getSession"
import { logout as logoutRequest } from "@workspace/api-client-react"
import { queryClient } from "@/providers/react-query-provider"

export const logout = async () => {
  try {
    await logoutRequest()
  } finally {
    clearAuthToken()
    queryClient.clear()
    window.location.href = AUTH_ROUTES.LOGIN
  }
}
