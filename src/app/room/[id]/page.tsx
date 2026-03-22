"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useWebRTC } from "@/lib/useWebRTC";
import { useScreenShare } from "@/lib/useScreenShare";
import { useRoomSocket } from "@/lib/useRoomSocket";
import { useYouTubePlayer } from "@/lib/useYouTubePlayer";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PeerVideo } from "@/components/PeerVideo";
import { ControlButton } from "@/components/ControlButton";
import { StatusScreen } from "@/components/StatusScreen";
import { MicIcon, CameraIcon, ChatIcon, PeopleIcon, ShareIcon, PhoneOffIcon, FullscreenIcon, CheckIcon, ScreenShareIcon, CloseIcon, SendIcon } from "@/components/icons";

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const displayName = searchParams.get("name") || "Guest";

  const videoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [chatInput, setChatInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activePanel, setActivePanel] = useState<"chat" | "people" | null>(null);

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
  const toggleFullscreen = () => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); };

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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg-primary">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border-primary bg-bg-primary px-4 py-2.5 md:px-6">
        <div className="flex items-center gap-3">
          <a href="/" className="text-base font-semibold text-text-primary">Movie Party</a>
          <div className="h-4 w-px bg-border-primary" />
          <span className="rounded-md bg-bg-tertiary px-2.5 py-0.5 text-xs text-text-secondary font-mono">{roomId}</span>
          {room.isHost && <span className="rounded-md bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-text">Host</span>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">{room.viewers.length} watching</span>
          <ThemeToggle />
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Peer strip */}
          {inCall && (
            <div className="flex flex-shrink-0 gap-2 overflow-x-auto bg-bg-secondary px-3 py-2 border-b border-border-primary relative z-10">
              <div className="w-20 flex-shrink-0 md:w-32 lg:w-40">
                <PeerVideo stream={localStream} name="You" muted audioEnabled={micOn} videoEnabled={cameraOn} />
              </div>
              {peerArray.map((peer) => (
                <div key={peer.id} className="w-20 flex-shrink-0 md:w-32 lg:w-40">
                  <PeerVideo stream={peer.stream} name={peer.name} audioEnabled={peer.audioEnabled} videoEnabled={peer.videoEnabled} />
                </div>
              ))}
              {peerArray.length === 0 && <div className="flex items-center px-3 text-xs text-text-tertiary">Waiting for others to join the call...</div>}
            </div>
          )}

          {/* Player */}
          <div className="flex flex-1 min-h-0 items-center justify-center bg-black overflow-hidden">
            {room.sourceType === "screen" ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {(room.isHost && isScreenSharing) || (!room.isHost && hostIsSharing) ? (
                  <video ref={screenVideoRef} autoPlay playsInline muted={room.isHost} className="max-h-full max-w-full" />
                ) : room.isHost ? (
                  <div className="flex flex-col items-center gap-4 text-center p-8">
                    <svg className="h-16 w-16 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <p className="text-lg font-semibold text-white">Ready to share your screen</p>
                    <p className="text-sm text-gray-400 max-w-md">Open Netflix, Hotstar, or any app, then click below.</p>
                    <button onClick={startScreenShare} className="mt-2 rounded-lg bg-accent px-8 py-3 font-medium text-white hover:bg-accent-hover transition flex items-center gap-2">
                      <ScreenShareIcon />
                      Start Screen Share
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-center p-8">
                    <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gray-600 border-t-accent" />
                    <p className="text-lg font-semibold text-white">Waiting for host to share screen...</p>
                  </div>
                )}
              </div>
            ) : room.sourceType === "youtube" ? (
              <div className="w-full h-full flex items-center justify-center"><div id="yt-player" className="w-full max-w-[1280px] aspect-video" /></div>
            ) : room.sourceType === "vimeo" ? (
              <div className="w-full h-full flex items-center justify-center"><iframe src={`https://player.vimeo.com/video/${room.videoUrl}?autoplay=0&title=0&byline=0&portrait=0`} className="w-full h-full max-w-[1280px] aspect-video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen /></div>
            ) : room.sourceType === "dailymotion" ? (
              <div className="w-full h-full flex items-center justify-center"><iframe src={`https://www.dailymotion.com/embed/video/${room.videoUrl}`} className="w-full h-full max-w-[1280px] aspect-video" allow="autoplay; fullscreen" allowFullScreen /></div>
            ) : room.sourceType === "gdrive" ? (
              <div className="w-full h-full flex items-center justify-center"><iframe src={`https://drive.google.com/file/d/${room.videoUrl}/preview`} className="w-full h-full max-w-[1280px] aspect-video" allow="autoplay" allowFullScreen /></div>
            ) : (
              <video ref={videoRef} src={room.sourceType === "url" ? room.videoUrl : `/api/stream/${roomId}`} controls className="max-h-full max-w-full"
                onPlay={() => handleVideoEvent("play")} onPause={() => handleVideoEvent("pause")} onSeeked={() => handleVideoEvent("seek")}
                {...(room.sourceType === "url" ? { crossOrigin: "anonymous" as const } : {})} />
            )}
          </div>
        </div>

        {/* Side Panel */}
        {activePanel && (
          <>
            <div className="fixed inset-0 z-30 bg-overlay md:hidden" onClick={() => setActivePanel(null)} />
            <div className="fixed right-0 top-0 bottom-0 z-40 flex w-80 flex-col border-l border-border-primary bg-bg-primary animate-slide-in md:relative md:z-auto md:w-80 lg:w-96 md:animate-none">
              <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
                <h3 className="text-sm font-semibold text-text-primary">{activePanel === "chat" ? "Chat" : "People"}</h3>
                <button onClick={() => setActivePanel(null)} className="rounded-full p-1.5 text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition">
                  <CloseIcon />
                </button>
              </div>

              {activePanel === "chat" ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
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
                  <div className="border-t border-border-primary p-3">
                    <div className="flex gap-2">
                      <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Send a message..."
                        className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-3 py-2.5 text-sm text-text-primary placeholder-text-tertiary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition" />
                      <button onClick={handleSendMessage} className="rounded-lg bg-accent px-4 py-2.5 text-white hover:bg-accent-hover transition">
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
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-subtle text-sm font-bold text-accent-text">{v.charAt(0).toUpperCase()}</div>
                          <p className="flex-1 text-sm text-text-primary truncate min-w-0">{v}</p>
                          {i === 0 && <span className="rounded-md bg-accent-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-text">Host</span>}
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

      {/* Control Bar */}
      <div className="flex items-center justify-center border-t border-border-primary bg-bg-primary px-4 py-3">
        <div className="flex items-center gap-2 md:gap-3">
          {inCall ? (
            <ControlButton onClick={toggleMic} label={micOn ? "Mute" : "Unmute"}>
              <div className={micOn ? "" : "text-danger"}><MicIcon on={micOn} /></div>
            </ControlButton>
          ) : (
            <ControlButton onClick={joinCall} label="Join Call"><MicIcon on={true} /></ControlButton>
          )}
          {inCall && (
            <ControlButton onClick={toggleCamera} label={cameraOn ? "Stop Video" : "Start Video"}>
              <div className={cameraOn ? "" : "text-danger"}><CameraIcon on={cameraOn} /></div>
            </ControlButton>
          )}
          <div className="h-8 w-px bg-border-primary mx-1" />
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
          <ControlButton onClick={toggleFullscreen} label="Fullscreen"><FullscreenIcon /></ControlButton>
          {inCall && (<><div className="h-8 w-px bg-border-primary mx-1" /><ControlButton onClick={leaveCall} danger label="Leave Call"><PhoneOffIcon /></ControlButton></>)}
        </div>
      </div>
    </div>
  );
}
