"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "@/components/UserMenu";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/AuthContext";
import { saveSession } from "@/lib/sessionStore";
import { SERVER_URL } from "@/lib/socket";

type SourceTab = "upload" | "link" | "screen";

export default function Home() {
  const router = useRouter();
  const { user, token: authToken, logout } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "";
  const [joinCode, setJoinCode] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sourceTab, setSourceTab] = useState<SourceTab>("upload");
  const [videoUrl, setVideoUrl] = useState("");
  const [creatingLink, setCreatingLink] = useState(false);

  const isLoggedIn = !!user;

  const handleAuthError = (msg: string) => {
    if (msg.includes("token") || msg.includes("log in") || msg.includes("Authentication")) {
      logout();
      setError("Session expired. Please log in again.");
    } else {
      setError(msg);
    }
  };

  const handleCreateRoom = async () => {
    if (!isLoggedIn) { setError("Please log in to create a room"); return; }
    if (sourceTab === "upload") {
      if (!selectedFile) { setError("Please select a movie file"); return; }
      await handleUploadRoom();
    } else if (sourceTab === "link") {
      if (!videoUrl.trim()) { setError("Please paste a video URL"); return; }
      await handleLinkRoom();
    } else {
      await handleScreenRoom();
    }
  };

  const handleUploadRoom = async () => {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("movie", selectedFile!);
      formData.append("hostName", displayName);
      formData.append("isOpen", String(isOpen));
      const xhr = new XMLHttpRequest();
      const response = await new Promise<{ roomId: string; hostToken: string }>((resolve, reject) => {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
            if (pct === 100) setProcessing(true);
          }
        };
        xhr.onload = () => xhr.status === 200 ? resolve(JSON.parse(xhr.responseText)) : reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.open("POST", `${SERVER_URL}/api/rooms`);
        xhr.withCredentials = true;
        if (authToken) xhr.setRequestHeader("Authorization", `Bearer ${authToken}`);
        xhr.send(formData);
      });
      saveSession(response.roomId, { token: response.hostToken, displayName, role: "host" });
      router.push(`/room/${response.roomId}?name=${encodeURIComponent(displayName)}`);
    } catch (err: any) {
      handleAuthError(err.message || "Failed to create room");
      setUploading(false);
      setProcessing(false);
      setUploadProgress(0);
    }
  };

  const handleLinkRoom = async () => {
    setCreatingLink(true);
    setError("");
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ hostName: displayName, videoUrl: videoUrl.trim(), isOpen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room");
      saveSession(data.roomId, { token: data.hostToken, displayName, role: "host" });
      router.push(`/room/${data.roomId}?name=${encodeURIComponent(displayName)}`);
    } catch (err: any) {
      handleAuthError(err.message);
      setCreatingLink(false);
    }
  };

  const handleScreenRoom = async () => {
    setCreatingLink(true);
    setError("");
    try {
      const res = await fetch(`${SERVER_URL}/api/rooms/screen`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ hostName: displayName, isOpen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create room");
      saveSession(data.roomId, { token: data.hostToken, displayName, role: "host" });
      router.push(`/room/${data.roomId}?name=${encodeURIComponent(displayName)}`);
    } catch (err: any) {
      handleAuthError(err.message);
      setCreatingLink(false);
    }
  };

  const handleJoinRoom = () => {
    if (!joinCode.trim()) { setError("Please enter a room code"); return; }
    // If logged in, pass name in URL for auto-join; otherwise room's JoinGate will handle it
    if (isLoggedIn) {
      router.push(`/room/${joinCode.trim()}?name=${encodeURIComponent(displayName)}`);
    } else {
      router.push(`/room/${joinCode.trim()}`);
    }
  };

  return (
    <div className="relative flex flex-1 flex-col min-h-screen bg-bg-primary">
      {/* Processing overlay */}
      {(uploading || creatingLink) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-border-primary bg-bg-elevated p-10 shadow-lg max-w-sm w-full mx-4">
            {creatingLink ? (
              <>
                <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-border-primary border-t-accent" />
                <div className="text-center">
                  <p className="text-base font-semibold text-text-primary">Creating your room...</p>
                  <p className="text-sm text-text-secondary mt-1">Setting up video link</p>
                </div>
              </>
            ) : processing ? (
              <>
                <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-border-primary border-t-accent" />
                <div className="text-center">
                  <p className="text-base font-semibold text-text-primary">Setting up your room...</p>
                  <p className="text-sm text-text-secondary mt-1">Processing your movie file</p>
                </div>
              </>
            ) : (
              <>
                <div className="relative h-14 w-14">
                  <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                    <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border-primary)" strokeWidth="3.5" />
                    <circle cx="28" cy="28" r="24" fill="none" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 24}`}
                      strokeDashoffset={`${2 * Math.PI * 24 * (1 - uploadProgress / 100)}`}
                      className="transition-all duration-300" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-accent-text">{uploadProgress}%</span>
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-text-primary">Uploading movie...</p>
                  <p className="text-sm text-text-secondary mt-1">{selectedFile && `${(selectedFile.size / (1024 * 1024)).toFixed(0)} MB`}</p>
                </div>
              </>
            )}
            <div className="w-full h-1 overflow-hidden rounded-full bg-bg-tertiary">
              <div className={`h-full rounded-full bg-accent transition-all duration-300 ${processing || creatingLink ? "animate-pulse" : ""}`}
                style={{ width: processing || creatingLink ? "100%" : `${uploadProgress}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-border-primary px-5 py-3 md:px-8">
        <div className="flex items-center gap-2">
          <svg className="h-6 w-6 text-accent" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2v12h16V6H4zm2 2l5 3.5L6 15V8z" />
          </svg>
          <span className="text-lg font-semibold text-text-primary">Movie Party</span>
        </div>
        <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserMenu />
          </div>
      </nav>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 md:py-16">
        <div className="flex w-full max-w-5xl flex-col items-center gap-12 md:flex-row md:items-start md:gap-16">
          {/* Hero */}
          <div className="flex-1 text-center md:text-left md:pt-8">
            <h1 className="text-4xl font-bold tracking-tight text-text-primary md:text-5xl">
              Watch movies{" "}
              <span className="text-accent-text">together</span>
            </h1>
            <p className="mt-4 text-lg text-text-secondary leading-relaxed max-w-md mx-auto md:mx-0">
              Upload a movie or paste a link, invite friends, and enjoy perfectly synced playback with video calls and live chat.
            </p>

            {/* Feature pills */}
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              {[
                { icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z", label: "Synced Playback" },
                { icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z", label: "Video Calls" },
                { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", label: "Live Chat" },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-2 rounded-full bg-bg-tertiary px-4 py-2">
                  <svg className="h-4 w-4 text-accent-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={f.icon} />
                  </svg>
                  <span className="text-sm font-medium text-text-secondary">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Card */}
          <div className="w-full max-w-md rounded-2xl border border-border-primary bg-bg-primary p-6 shadow-lg md:p-8">
            {/* User identity */}
            {isLoggedIn ? (
              <div className="flex items-center gap-3 rounded-lg bg-bg-secondary px-4 py-3">
                <Avatar avatar={user!.avatar} firstName={user!.firstName} lastName={user!.lastName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">{displayName}</p>
                  <p className="text-xs text-text-tertiary truncate">{user!.email}</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-center">
                <p className="text-sm text-text-secondary">
                  <a href="/login" className="text-accent-text font-medium hover:underline">Log in</a> to create a room
                </p>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-danger">{error}</p>}

            {/* Tabs */}
            <div className="mt-5 flex rounded-lg bg-bg-secondary p-1">
              {([
                { key: "upload" as SourceTab, label: "Upload", icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" },
                { key: "link" as SourceTab, label: "Link", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
                { key: "screen" as SourceTab, label: "Screen", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setSourceTab(tab.key); setError(""); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    sourceTab === tab.key
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                  }`}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                  </svg>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="mt-5">
              {sourceTab === "upload" && (
                <>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-primary p-7 transition-colors hover:border-accent hover:bg-accent-subtle"
                  >
                    {selectedFile ? (
                      <>
                        <svg className="mb-2 h-7 w-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <p className="text-sm font-medium text-text-primary truncate max-w-full">{selectedFile.name}</p>
                        <p className="text-xs text-text-tertiary mt-1">{(selectedFile.size / (1024 * 1024)).toFixed(0)} MB</p>
                      </>
                    ) : (
                      <>
                        <svg className="mb-2 h-9 w-9 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-sm text-text-secondary">Click to select a movie file</p>
                        <p className="text-xs text-text-tertiary mt-1">MP4, WebM, MKV</p>
                      </>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="video/*" className="hidden"
                    onChange={(e) => { setSelectedFile(e.target.files?.[0] || null); setError(""); }} />
                </>
              )}

              {sourceTab === "link" && (
                <div>
                  <input type="url" placeholder="Paste YouTube or video URL"
                    value={videoUrl}
                    onChange={(e) => { setVideoUrl(e.target.value); setError(""); }}
                    className="w-full rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder-text-tertiary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                  />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[
                      { name: "YouTube", cls: "bg-danger-subtle text-danger" },
                      { name: "Vimeo", cls: "bg-accent-subtle text-accent-text" },
                      { name: "Dailymotion", cls: "bg-accent-subtle text-accent-text" },
                      { name: "Google Drive", cls: "bg-success-subtle text-success" },
                      { name: "Direct URL", cls: "bg-bg-tertiary text-text-secondary" },
                    ].map((p) => (
                      <span key={p.name} className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${p.cls}`}>{p.name}</span>
                    ))}
                  </div>
                  {videoUrl && /netflix|hotstar|primevideo|amazon.*video|disneyplus|hulu|hbo|peacock|paramount/i.test(videoUrl) && (
                    <div className="mt-3 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2">
                      <p className="text-xs font-medium text-warning">Not supported</p>
                      <p className="text-[11px] text-text-secondary mt-0.5">This platform uses DRM. Use the Screen tab to share instead.</p>
                    </div>
                  )}
                </div>
              )}

              {sourceTab === "screen" && (
                <div className="rounded-xl border border-border-primary bg-bg-secondary p-6 text-center">
                  <svg className="mx-auto mb-3 h-10 w-10 text-accent-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium text-text-primary">Share Your Screen</p>
                  <p className="mt-1 text-xs text-text-secondary leading-relaxed">
                    Play any movie from Netflix, Hotstar, Prime Video, or any app.
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {["Netflix", "Hotstar", "Prime Video", "Disney+", "Any App"].map((name) => (
                      <span key={name} className="rounded-md bg-accent-subtle px-2 py-0.5 text-[10px] font-medium text-accent-text">{name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Access toggle */}
            <div className="mt-5 flex items-center justify-between rounded-lg border border-border-primary bg-bg-secondary px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text-primary">{isOpen ? "Open Session" : "Private Room"}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{isOpen ? "Anyone with link joins" : "You approve who enters"}</p>
              </div>
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${isOpen ? "bg-success" : "bg-text-tertiary"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 mt-0.5 transform rounded-full bg-white shadow transition duration-200 ${isOpen ? "translate-x-[22px]" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* Create */}
            <button
              onClick={handleCreateRoom}
              disabled={uploading || creatingLink || !isLoggedIn}
              className="mt-5 w-full rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggedIn ? "Create Room" : "Log in to Create Room"}
            </button>
            {!isLoggedIn && (
              <p className="mt-2 text-center text-xs text-text-tertiary">
                <a href="/login" className="text-accent-text hover:underline">Log in</a> or <a href="/signup" className="text-accent-text hover:underline">sign up</a> to create rooms
              </p>
            )}

            {/* Divider */}
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-border-primary" />
              <span className="text-xs text-text-tertiary">or join a room</span>
              <div className="flex-1 h-px bg-border-primary" />
            </div>

            {/* Join */}
            <div className="flex gap-2">
              <input type="text" placeholder="Room code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="flex-1 rounded-lg border border-border-primary bg-bg-secondary px-4 py-3 text-sm text-text-primary placeholder-text-tertiary outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
                onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
              />
              <button onClick={handleJoinRoom}
                className="rounded-lg border border-accent px-5 py-3 text-sm font-semibold text-accent-text transition hover:bg-accent-subtle active:scale-[0.98]"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
