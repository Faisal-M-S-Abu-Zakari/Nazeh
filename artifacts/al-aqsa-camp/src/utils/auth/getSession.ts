import { LOCALSTORAGE_SESSION_KEY } from "@/constants/sessionKey";
import { z } from "zod";
import { USER_TYPE, USER_RANK } from "@/constants/userTypes";
import { StaticImageData } from '@/lib/nextjs-mocks';
import { User } from "@/@types/auth/loginResponse.type";

// Validate user data including optional fields and complex types
const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  identity: z.string(),
  phone_number: z.string(),
  created_at: z.union([z.string(), z.date()]),
  updated_at: z.union([z.string(), z.date()]).optional(),
  // image: z.union([z.string(), z.instanceof(string), z.null()]).optional(),
  profile_image: z.union([z.string(), z.null()]).optional(),
  role: z.nativeEnum(USER_TYPE),
  rank: z.nativeEnum(USER_RANK).optional(),
});

// Session schema with user nested
const SessionSchema = z.object({
  user: UserSchema,
});


/**
 * Gets the user session from localStorage
 * 
 * Returns the session object containing:
 * - token: The authentication token
 * - user: The user information (id, name, email, etc)
 * 
 * Returns null if:
 * - No session found in localStorage
 * - Session data is invalid
 * - Any error occurs while parsing
 */

export const getSession = (): { user: User } | null => {
  try {
    const rawSession = localStorage.getItem(LOCALSTORAGE_SESSION_KEY);
    if (!rawSession) return null;

    // Parse the session data from localStorage
    const parsedSession = JSON.parse(rawSession);

    // Validate parsed data
    const session = SessionSchema.safeParse(parsedSession);
    if (!session.success) return null;

    // Convert date strings to Date objects
    const user = {
      ...session.data.user,
      created_at: new Date(session.data.user.created_at),
      updated_at: session.data.user.updated_at ? new Date(session.data.user.updated_at) : undefined,
    };

    // Transform the validated data to match the expected return type
    return {
      user,
    };
  } catch {
    return null;
  }
};
