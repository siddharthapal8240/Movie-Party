"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "./socket";
import { ICE_SERVERS } from "./constants";

export function useScreenShare(roomId: string, isHost: boolean) {
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState<MediaStream | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [hostIsSharing, setHostIsSharing] = useState(false);

  const screenStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // Host: create a peer connection for a viewer and send the screen stream
  const sendScreenTo = useCallback(async (viewerId: string) => {
    if (!screenStreamRef.current) return;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current.set(viewerId, pc);

    screenStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, screenStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket.emit("screen-ice-candidate", { to: viewerId, candidate: event.candidate.toJSON() });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const socket = getSocket();
    socket.emit("screen-offer", { to: viewerId, offer });
  }, []);

  // Host: start sharing screen
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsSharing(true);

      const socket = getSocket();
      socket.emit("screen-share-status", { roomId, active: true });

      // When host stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Failed to start screen share:", err);
    }
  }, [roomId]);

  // Host: stop sharing screen
  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setScreenStream(null);
    setIsSharing(false);

    // Close all peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    const socket = getSocket();
    socket.emit("screen-share-status", { roomId, active: false });
  }, [roomId]);

  useEffect(() => {
    const socket = getSocket();

    if (isHost) {
      // Host: when a viewer requests the screen, send it
      socket.on("send-screen-to", ({ viewerId }: { viewerId: string }) => {
        sendScreenTo(viewerId);
      });
    }

    // Viewer: handle incoming screen share offer from host
    socket.on("screen-offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionsRef.current.set(from, pc);

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        setRemoteScreenStream(stream);
        setHostIsSharing(true);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("screen-ice-candidate", { to: from, candidate: event.candidate.toJSON() });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("screen-answer", { to: from, answer });
    });

    socket.on("screen-answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on("screen-ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionsRef.current.get(from);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socket.on("screen-share-status", ({ active }: { active: boolean }) => {
      setHostIsSharing(active);
      if (!active) {
        setRemoteScreenStream(null);
        // Close screen-related peer connections
        peerConnectionsRef.current.forEach((pc) => pc.close());
        peerConnectionsRef.current.clear();
      }
    });

    return () => {
      socket.off("send-screen-to");
      socket.off("screen-offer");
      socket.off("screen-answer");
      socket.off("screen-ice-candidate");
      socket.off("screen-share-status");
      screenStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerConnectionsRef.current.forEach((pc) => pc.close());
    };
  }, [isHost, sendScreenTo]);

  // Viewer: request screen stream when host is sharing
  const requestScreenStream = useCallback(() => {
    const socket = getSocket();
    socket.emit("request-screen-share", { roomId });
  }, [roomId]);

  return {
    screenStream,       // Host's local screen stream (for preview)
    remoteScreenStream, // Viewer's received screen stream
    isSharing,          // Host is sharing
    hostIsSharing,      // Viewer knows host is sharing
    startScreenShare,
    stopScreenShare,
    requestScreenStream,
  };
}
