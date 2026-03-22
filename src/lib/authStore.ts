const AUTH_KEY = "mp-auth";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatar: string;
}

interface AuthData {
  token: string;
  user: AuthUser;
}

export function getAuth(): AuthData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveAuth(data: AuthData) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

export function clearAuth() {
  localStorage.removeItem(AUTH_KEY);
}

export function getDisplayName(): string {
  const auth = getAuth();
  if (!auth) return "";
  return [auth.user.firstName, auth.user.lastName].filter(Boolean).join(" ");
}
