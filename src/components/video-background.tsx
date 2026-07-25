"use client";

import { useEffect, useRef } from "react";

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const applyFilter = () => {
      video.style.filter = "brightness(0.69) grayscale(1) invert(1)";
    };

    if (video.readyState >= 2) {
      applyFilter();
    }

    video.addEventListener("loadeddata", applyFilter);
    return () => {
      video.removeEventListener("loadeddata", applyFilter);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0">
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          style={{
            width: "100%",
            height: "100%",
            minWidth: "100%",
            minHeight: "100%",
            objectFit: "cover",
            transform: "scale(1.3) translateY(-100px)",
            backgroundColor: "hsl(var(--background))",
            objectPosition: "center bottom",
            filter: "brightness(0) grayscale(1) invert(1)",
            transition: "filter 0.5s ease-in-out",
          }}
        >
          <source src="/videos/orbiting-sphere.mp4" type="video/mp4" />
          Seu navegador não suporta vídeos em HTML5.
        </video>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-card via-card/92 to-emerald-50/35" />
    </div>
  );
}
