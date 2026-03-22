"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getSocket, disconnectSocket } from "./socket";
import { getSession, saveSession } from "./sessionStore";
import type { SourceType, ChatMessage } from "./constants";

interface VideoSyncData {
  action: "play" | "pause" | "seek";
  currentTime: number;
}

export interface Viewer {
  name: string;
  avatar: string;
  verified: boolean;
  isHost: boolean;
}

interface RoomState {
  connected: boolean;
  isHost: boolean;
  viewers: Viewer[];
  messages: ChatMessage[];
  sourceType: SourceType;
  videoUrl: string;
  movieReady: boolean;
  isOpen: boolean;
  inWaitingRoom: boolean;
  rejected: boolean;
  waitingUsers: { id: string; name: string }[];
}

interface UseRoomSocketOptions {
  roomId: string;
  displayName: string;
  onVideoSync: (data: VideoSyncData) => void;
  onRoomReady?: (state: { sourceType: SourceType; videoUrl: string; videoState: any }) => void;
}

export function useRoomSocket({ roomId, displayName, onVideoSync, onRoomReady }: UseRoomSocketOptions) {
  const [state, setState] = useState<RoomState>({
    connected: false,
    isHost: false,
    viewers: [],
    messages: [],
    sourceType: "file",
    videoUrl: "",
    movieReady: false,
    isOpen: true,
    inWaitingRoom: false,
    rejected: false,
    waitingUsers: [],
  });

  const ignoreNextEvent = useRef(false);

  useEffect(() => {
    const socket = getSocket();

    const joinRoom = () => {
      setState((s) => ({ ...s, connected: true }));
      const stored = getSession(roomId);
      socket.emit("join-room", { roomId, displayName, token: stored?.token });
    };

    socket.on("connect", joinRoom);
    socket.on("room-state", (roomState: any) => {
      if (roomState.token) {
        saveSession(roomId, { token: roomState.token, displayName, role: roomState.isHost ? "host" : "viewer" });
      }
      setState((s) => ({
        ...s, isHost: roomState.isHost, viewers: roomState.viewers, isOpen: roomState.isOpen,
        sourceType: roomState.sourceType || "file", videoUrl: roomState.videoUrl || "",
        inWaitingRoom: false, movieReady: true,
      }));
      onRoomReady?.({ sourceType: roomState.sourceType, videoUrl: roomState.videoUrl, videoState: roomState.videoState });
    });
    socket.on("viewer-update", (data: any) => {
      setState((s) => ({
        ...s, viewers: data.viewers,
        messages: data.message ? [...s.messages, { sender: "System", message: data.message, timestamp: Date.now() }] : s.messages,
      }));
    });
    socket.on("waiting-room", () => setState((s) => ({ ...s, inWaitingRoom: true })));
    socket.on("rejected", () => setState((s) => ({ ...s, rejected: true, inWaitingRoom: false })));
    socket.on("waiting-room-update", (data: { waiting: { id: string; name: string }[] }) => setState((s) => ({ ...s, waitingUsers: data.waiting })));
    socket.on("room-access-changed", (data: { isOpen: boolean }) => setState((s) => ({ ...s, isOpen: data.isOpen })));
    socket.on("video-sync", (data: VideoSyncData) => {
      ignoreNextEvent.current = true;
      onVideoSync(data);
      setTimeout(() => { ignoreNextEvent.current = false; }, 500);
    });
    socket.on("chat-message", (msg: ChatMessage) => setState((s) => ({ ...s, messages: [...s.messages, msg] })));
    socket.on("error", (err: any) => console.error("Socket error:", err.message));

    if (socket.connected) joinRoom();

    return () => {
      socket.off("connect", joinRoom);
      socket.removeAllListeners("room-state");
      socket.removeAllListeners("viewer-update");
      socket.removeAllListeners("waiting-room");
      socket.removeAllListeners("rejected");
      socket.removeAllListeners("waiting-room-update");
      socket.removeAllListeners("room-access-changed");
      socket.removeAllListeners("video-sync");
      socket.removeAllListeners("chat-message");
      socket.removeAllListeners("error");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const sendMessage = useCallback((message: string) => {
    if (!message.trim()) return;
    getSocket().emit("chat-message", { roomId, message: message.trim() });
  }, [roomId]);

  const emitVideoAction = useCallback((action: "play" | "pause" | "seek", currentTime: number) => {
    if (ignoreNextEvent.current) return;
    getSocket().emit("video-action", { roomId, action, currentTime });
  }, [roomId]);

  const admitUser = useCallback((userId: string) => {
    getSocket().emit("admit-user", { roomId, userId });
  }, [roomId]);

  const rejectUser = useCallback((userId: string) => {
    getSocket().emit("reject-user", { roomId, userId });
  }, [roomId]);

  const admitAll = useCallback(() => {
    getSocket().emit("admit-all", { roomId });
  }, [roomId]);

  const toggleRoomAccess = useCallback(() => {
    setState((s) => ({ ...s, isOpen: !s.isOpen }));
    getSocket().emit("toggle-room-access", { roomId });
  }, [roomId]);

  return {
    ...state,
    ignoreNextEvent,
    sendMessage,
    emitVideoAction,
    admitUser,
    rejectUser,
    admitAll,
    toggleRoomAccess,
  };
}
