import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { clsx } from "clsx";

export interface MenuOption {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface ThreeDotMenuProps {
  options: MenuOption[];
  /** "white" for overlay on dark video, "zinc" for card header */
  iconColor?: "white" | "zinc";
  align?: "right" | "left";
  /** "down" opens below the button (default), "up" opens above */
  direction?: "down" | "up";
}

export default function ThreeDotMenu({ options, iconColor = "zinc", align = "right", direction = "down" }: ThreeDotMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className={clsx(
          "p-1.5 rounded-full transition-colors",
          iconColor === "white"
            ? "text-white hover:bg-white/15"
            : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
        )}
      >
        <MoreHorizontal size={20} />
      </button>

      {open && (
        <div
          className={clsx(
            "absolute z-50 min-w-40 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden py-1",
            direction === "up" ? "bottom-full mb-1" : "top-full mt-1",
            align === "right" ? "right-0" : "left-0"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => { opt.onClick(); setOpen(false); }}
              className={clsx(
                "w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-800",
                opt.danger ? "text-red-400 hover:text-red-300" : "text-zinc-100"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
