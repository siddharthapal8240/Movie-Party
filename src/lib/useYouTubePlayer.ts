"use client";

import { useEffect, useRef } from "react";

interface UseYouTubePlayerOptions {
  sourceType: string;
  videoUrl: string;
  ready: boolean;
  onStateChange: (action: "play" | "pause", time: number) => void;
  ignoreNextEvent: React.MutableRefObject<boolean>;
}

export function useYouTubePlayer({ sourceType, videoUrl, ready, onStateChange, ignoreNextEvent }: UseYouTubePlayerOptions) {
  const ytPlayerRef = useRef<any>(null);

  useEffect(() => {
    if (sourceType !== "youtube" || !videoUrl || !ready) return;

    if (!(window as any).YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }

    const initPlayer = () => {
      if (ytPlayerRef.current) return;
      ytPlayerRef.current = new (window as any).YT.Player("yt-player", {
        width: "100%",
        height: "100%",
        videoId: videoUrl,
        playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
        events: {
          onStateChange: (event: any) => {
            if (ignoreNextEvent.current) return;
            const YT = (window as any).YT;
            const time = event.target.getCurrentTime();
            if (event.data === YT.PlayerState.PLAYING) onStateChange("play", time);
            else if (event.data === YT.PlayerState.PAUSED) onStateChange("pause", time);
          },
        },
      });
    };

    if ((window as any).YT && (window as any).YT.Player) initPlayer();
    else (window as any).onYouTubeIframeAPIReady = initPlayer;

    return () => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === "function") {
        ytPlayerRef.current.destroy();
        ytPlayerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, videoUrl, ready]);

  return ytPlayerRef;
}
