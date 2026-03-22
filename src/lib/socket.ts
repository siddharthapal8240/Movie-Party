import { io, Socket } from "socket.io-client";
import { getAuth } from "./authStore";

export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:4000";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const auth = getAuth();
    socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      auth: auth ? { jwt: auth.token } : {},
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
