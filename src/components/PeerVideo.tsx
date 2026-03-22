"use client";

import { useEffect, useRef } from "react";

interface PeerVideoProps {
  stream: MediaStream | null;
  name: string;
  muted?: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export function PeerVideo({ stream, name, muted, audioEnabled, videoEnabled }: PeerVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream, videoEnabled]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-bg-tertiary">
      <video ref={ref} autoPlay playsInline muted={muted}
        className={`h-full w-full object-cover ${stream && videoEnabled ? "" : "hidden"}`} />
      {(!stream || !videoEnabled) && (
        <div className="flex h-full w-full items-center justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-subtle text-base font-bold text-accent-text">
            {name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/50 backdrop-blur-sm px-2 py-0.5">
        <span className="text-[10px] text-white leading-none">{name}</span>
        {!audioEnabled && (
          <svg className="h-2.5 w-2.5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        )}
      </div>
    </div>
  );
}
