const STORAGE_KEY = "mp-sessions";

interface RoomSession {
  token: string;
  displayName: string;
  role: "host" | "viewer";
}

type SessionMap = Record<string, RoomSession>;

function getAllSessions(): SessionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistSessions(sessions: SessionMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getSession(roomId: string): RoomSession | null {
  const sessions = getAllSessions();
  return sessions[roomId] || null;
}

export function saveSession(roomId: string, session: RoomSession) {
  const sessions = getAllSessions();
  sessions[roomId] = session;
  persistSessions(sessions);
}

export function clearSession(roomId: string) {
  const sessions = getAllSessions();
  delete sessions[roomId];
  persistSessions(sessions);
}
