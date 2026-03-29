import React, { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MediaCarouselProps {
  mediaKeys: string[];
  onDoubleTap?: () => void;
}

export default function MediaCarousel({ mediaKeys, onDoubleTap }: MediaCarouselProps) {
  const [index, setIndex] = useState(0);
  const [heartVisible, setHeartVisible] = useState(false);
  const lastTap = useRef(0);

  const next = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (index < mediaKeys.length - 1) setIndex(index + 1);
  };

  const prev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (index > 0) setIndex(index - 1);
  };

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      // double tap
      setHeartVisible(true);
      setTimeout(() => setHeartVisible(false), 800);
      onDoubleTap?.();
    }
    lastTap.current = now;
  };

  if (!mediaKeys.length) return null;

  return (
    <div className="relative w-full bg-black select-none" onClick={handleTap}>
      {/* Dot indicators */}
      {mediaKeys.length > 1 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1 z-20">
          {mediaKeys.map((_, i) => (
            <div
              key={i}
              className={`h-[3px] rounded-full transition-all duration-300 ${
                i === index ? "w-5 bg-white" : "w-[3px] bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      {/* Image */}
      <img
        key={mediaKeys[index]}
        src={`https://dzdr0nfpn0f2c.cloudfront.net/${mediaKeys[index]}`}
        className="w-full h-auto max-h-[600px] object-contain bg-black"
        alt=""
        draggable={false}
      />

      {/* Double-tap heart burst */}
      {heartVisible && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <svg
            viewBox="0 0 24 24"
            fill="white"
            className="w-24 h-24 drop-shadow-2xl animate-ping-once"
            style={{ animation: "heartBurst 0.7s ease-out forwards" }}
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      )}

      {/* Prev / Next arrows */}
      {mediaKeys.length > 1 && (
        <>
          {index > 0 && (
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-opacity z-10"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          {index < mediaKeys.length - 1 && (
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-opacity z-10"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
