"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWebRTC } from "@/lib/useWebRTC";
import { useScreenShare } from "@/lib/useScreenShare";
import { useRoomSocket } from "@/lib/useRoomSocket";
import { useYouTubePlayer } from "@/lib/useYouTubePlayer";
import { getSession } from "@/lib/sessionStore";
import { useAuth } from "@/lib/AuthContext";
import { SERVER_URL, disconnectSocket } from "@/lib/socket";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PeerVideo } from "@/components/PeerVideo";
import { ControlButton } from "@/components/ControlButton";
import { StatusScreen } from "@/components/StatusScreen";
import { Avatar } from "@/components/Avatar";
import { MicIcon, CameraIcon, ChatIcon, PeopleIcon, ShareIcon, PhoneOffIcon, PhoneIcon, FullscreenIcon, CheckIcon, ScreenShareIcon, CloseIcon, SendIcon, LeaveRoomIcon } from "@/components/icons";

type LayoutMode = "theater" | "strip" | "sidebar" | "focus";
const LAYOUT_KEY = "mp-layout-pref";

function LayoutIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M4 9h16M9 9v11" /></svg>;
}

function LayoutPicker({ layout, onChange, isMobile, camSize, onCamSize }: { layout: LayoutMode; onChange: (l: LayoutMode) => void; isMobile: boolean; camSize: number; onCamSize: (s: number) => void }) {
  const [open, setOpen] = useState(false);
  const layouts: { id: LayoutMode; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: "theater", label: "Theater", desc: "Floating cams over movie", icon: (
      <svg viewBox="0 0 40 28" className="w-10 h-7"><rect x="1" y="1" width="38" height="26" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" /><rect x="24" y="14" width="14" height="11" rx="1.5" fill="currentColor" opacity="0.6" /></svg>
    )},
    { id: "strip", label: "Strip", desc: "Cam strip above movie", icon: (
      <svg viewBox="0 0 40 28" className="w-10 h-7"><rect x="1" y="1" width="38" height="26" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" /><rect x="2" y="2" width="36" height="6" rx="1" fill="currentColor" opacity="0.6" /><line x1="14" y1="2" x2="14" y2="8" stroke="currentColor" opacity="0.3" strokeWidth="1" /><line x1="26" y1="2" x2="26" y2="8" stroke="currentColor" opacity="0.3" strokeWidth="1" /></svg>
    )},
    { id: "sidebar", label: "Sidebar", desc: "Cams on the right", icon: (
      <svg viewBox="0 0 40 28" className="w-10 h-7"><rect x="1" y="1" width="38" height="26" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" /><rect x="28" y="2" width="10" height="24" rx="1" fill="currentColor" opacity="0.6" /><line x1="28" y1="14" x2="38" y2="14" stroke="currentColor" opacity="0.3" strokeWidth="1" /></svg>
    )},
    { id: "focus", label: "Focus", desc: "Movie only, hide cams", icon: (
      <svg viewBox="0 0 40 28" className="w-10 h-7"><rect x="1" y="1" width="38" height="26" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" /><path d="M16 10l8 4-8 4V10z" fill="currentColor" opacity="0.5" /></svg>
    )},
  ];

  return (
    <div className="relative">
      <ControlButton onClick={() => setOpen(!open)} active={open} label="Layout"><LayoutIcon /></ControlButton>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 md:bg-transparent" onClick={() => setOpen(false)} />
          {isMobile ? (
            /* Mobile: bottom sheet */
            <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl border-t border-border-primary bg-bg-primary shadow-2xl p-3 pb-[max(12px,env(safe-area-inset-bottom))] animate-slide-up">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border-primary" />
              <p className="px-1 pb-2 text-xs font-semibold text-text-primary">Choose Layout</p>
              <div className="grid grid-cols-2 gap-2">
                {layouts.map((l) => (
                  <button key={l.id} onClick={() => { onChange(l.id); setOpen(false); }}
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 transition ${layout === l.id ? "bg-accent-subtle ring-2 ring-accent text-accent-text" : "bg-bg-secondary text-text-secondary active:bg-surface-hover"}`}>
                    <div className={layout === l.id ? "text-accent-text" : "text-text-tertiary"}>{l.icon}</div>
                    <p className="text-xs font-medium">{l.label}</p>
                  </button>
                ))}
              </div>
              {layout !== "focus" && (
                <div className="mt-3 pt-3 border-t border-border-primary">
                  <p className="px-1 pb-2 text-xs font-semibold text-text-primary">Camera Size</p>
                  <div className="flex items-center gap-3 px-1">
                    <span className="text-[10px] text-text-tertiary w-5">S</span>
                    <div className="flex-1 flex items-center gap-1">
                      {[0, 1, 2].map((s) => (
                        <button key={s} onClick={() => onCamSize(s)}
                          className={`flex-1 h-8 rounded-lg flex items-center justify-center transition ${camSize === s ? "bg-accent text-white" : "bg-bg-secondary text-text-secondary active:bg-surface-hover"}`}>
                          <svg viewBox="0 0 24 16" className={s === 0 ? "w-5 h-3.5" : s === 1 ? "w-6 h-4" : "w-7 h-5"} fill="currentColor" opacity="0.7"><rect x="1" y="1" width="22" height="14" rx="2" /></svg>
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-text-tertiary w-5 text-right">L</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Desktop: dropdown */
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 w-56 rounded-xl border border-border-primary bg-bg-primary shadow-xl p-1.5 animate-fade-in-up">
              <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Layout</p>
              {layouts.map((l) => (
                <button key={l.id} onClick={() => { onChange(l.id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${layout === l.id ? "bg-accent-subtle text-accent-text" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"}`}>
                  <div className={layout === l.id ? "text-accent-text" : "text-text-tertiary"}>{l.icon}</div>
                  <div>
                    <p className="text-xs font-medium">{l.label}</p>
                    <p className="text-[10px] opacity-60">{l.desc}</p>
                  </div>
                </button>
              ))}
              {layout !== "focus" && (
                <div className="mt-1 pt-1.5 border-t border-border-primary px-2.5 pb-1">
                  <p className="text-[10px] font-medium text-text-tertiary mb-1.5">Camera Size</p>
                  <div className="flex items-center gap-1.5">
                    {(["S", "M", "L"] as const).map((label, s) => (
                      <button key={s} onClick={() => onCamSize(s)}
                        className={`flex-1 rounded-md py-1 text-[10px] font-semibold transition ${camSize === s ? "bg-accent text-white" : "bg-bg-tertiary text-text-secondary hover:bg-surface-hover"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function JoinGate({ roomId, onJoin }: { roomId: string; onJoin: (name: string) => void }) {
  const { user, loading } = useAuth();
  const [guestName, setGuestName] = useState("");
  const [error, setError] = useState("");

  if (loading) return <StatusScreen title="Loading..." />;

  const authName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <nav className="flex items-center justify-between border-b border-border-primary px-5 py-3 md:px-8">
        <a href="/" className="flex items-center gap-2">
          <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm2 2l5 3.5L6 15V8z" /></svg>
          <span className="text-lg font-semibold text-text-primary">Movie Party</span>
        </a>
        <ThemeToggle />
      </nav>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-border-primary bg-bg-primary p-6 shadow-lg md:p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-subtle">
            <svg className="h-7 w-7 text-accent-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Join Movie Party</h1>
          <p className="mt-1 text-sm text-text-secondary">Room: <span className="font-mono text-text-primary">{roomId}</span></p>

          {user ? (
            <div className="mt-6">
              <p className="text-sm text-text-secondary">Joining as</p>
              <p className="mt-1 text-lg font-semibold text-text-primary">{authName}</p>
              <button onClick={() => onJoin(authName)}
                className="mt-4 w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98]">
                Join Room
              </button>
            </div>
          ) : (
            <div className="mt-6">
              {error && <p className="mb-3 text-sm text-danger">{error}</p>}
              <input type="text" placeholder="Enter your name" value={guestName} onChange={(e) => { setGuestName(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter" && guestName.trim()) onJoin(guestName.trim()); }}
                className="w-full rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder-text-tertiary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition" />
              <button onClick={() => { if (!guestName.trim()) { setError("Please enter your name"); return; } onJoin(guestName.trim()); }}
                className="mt-3 w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98]">
                Join as Guest
              </button>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-px bg-border-primary" />
                <span className="text-xs text-text-tertiary">or</span>
                <div className="flex-1 h-px bg-border-primary" />
              </div>
              <div className="mt-4 flex gap-3">
                <a href={`/login?redirect=${encodeURIComponent(`/room/${roomId}`)}`}
                  className="flex-1 rounded-lg border border-accent px-4 py-2.5 text-sm font-semibold text-accent-text text-center transition hover:bg-accent-subtle">Log In</a>
                <a href={`/signup?redirect=${encodeURIComponent(`/room/${roomId}`)}`}
                  className="flex-1 rounded-lg border border-border-primary px-4 py-2.5 text-sm font-semibold text-text-secondary text-center transition hover:bg-surface-hover">Sign Up</a>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function RoomPage() {
  return <Suspense><RoomContent /></Suspense>;
}

function RoomContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const nameFromUrl = searchParams.get("name");

  const [joined, setJoined] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [mounted, setMounted] = useState(false);

  // Resolve join state on client only to avoid hydration mismatch
  useEffect(() => {
    const stored = getSession(roomId);
    if (nameFromUrl) {
      setDisplayName(nameFromUrl);
      setJoined(true);
    } else if (stored?.token) {
      setDisplayName(stored.displayName || "Guest");
      setJoined(true);
    }
    setMounted(true);
  }, [roomId, nameFromUrl]);

  if (!mounted) return <StatusScreen title="Loading..." />;

  if (!joined) {
    return <JoinGate roomId={roomId} onJoin={(name) => { setDisplayName(name); setJoined(true); }} />;
  }

  return <RoomView roomId={roomId} displayName={displayName} />;
}

function RotateIcon() {
  return <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
}

function RoomView({ roomId, displayName }: { roomId: string; displayName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [chatInput, setChatInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activePanel, setActivePanel] = useState<"chat" | "people" | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>("theater");
  const [camSize, setCamSize] = useState(1); // 0=small, 1=medium, 2=large
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const pipDragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const pipResizeRef = useRef<{ startDist: number; startSize: number } | null>(null);
  const pipRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Cam size presets (width in px) for each context
  const camSizes = {
    pipMobile: [56, 72, 96],
    pipDesktop: [96, 128, 176],
    stripMobile: [52, 68, 88],
    stripDesktop: [100, 140, 180],
    sidebarMobile: [80, 100, 999], // 999 = full width
    sidebarDesktop: [160, 200, 240],
  };

  const getCamWidth = useCallback((context: "pip" | "strip" | "sidebar") => {
    const key = `${context}${isMobile ? "Mobile" : "Desktop"}` as keyof typeof camSizes;
    const val = camSizes[key][camSize];
    return val === 999 ? "100%" : `${val}px`;
  }, [isMobile, camSize]);

  // Load saved layout + cam size preference
  useEffect(() => {
    const saved = localStorage.getItem(LAYOUT_KEY) as LayoutMode | null;
    if (saved && ["theater", "strip", "sidebar", "focus"].includes(saved)) setLayout(saved);
    const savedSize = localStorage.getItem("mp-cam-size");
    if (savedSize !== null) setCamSize(Math.min(2, Math.max(0, parseInt(savedSize) || 1)));
  }, []);

  const changeLayout = useCallback((l: LayoutMode) => {
    setLayout(l);
    localStorage.setItem(LAYOUT_KEY, l);
  }, []);

  const changeCamSize = useCallback((s: number) => {
    const clamped = Math.min(2, Math.max(0, s));
    setCamSize(clamped);
    localStorage.setItem("mp-cam-size", String(clamped));
  }, []);

  // Detect mobile + orientation
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768 || "ontouchstart" in window);
    const checkOrientation = () => setIsLandscape(window.innerWidth > window.innerHeight);
    checkMobile();
    checkOrientation();
    window.addEventListener("resize", () => { checkMobile(); checkOrientation(); });
    const mql = window.matchMedia("(orientation: landscape)");
    mql.addEventListener("change", checkOrientation);
    return () => { window.removeEventListener("resize", checkMobile); mql.removeEventListener("change", checkOrientation); };
  }, []);

  // Auto-hide controls on mobile after 4 seconds
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    if (isMobile) {
      controlsTimerRef.current = setTimeout(() => {
        if (!activePanel) setControlsVisible(false);
      }, 4000);
    }
  }, [isMobile, activePanel]);

  useEffect(() => { showControls(); }, [showControls]);

  // Lock to landscape on mobile fullscreen
  const goFullscreenLandscape = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen?.();
      if (screen.orientation && "lock" in screen.orientation) {
        await (screen.orientation as any).lock("landscape").catch(() => {});
      }
    } catch {}
  }, []);

  // --- Video sync handlers ---
  const handleVideoSync = useCallback((data: { action: "play" | "pause" | "seek"; currentTime: number }) => {
    const yt = ytPlayerRef.current;
    if (yt && typeof yt.seekTo === "function") {
      yt.seekTo(data.currentTime, true);
      if (data.action === "play") yt.playVideo();
      else if (data.action === "pause") yt.pauseVideo();
    }
    const video = videoRef.current;
    if (video) {
      video.currentTime = data.currentTime;
      if (data.action === "play") video.play().catch(() => {});
      else if (data.action === "pause") video.pause();
    }
  }, []);

  const handleRoomReady = useCallback((state: { sourceType: string; videoUrl: string; videoState: any }) => {
    if ((state.sourceType === "file" || !state.sourceType) && videoRef.current && state.videoState) {
      videoRef.current.currentTime = state.videoState.currentTime;
      if (state.videoState.playing) videoRef.current.play().catch(() => {});
    }
  }, []);

  // --- Hooks ---
  const room = useRoomSocket({ roomId, displayName, onVideoSync: handleVideoSync, onRoomReady: handleRoomReady });
  const { localStream, peers, inCall, cameraOn, micOn, joinCall, leaveCall, toggleCamera, toggleMic } = useWebRTC(roomId);
  const { screenStream, remoteScreenStream, isSharing: isScreenSharing, hostIsSharing, startScreenShare, stopScreenShare, requestScreenStream } = useScreenShare(roomId, room.isHost);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

  const ytPlayerRef = useYouTubePlayer({
    sourceType: room.sourceType,
    videoUrl: room.videoUrl,
    ready: room.movieReady,
    onStateChange: (action, time) => room.emitVideoAction(action, time),
    ignoreNextEvent: room.ignoreNextEvent,
  });

  // --- Screen share video binding ---
  useEffect(() => {
    const stream = room.isHost ? screenStream : remoteScreenStream;
    if (screenVideoRef.current && stream) screenVideoRef.current.srcObject = stream;
  }, [screenStream, remoteScreenStream, room.isHost]);

  useEffect(() => {
    if (!room.isHost && room.sourceType === "screen" && room.movieReady) requestScreenStream();
  }, [room.isHost, room.sourceType, room.movieReady, requestScreenStream]);

  // --- Chat scroll + unread ---
  useEffect(() => {
    if (activePanel !== "chat" && room.messages.length > 0) setUnreadCount((prev) => prev + 1);
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.messages]);

  // --- Helpers ---
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/room/${roomId}?name=` : "";
  const copyLink = useCallback(() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }, [shareUrl]);
  const togglePanel = useCallback((panel: "chat" | "people") => {
    setActivePanel((prev) => { if (prev === panel) return null; if (panel === "chat") setUnreadCount(0); return panel; });
  }, []);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) goFullscreenLandscape();
    else { document.exitFullscreen?.(); if (screen.orientation && "unlock" in screen.orientation) (screen.orientation as any).unlock?.(); }
  };
  const leaveRoom = () => { disconnectSocket(); window.location.href = "/"; };

  const handleVideoEvent = useCallback((action: "play" | "pause" | "seek") => {
    const currentTime = videoRef.current?.currentTime ?? 0;
    room.emitVideoAction(action, currentTime);
  }, [room.emitVideoAction]);

  const handleSendMessage = () => { room.sendMessage(chatInput); setChatInput(""); };

  // --- Status screens ---
  if (room.rejected) return (
    <StatusScreen icon="rejected" title="Request Declined" subtitle="The host didn&apos;t let you in this time."
      action={<a href="/" className="mt-4 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition">Back to Home</a>} />
  );
  if (room.inWaitingRoom) return <StatusScreen title="Waiting Room" subtitle="Hang tight — the host will let you in shortly." />;
  if (!room.connected || !room.movieReady) return <StatusScreen title="Connecting to room..." />;

  const peerArray = Array.from(peers.values());

  // Adapt layout for mobile constraints
  // - Portrait mobile: sidebar → strip (not enough horizontal space)
  // - Landscape mobile: sidebar works fine
  const effectiveLayout: LayoutMode = (() => {
    if (!inCall) return layout;
    if (layout === "sidebar" && isMobile && !isLandscape) return "strip";
    return layout;
  })();

  const mobileHideHeader = isMobile && isLandscape;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg-primary" onClick={isMobile ? showControls : undefined}>
      {/* Header — hidden on mobile landscape */}
      {!mobileHideHeader && (
        <header className="flex items-center justify-between border-b border-border-primary bg-bg-primary px-3 py-2 md:px-6 md:py-2.5">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <a href="/" className="text-sm md:text-base font-semibold text-text-primary shrink-0">Movie Party</a>
            <div className="h-4 w-px bg-border-primary" />
            <span className="rounded-md bg-bg-tertiary px-2 py-0.5 text-[10px] md:text-xs text-text-secondary font-mono truncate">{roomId}</span>
            {room.isHost && <span className="rounded-md bg-accent-subtle px-1.5 md:px-2 py-0.5 text-[9px] md:text-[10px] font-semibold uppercase tracking-wider text-accent-text shrink-0">Host</span>}
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <span className="text-[10px] md:text-xs text-text-tertiary">{room.viewers.length} watching</span>
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div className={`flex flex-1 overflow-hidden ${effectiveLayout === "sidebar" && inCall ? "flex-row" : "flex-col"}`}>
          {/* Strip layout — cam strip on top */}
          {inCall && effectiveLayout === "strip" && (
            <div className={`flex flex-shrink-0 gap-1.5 md:gap-2 overflow-x-auto bg-bg-secondary px-2 md:px-3 py-1.5 md:py-2 border-b border-border-primary relative z-10 ${mobileHideHeader ? "py-1" : ""}`}>
              <div className="flex-shrink-0" style={{ width: getCamWidth("strip") }}>
                <PeerVideo stream={localStream} name="You" muted audioEnabled={micOn} videoEnabled={cameraOn} />
              </div>
              {peerArray.map((peer) => (
                <div key={peer.id} className="flex-shrink-0" style={{ width: getCamWidth("strip") }}>
                  <PeerVideo stream={peer.stream} name={peer.name} audioEnabled={peer.audioEnabled} videoEnabled={peer.videoEnabled} />
                </div>
              ))}
              {peerArray.length === 0 && <div className="flex items-center px-2 text-[10px] md:text-xs text-text-tertiary">Waiting for others...</div>}
            </div>
          )}

          {/* Player */}
          <div className="flex flex-1 min-h-0 items-center justify-center bg-black overflow-hidden relative" onClick={isMobile ? showControls : undefined}>
            {/* Theater layout — floating PiP cams */}
            {inCall && effectiveLayout === "theater" && (
              <div ref={pipRef}
                className={`absolute z-20 flex gap-1 md:gap-1.5 rounded-lg md:rounded-xl bg-black/70 backdrop-blur-sm p-1 md:p-1.5 shadow-2xl
                  ${isMobile && isLandscape ? "flex-col max-h-[80%] overflow-y-auto" : "flex-row max-w-[85%] overflow-x-auto"}`}
                style={pipPos ? { bottom: "auto", right: "auto", top: Math.max(4, Math.min(pipPos.y, window.innerHeight - 80)), left: Math.max(4, Math.min(pipPos.x, window.innerWidth - 80)) } : isMobile && isLandscape ? { top: 8, right: 8 } : { bottom: isMobile ? 8 : 16, right: isMobile ? 6 : 16 }}
                onTouchStart={(e) => {
                  if (e.touches.length === 2) {
                    // Pinch start
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    pipResizeRef.current = { startDist: Math.hypot(dx, dy), startSize: camSize };
                    return;
                  }
                  const touch = e.touches[0];
                  const el = pipRef.current;
                  if (!el) return;
                  const rect = el.getBoundingClientRect();
                  pipDragRef.current = { startX: touch.clientX, startY: touch.clientY, origX: rect.left, origY: rect.top };
                }}
                onTouchMove={(e) => {
                  if (e.touches.length === 2 && pipResizeRef.current) {
                    // Pinch resize
                    e.preventDefault();
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const dist = Math.hypot(dx, dy);
                    const ratio = dist / pipResizeRef.current.startDist;
                    if (ratio > 1.3 && pipResizeRef.current.startSize < 2) { changeCamSize(pipResizeRef.current.startSize + 1); pipResizeRef.current.startDist = dist; pipResizeRef.current.startSize += 1; }
                    else if (ratio < 0.7 && pipResizeRef.current.startSize > 0) { changeCamSize(pipResizeRef.current.startSize - 1); pipResizeRef.current.startDist = dist; pipResizeRef.current.startSize -= 1; }
                    return;
                  }
                  if (!pipDragRef.current) return;
                  e.preventDefault();
                  const touch = e.touches[0];
                  const dx = touch.clientX - pipDragRef.current.startX;
                  const dy = touch.clientY - pipDragRef.current.startY;
                  const newX = Math.max(4, Math.min(pipDragRef.current.origX + dx, window.innerWidth - 80));
                  const newY = Math.max(4, Math.min(pipDragRef.current.origY + dy, window.innerHeight - 60));
                  setPipPos({ x: newX, y: newY });
                }}
                onTouchEnd={() => { pipDragRef.current = null; pipResizeRef.current = null; }}
              >
                <div className="flex-shrink-0" style={{ width: getCamWidth("pip") }}>
                  <PeerVideo stream={localStream} name="You" muted audioEnabled={micOn} videoEnabled={cameraOn} />
                </div>
                {peerArray.map((peer) => (
                  <div key={peer.id} className="flex-shrink-0" style={{ width: getCamWidth("pip") }}>
                    <PeerVideo stream={peer.stream} name={peer.name} audioEnabled={peer.audioEnabled} videoEnabled={peer.videoEnabled} />
                  </div>
                ))}
              </div>
            )}
            {room.sourceType === "screen" ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {(room.isHost && isScreenSharing) || (!room.isHost && hostIsSharing) ? (
                  <video ref={screenVideoRef} autoPlay playsInline muted={room.isHost} className="max-h-full max-w-full object-contain" />
                ) : room.isHost ? (
                  <div className="flex flex-col items-center gap-3 md:gap-4 text-center p-4 md:p-8">
                    <svg className="h-12 w-12 md:h-16 md:w-16 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <p className="text-base md:text-lg font-semibold text-white">Ready to share your screen</p>
                    <p className="text-xs md:text-sm text-gray-400 max-w-md">Open Netflix, Hotstar, or any app, then click below.</p>
                    <button onClick={startScreenShare} className="mt-1 md:mt-2 rounded-lg bg-accent px-6 md:px-8 py-2.5 md:py-3 text-sm font-medium text-white hover:bg-accent-hover transition flex items-center gap-2">
                      <ScreenShareIcon />
                      Start Screen Share
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center p-4 md:p-8">
                    <div className="h-8 w-8 md:h-10 md:w-10 animate-spin rounded-full border-[3px] border-gray-600 border-t-accent" />
                    <p className="text-base md:text-lg font-semibold text-white">Waiting for host to share screen...</p>
                  </div>
                )}
              </div>
            ) : room.sourceType === "youtube" ? (
              <div className="w-full h-full flex items-center justify-center"><div id="yt-player" className="w-full h-full max-w-[1280px]" /></div>
            ) : room.sourceType === "vimeo" ? (
              <div className="w-full h-full flex items-center justify-center"><iframe src={`https://player.vimeo.com/video/${room.videoUrl}?autoplay=0&title=0&byline=0&portrait=0`} className="w-full h-full max-w-[1280px] aspect-video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
            ) : room.sourceType === "dailymotion" ? (
              <div className="w-full h-full flex items-center justify-center"><iframe src={`https://www.dailymotion.com/embed/video/${room.videoUrl}`} className="w-full h-full max-w-[1280px] aspect-video" allow="autoplay; fullscreen" allowFullScreen /></div>
            ) : room.sourceType === "gdrive" ? (
              <div className="w-full h-full flex items-center justify-center"><iframe src={`https://drive.google.com/file/d/${room.videoUrl}/preview`} className="w-full h-full max-w-[1280px] aspect-video" allow="autoplay" allowFullScreen /></div>
            ) : (
              <video ref={videoRef} src={room.sourceType === "url" ? room.videoUrl : `${SERVER_URL}/api/stream/${roomId}`} controls playsInline
                className="max-h-full max-w-full w-full object-contain"
                onPlay={() => handleVideoEvent("play")} onPause={() => handleVideoEvent("pause")} onSeeked={() => handleVideoEvent("seek")}
                {...(room.sourceType === "url" ? { crossOrigin: "anonymous" as const } : {})} />
            )}

            {/* Mobile landscape: rotate hint */}
            {isMobile && !isLandscape && !inCall && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-white text-xs animate-fade-in-up">
                <RotateIcon />
                <span>Rotate for fullscreen</span>
              </div>
            )}
          </div>

          {/* Sidebar layout — cam grid on the right */}
          {inCall && effectiveLayout === "sidebar" && (
            <div className="flex flex-col gap-1.5 overflow-y-auto bg-bg-secondary border-l border-border-primary p-1.5"
              style={{ width: getCamWidth("sidebar") === "100%" ? (isMobile ? "120px" : "220px") : `calc(${getCamWidth("sidebar")} + 12px)` }}>
              <div className="w-full">
                <PeerVideo stream={localStream} name="You" muted audioEnabled={micOn} videoEnabled={cameraOn} />
              </div>
              {peerArray.map((peer) => (
                <div key={peer.id} className="w-full">
                  <PeerVideo stream={peer.stream} name={peer.name} audioEnabled={peer.audioEnabled} videoEnabled={peer.videoEnabled} />
                </div>
              ))}
              {peerArray.length === 0 && <p className="text-center text-[10px] text-text-tertiary py-4">Waiting for others...</p>}
            </div>
          )}
        </div>

        {/* Side Panel */}
        {activePanel && (
          <>
            <div className="fixed inset-0 z-30 bg-overlay md:hidden" onClick={() => setActivePanel(null)} />
            <div className={`fixed z-40 flex flex-col border-l border-border-primary bg-bg-primary animate-slide-in md:relative md:z-auto md:w-80 lg:w-96 md:animate-none
              ${isMobile && isLandscape ? "left-0 top-0 bottom-0 w-72 border-l-0 border-r border-border-primary" : "right-0 top-0 bottom-0 w-80"}`}>
              <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
                <h3 className="text-sm font-semibold text-text-primary">{activePanel === "chat" ? "Chat" : "People"}</h3>
                <button onClick={() => setActivePanel(null)} className="rounded-full p-1.5 text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition">
                  <CloseIcon />
                </button>
              </div>

              {activePanel === "chat" ? (
                <>
                  <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-2">
                    {room.messages.length === 0 && <p className="text-center text-xs text-text-tertiary pt-8">No messages yet. Say hi!</p>}
                    {room.messages.map((msg, i) => (
                      <div key={i} className={`animate-fade-in-up ${msg.sender === "System" ? "text-center" : ""}`}>
                        {msg.sender === "System" ? (
                          <p className="text-[11px] text-text-tertiary italic">{msg.message}</p>
                        ) : (
                          <div className="rounded-lg bg-bg-secondary px-3 py-2">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold text-accent-text">{msg.sender}</span>
                              <span className="text-[10px] text-text-tertiary">{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                            <p className="text-sm text-text-primary mt-0.5 leading-relaxed">{msg.message}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="border-t border-border-primary p-2 md:p-3">
                    <div className="flex gap-2">
                      <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Send a message..."
                        className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2 md:py-2.5 text-sm text-text-primary placeholder-text-tertiary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition" />
                      <button onClick={handleSendMessage} className="rounded-lg bg-accent px-3 md:px-4 py-2 md:py-2.5 text-white hover:bg-accent-hover transition">
                        <SendIcon />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 overflow-y-auto">
                  {room.isHost && (
                    <div className="border-b border-border-primary px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-text-primary">{room.isOpen ? "Open Session" : "Private Room"}</p>
                          <p className="text-[10px] text-text-tertiary mt-0.5">{room.isOpen ? "Anyone with link joins" : "You approve who enters"}</p>
                        </div>
                        <button onClick={room.toggleRoomAccess} className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${room.isOpen ? "bg-success" : "bg-text-tertiary"}`}>
                          <span className={`pointer-events-none inline-block h-4 w-4 mt-0.5 transform rounded-full bg-white shadow transition duration-200 ${room.isOpen ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>
                    </div>
                  )}

                  {room.isHost && room.waitingUsers.length > 0 && (
                    <div className="border-b border-border-primary px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-warning">Waiting ({room.waitingUsers.length})</p>
                        <button onClick={room.admitAll} className="text-[10px] font-medium text-accent-text hover:text-text-primary transition">Admit All</button>
                      </div>
                      <div className="space-y-1">
                        {room.waitingUsers.map((user) => (
                          <div key={user.id} className="flex items-center gap-2 rounded-lg bg-warning-subtle px-3 py-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-warning/20 text-xs font-bold text-warning">{user.name.charAt(0).toUpperCase()}</div>
                            <p className="flex-1 text-sm text-text-primary truncate">{user.name}</p>
                            <button onClick={() => room.admitUser(user.id)} className="rounded-md bg-success px-2.5 py-1 text-[10px] font-medium text-white hover:bg-success/80 transition">Admit</button>
                            <button onClick={() => room.rejectUser(user.id)} className="rounded-md bg-bg-tertiary px-2.5 py-1 text-[10px] font-medium text-text-secondary hover:bg-danger-subtle hover:text-danger transition">Deny</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="px-4 py-3">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary mb-2">In Room ({room.viewers.length})</p>
                    <div className="space-y-0.5">
                      {room.viewers.map((v, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-hover transition">
                          <Avatar avatar={v.avatar} firstName={v.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm text-text-primary truncate">{v.name}</p>
                              {v.verified ? (
                                <svg className="h-3.5 w-3.5 text-accent-text flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <span className="text-[9px] text-text-tertiary flex-shrink-0">Guest</span>
                              )}
                            </div>
                          </div>
                          {v.isHost && <span className="rounded-md bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-text">Host</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Control Bar — auto-hides on mobile, compact in landscape */}
      <div className={`flex flex-shrink-0 items-center justify-center border-t border-border-primary bg-bg-primary transition-all duration-300
        ${mobileHideHeader ? "px-2 py-1" : "px-3 md:px-4 py-2 md:py-3"}
        ${isMobile && !controlsVisible && !activePanel ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"}`}>
        <div className={`flex items-center ${mobileHideHeader ? "gap-1" : "gap-1.5 md:gap-3"}`}>
          {/* Call controls */}
          {inCall ? (
            <>
              <ControlButton onClick={toggleMic} label={micOn ? "Mute" : "Unmute"}>
                <div className={micOn ? "" : "text-danger"}><MicIcon on={micOn} /></div>
              </ControlButton>
              <ControlButton onClick={toggleCamera} label={cameraOn ? "Stop Video" : "Start Video"}>
                <div className={cameraOn ? "" : "text-danger"}><CameraIcon on={cameraOn} /></div>
              </ControlButton>
              <ControlButton onClick={leaveCall} danger label="End Call"><PhoneOffIcon /></ControlButton>
            </>
          ) : (
            <ControlButton onClick={joinCall} label="Join Call">
              <PhoneIcon />
            </ControlButton>
          )}

          <div className={`w-px bg-border-primary mx-0.5 md:mx-1 ${mobileHideHeader ? "h-6" : "h-8"}`} />

          {/* Room controls */}
          <ControlButton onClick={copyLink} active={copied} label={copied ? "Copied!" : "Invite"}>
            {copied ? <CheckIcon /> : <ShareIcon />}
          </ControlButton>
          <ControlButton onClick={() => togglePanel("chat")} active={activePanel === "chat"} label="Chat" badge={activePanel !== "chat" ? unreadCount : 0}><ChatIcon /></ControlButton>
          <ControlButton onClick={() => togglePanel("people")} active={activePanel === "people"} label={`People (${room.viewers.length})`} badge={room.isHost ? room.waitingUsers.length : 0}><PeopleIcon /></ControlButton>
          {room.isHost && room.sourceType === "screen" && (
            <ControlButton onClick={isScreenSharing ? stopScreenShare : startScreenShare} active={isScreenSharing} danger={isScreenSharing} label={isScreenSharing ? "Stop Share" : "Share Screen"}>
              <ScreenShareIcon />
            </ControlButton>
          )}
          {inCall && <LayoutPicker layout={layout} onChange={changeLayout} isMobile={isMobile} camSize={camSize} onCamSize={changeCamSize} />}
          <ControlButton onClick={toggleFullscreen} label="Fullscreen"><FullscreenIcon /></ControlButton>

          <div className={`w-px bg-border-primary mx-0.5 md:mx-1 ${mobileHideHeader ? "h-6" : "h-8"}`} />

          {/* Leave room */}
          <ControlButton onClick={leaveRoom} danger label="Leave Room"><LeaveRoomIcon /></ControlButton>
        </div>
      </div>
    </div>
  );
}
