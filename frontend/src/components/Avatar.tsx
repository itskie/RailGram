/**
 * Shared Avatar component — shows profile image or initials fallback (Instagram-style).
 * Optionally wraps in a link to the user's profile.
 */
import { Link } from "react-router-dom";
import { getOptimizedImageUrl } from "../lib/imageOptimizer";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  username?: string | null;
  size?: number;        // tailwind rem-based size index, e.g. 9 = w-9 h-9
  linkTo?: string;     // if set, wraps in <Link>
  className?: string;
}

const SIZE_MAP: Record<number, string> = {
  6:  "w-6 h-6 text-[9px]",
  8:  "w-8 h-8 text-[10px]",
  9:  "w-9 h-9 text-xs",
  10: "w-10 h-10 text-xs",
  12: "w-12 h-12 text-sm",
  14: "w-14 h-14 text-base",
  16: "w-16 h-16 text-lg",
};

function initials(name?: string | null, username?: string | null): string {
  const source = name || username || "?";
  const parts = source.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

// Deterministic color based on name
const BG_COLORS = [
  "bg-orange-600", "bg-teal-600", "bg-violet-600",
  "bg-blue-600",   "bg-rose-600", "bg-amber-600",
  "bg-emerald-600","bg-pink-600", "bg-cyan-600",
];
function colorFor(name?: string | null): string {
  if (!name) return "bg-zinc-700";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return BG_COLORS[Math.abs(hash) % BG_COLORS.length];
}

export default function Avatar({ src, name, username, size = 9, linkTo, className = "" }: AvatarProps) {
  const sizeClass = SIZE_MAP[size] ?? SIZE_MAP[9];
  const bg = colorFor(name || username);
  const init = initials(name, username);

  const inner = (
    <div
      className={`${sizeClass} rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white ${bg} ${className}`}
    >
      {src ? (
        <img src={src} className="w-full h-full object-cover" alt={name || username || ""} />
      ) : (
        <span className="leading-none">{init}</span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} onClick={(e) => e.stopPropagation()}>
        {inner}
      </Link>
    );
  }

  return inner;
}
