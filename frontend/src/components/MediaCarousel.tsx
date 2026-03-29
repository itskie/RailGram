import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MediaCarouselProps {
  mediaKeys: string[];
}

export default function MediaCarousel({ mediaKeys }: MediaCarouselProps) {
  const [index, setIndex] = useState(0);

  const next = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (index < mediaKeys.length - 1) setIndex(index + 1);
  };

  const prev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (index > 0) setIndex(index - 1);
  };

  if (!mediaKeys.length) return null;

  return (
    <div className="relative w-full aspect-square bg-zinc-950 overflow-hidden group">
      {/* Index Badge */}
      {mediaKeys.length > 1 && (
        <div className="absolute top-3 right-3 z-10 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full text-[10px] font-black text-white/90 border border-white/10">
          {index + 1} / {mediaKeys.length}
        </div>
      )}

      {/* Main Slider */}
      <div className="relative w-full h-full touch-pan-y">
        <AnimatePresence initial={false} mode="wait">
          <motion.img
            key={mediaKeys[index]}
            src={`/api/v1/media/${mediaKeys[index]}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full h-full object-cover select-none"
            alt=""
            draggable={false}
          />
        </AnimatePresence>
      </div>

      {/* Navigation Buttons (Desktop/Hover) */}
      {mediaKeys.length > 1 && (
        <>
          {index > 0 && (
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 backdrop-blur-sm border border-white/10"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {index < mediaKeys.length - 1 && (
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/60 backdrop-blur-sm border border-white/10"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </>
      )}

      {/* Pagination Dots */}
      {mediaKeys.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {mediaKeys.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === index ? "w-4 bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" : "w-1 bg-white/30"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
