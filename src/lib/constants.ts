export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export type SourceType = "file" | "youtube" | "vimeo" | "dailymotion" | "gdrive" | "url" | "screen";

export interface ChatMessage {
  sender: string;
  message: string;
  timestamp: number;
}
