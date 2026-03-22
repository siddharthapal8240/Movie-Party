"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSocket } from "./socket";
import { ICE_SERVERS } from "./constants";

interface PeerState {
  id: string;
  name: string;
  stream: MediaStream | null;
  connection: RTCPeerConnection;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export function useWebRTC(roomId: string) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const [inCall, setInCall] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);

  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);

  const createPeerConnection = useCallback((peerId: string, peerName: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Add local tracks to the connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket.emit("webrtc-ice-candidate", {
          to: peerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      peersRef.current.set(peerId, {
        ...peersRef.current.get(peerId)!,
        stream: remoteStream,
      });
      setPeers(new Map(peersRef.current));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        removePeer(peerId);
      }
    };

    const peerState: PeerState = {
      id: peerId,
      name: peerName,
      stream: null,
      connection: pc,
      audioEnabled: true,
      videoEnabled: true,
    };

    peersRef.current.set(peerId, peerState);
    setPeers(new Map(peersRef.current));

    return pc;
  }, []);

  const removePeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId);
    if (peer) {
      peer.connection.close();
      peersRef.current.delete(peerId);
      setPeers(new Map(peersRef.current));
    }
  }, []);

  const joinCall = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setInCall(true);

      const socket = getSocket();

      // Set up signaling listeners
      socket.on("webrtc-offer", async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
        const pc = createPeerConnection(from, "Peer");
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", { to: from, answer });
      });

      socket.on("webrtc-answer", async ({ from, answer }: { from: string; answer: RTCSessionDescriptionInit }) => {
        const peer = peersRef.current.get(from);
        if (peer) {
          await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socket.on("webrtc-ice-candidate", async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
        const peer = peersRef.current.get(from);
        if (peer) {
          await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socket.on("webrtc-media-toggle", ({ peerId, kind, enabled }: { peerId: string; name: string; kind: "audio" | "video"; enabled: boolean }) => {
        const peer = peersRef.current.get(peerId);
        if (peer) {
          if (kind === "audio") peer.audioEnabled = enabled;
          if (kind === "video") peer.videoEnabled = enabled;
          peersRef.current.set(peerId, { ...peer });
          setPeers(new Map(peersRef.current));
        }
      });

      // Request existing peers and connect to them
      socket.emit("webrtc-get-peers", { roomId });

      socket.on("webrtc-peers", async ({ peers: existingPeers }: { peers: { id: string; name: string }[] }) => {
        for (const { id, name } of existingPeers) {
          const pc = createPeerConnection(id, name);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc-offer", { to: id, offer });
        }
      });
    } catch (err) {
      console.error("Failed to join call:", err);
    }
  }, [roomId, createPeerConnection]);

  const leaveCall = useCallback(() => {
    // Stop local tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);

    // Close all peer connections
    peersRef.current.forEach((peer) => peer.connection.close());
    peersRef.current.clear();
    setPeers(new Map());

    setInCall(false);
    setCameraOn(true);
    setMicOn(true);

    // Remove signaling listeners
    const socket = getSocket();
    socket.off("webrtc-offer");
    socket.off("webrtc-answer");
    socket.off("webrtc-ice-candidate");
    socket.off("webrtc-peers");
    socket.off("webrtc-media-toggle");
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!localStreamRef.current) return;
    const socket = getSocket();

    if (cameraOn) {
      // Stop the video track to release the camera hardware
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
        localStreamRef.current.removeTrack(videoTrack);
      }
      setCameraOn(false);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      socket.emit("webrtc-media-toggle", { roomId, kind: "video", enabled: false });
    } else {
      // Re-acquire camera
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = newStream.getVideoTracks()[0];
        localStreamRef.current.addTrack(newVideoTrack);

        // Replace video track on all peer connections
        peersRef.current.forEach((peer) => {
          const sender = peer.connection.getSenders().find((s) => s.track?.kind === "video" || (!s.track && s.replaceTrack));
          if (sender) {
            sender.replaceTrack(newVideoTrack);
          } else {
            peer.connection.addTrack(newVideoTrack, localStreamRef.current!);
          }
        });

        setCameraOn(true);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        socket.emit("webrtc-media-toggle", { roomId, kind: "video", enabled: true });
      } catch (err) {
        console.error("Failed to re-acquire camera:", err);
      }
    }
  }, [roomId, cameraOn]);

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicOn(audioTrack.enabled);
      const socket = getSocket();
      socket.emit("webrtc-media-toggle", { roomId, kind: "audio", enabled: audioTrack.enabled });
    }
  }, [roomId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach((peer) => peer.connection.close());
    };
  }, []);

  return {
    localStream,
    peers,
    inCall,
    cameraOn,
    micOn,
    joinCall,
    leaveCall,
    toggleCamera,
    toggleMic,
  };
}
