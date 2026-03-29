
import { Check } from "lucide-react";

interface VerifiedBadgeProps {
  type?: "blue" | "orange";
  size?: number;
}

export default function VerifiedBadge({ type = "blue", size = 12 }: VerifiedBadgeProps) {
  const bgColor = type === "blue" ? "bg-blue-500" : "bg-orange-500";
  const glowColor = type === "blue" ? "shadow-blue-500/40" : "shadow-orange-500/40";

  return (
    <div className={`inline-flex items-center justify-center ${bgColor} ${glowColor} shadow-lg rounded-full p-0.5 ml-1.5 align-middle border border-white/10`}>
      <Check size={size - 2} className="text-white stroke-[4]" />
    </div>
  );
}
