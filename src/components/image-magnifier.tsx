"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import React from "react";

export default function ImageMagnifier({
  src,
  width,
  height,
  magnifierHeight = 200,
  magnifieWidth = 200,
  zoomLevel = 2,
  className = "",
  alt = "Product",
}: {
  src: string;
  width?: string;
  height?: string;
  magnifierHeight?: number;
  magnifieWidth?: number;
  zoomLevel?: number;
  className?: string;
  alt?: string;
}) {
  const [[x, y], setXY] = useState([0, 0]);
  const [[_imgWidth, _imgHeight], setSize] = useState([0, 0]);
  const [showMagnifier, setShowMagnifier] = useState(false);
  const [[naturalWidth, naturalHeight], setNaturalSize] = useState([0, 0]);
  const imgRef = useRef<HTMLImageElement>(null);

  const updateZoomPosition = useCallback(
    (e: MouseEvent) => {
      const elem = imgRef.current;
      if (!elem) return;

      const rect = elem.getBoundingClientRect();

      const imageAspectRatio = naturalWidth / naturalHeight;
      const containerAspectRatio = rect.width / rect.height;

      let actualWidth = rect.width;
      let actualHeight = rect.height;
      let imageX = 0;
      let imageY = 0;

      if (imageAspectRatio > containerAspectRatio) {
        actualHeight = rect.width / imageAspectRatio;
        imageY = (rect.height - actualHeight) / 2;
      } else {
        actualWidth = rect.height * imageAspectRatio;
        imageX = (rect.width - actualWidth) / 2;
      }

      const x = e.clientX - rect.left - imageX;
      const y = e.clientY - rect.top - imageY;

      const boundedX = Math.max(0, Math.min(x, actualWidth));
      const boundedY = Math.max(0, Math.min(y, actualHeight));

      setXY([boundedX, boundedY]);
      setSize([actualWidth, actualHeight]);
    },
    [naturalWidth, naturalHeight],
  );

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const handleLoad = () => {
      setNaturalSize([img.naturalWidth, img.naturalHeight]);
    };

    const handleMouseMove = (e: MouseEvent) => {
      updateZoomPosition(e);
    };

    const handleMouseEnter = (e: MouseEvent) => {
      setShowMagnifier(true);
      updateZoomPosition(e);
    };

    const handleMouseLeave = () => {
      setShowMagnifier(false);
    };

    if (img.complete) {
      handleLoad();
    } else {
      img.addEventListener("load", handleLoad);
    }

    img.addEventListener("mouseenter", handleMouseEnter);
    img.addEventListener("mousemove", handleMouseMove);
    img.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      img.removeEventListener("load", handleLoad);
      img.removeEventListener("mouseenter", handleMouseEnter);
      img.removeEventListener("mousemove", handleMouseMove);
      img.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [updateZoomPosition]);

  const [scaling, setScaling] = React.useState({ scaleX: 1, scaleY: 1 });

  useEffect(() => {
    const updateScaling = () => {
      if (!imgRef.current) return;
      const { width, height } = imgRef.current.getBoundingClientRect();
      const scaleX = width && naturalWidth ? naturalWidth / width : 1;
      const scaleY = height && naturalHeight ? naturalHeight / height : 1;
      setScaling({ scaleX, scaleY });
    };

    updateScaling();

    window.addEventListener("resize", updateScaling);
    return () => {
      window.removeEventListener("resize", updateScaling);
    };
  }, [naturalWidth, naturalHeight]);

  const { scaleX, scaleY } = scaling;

  return (
    <div
      style={{
        position: "relative",
        height: height,
        width: width,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "10px", // Ensure the border radius is applied
        overflow: "hidden", // Clip the content within the rounded corners
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <img
          ref={imgRef}
          src={src || "/placeholder.svg"}
          style={{
            display: "block",
            margin: "auto",
            maxHeight: "100%",
            maxWidth: "100%",
            objectFit: "contain",
            objectPosition: "center",
          }}
          className={className}
          alt={alt}
        />
      </div>

      <div
        style={{
          display: showMagnifier ? "" : "none",
          position: "absolute",
          pointerEvents: "none",
          height: `${magnifierHeight}px`,
          width: `${magnifieWidth}px`,
          top: `${y - magnifierHeight / 2 + 100}px`,
          left: `${x - magnifieWidth / 2}px`,
          opacity: "1",
          border: "1px solid lightgray",
          backgroundImage: `url('${src}')`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${naturalWidth * zoomLevel}px ${
            naturalHeight * zoomLevel
          }px`,
          backgroundPosition: `${
            -x * scaleX * zoomLevel + magnifieWidth / 2
          }px ${-y * scaleY * zoomLevel + magnifierHeight / 2}px`,
          borderRadius: "10px",
          zIndex: 10,
        }}
      />
    </div>
  );
}
