import { logout } from "@/utils/auth/logout"
import { getAuthToken } from "@/utils/auth/getSession"
import axios from "axios"

// The web artifact and API server are served behind the same Replit proxy.
// Keeping this relative is important for previews, deployments, and local use.
const baseURL = "/api"


// Create an Axios instance for guest/public requests
const AqsaGuestAPI = axios.create({
  baseURL: baseURL,
  withCredentials: true,
  timeout: 15000, // 15 second timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// Handle guest API response errors (no auth required)
AqsaGuestAPI.interceptors.response.use(
  response => {
    // handel success response
    return response
  },
  error => {
    if (!error.response) {// if no response, return error
      return Promise.reject({
        status: 500,
        error: 'حدث خطأ في الشبكة'
      })
    }

    // For guest API, we don't logout on 401, just return the error
    return Promise.reject(error)
  }
)


// Create an Axios instance
const AqsaAPI = axios.create({
  baseURL: baseURL,
  withCredentials: true,
  timeout: 15000, // 15 second timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// Legacy actor actions use this client while staff authentication uses the
// tab-scoped bearer session. Forward that session so protected detail pages
// do not turn their own data request's 401 into an unexpected logout.
AqsaAPI.interceptors.request.use(config => {
  const token = getAuthToken()
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

// Handle response errors
AqsaAPI.interceptors.response.use(
  response => {
    // handel success response
    return response
  },
  error => {
    if (!error.response) {// if no response, return error
      return Promise.reject({
        status: 500,
        error: 'حدث خطأ في الشبكة'
      })
    }

    if (error.response.status === 401) { // if 401, logout
      void logout()
    }

    return Promise.reject(error)
  }
)

// export default AqsaAPI
export { AqsaGuestAPI, AqsaAPI }