import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

import { Loader } from "lucide-react";

export default function RequireAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  // Wait for initialization
  if (!isInitialized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-4 border-t border-orange-500">
        <Loader className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black gap-4 border-t border-orange-500">
        <Loader className="w-8 h-8 text-orange-500 animate-spin" />
        <p className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Resuming Secure Session...</p>
      </div>
    );
  }

  return <Outlet />;
}
