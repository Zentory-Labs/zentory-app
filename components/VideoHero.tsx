"use client";

import { useRef, useEffect } from "react";

interface VideoHeroProps {
  children: React.ReactNode;
  className?: string;
}

export function VideoHero({ children, className = "" }: VideoHeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      // Autoplay blocked — show paused frame
    });
  }, []);

  return (
    <div
      className={`relative min-h-screen overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
    >
      {/* Video — covers only this section */}
      <video
        ref={videoRef}
        src="/hero_bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover object-center"
      />

      {/* Dark overlay — very dark so hero blends into page background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(11,11,13,0.82) 0%, rgba(11,11,13,0.78) 50%, rgba(11,11,13,0.92) 100%)",
        }}
      />

      {/* Subtle vignette at edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 90% 90% at 50% 50%, transparent 40%, rgba(11,11,13,0.5) 100%)",
        }}
      />

      {/* Content — fills viewport */}
      <div className="relative z-10 flex flex-col items-stretch justify-center min-h-screen min-h-[100dvh] px-6">
        {children}
      </div>
    </div>
  );
}
