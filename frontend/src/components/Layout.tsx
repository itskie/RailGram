import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Train, Map, Home, User, MessageSquare, Trophy, LogOut, Film, Search, Bell, AlertTriangle, Image as ImageIcon
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useQuery } from "@tanstack/react-query";
import { notifications as notifApi } from "../lib/api";
import CreatePostModal from "./CreatePostModal";
import CreateReelModal from "../features/reels/components/CreateReelModal";
import UploadBackgroundManager from "./UploadBackgroundManager";

const NAV = [
  { to: "/",            icon: Home,          label: "Feed"       },
  { to: "/search",      icon: Search,        label: "Search"     },
  { to: "/reels",       icon: Film,          label: "Reels"      },
  { to: "/notifications", icon: Bell,        label: "Alerts",    isNotif: true },
  { to: "/chat",        icon: MessageSquare, label: "Chat"       },
  { to: "/map",         icon: Map,           label: "Live Map"   },
  { to: "/trains",      icon: Train,         label: "Trains"     },
  { to: "/leaderboard", icon: Trophy,        label: "Leaderboard"},
];


export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isReelModalOpen, setIsReelModalOpen] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ["unread-notifs"],
    queryFn: () => notifApi.unreadCount(),
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30s
  });

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-zinc-900 border-r border-zinc-800 px-4 py-6 gap-2 fixed h-full z-10">
        <Link to="/" className="flex items-center gap-2 text-orange-400 font-bold text-xl mb-6">
          <Train size={22} />
          RailGram
        </Link>
        {NAV.map(({ to, icon: Icon, label, isNotif }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-orange-500/20 text-orange-400"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`
            }
          >
            <div className="relative">
              <Icon size={18} />
              {isNotif && (unread?.unread_count ?? 0) > 0 && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full border border-zinc-900 shadow-sm" />
              )}
            </div>
            {label}
          </NavLink>
        ))}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setIsPostModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-500 text-white text-[11px] font-black uppercase tracking-widest transition-all hover:bg-orange-600 shadow-[0_4px_14px_rgba(249,115,22,0.3)] active:scale-95"
          >
            <ImageIcon size={16} /> Post
          </button>
          <button
            onClick={() => setIsReelModalOpen(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-all hover:bg-indigo-600 shadow-[0_4px_14px_rgba(99,102,241,0.3)] active:scale-95"
          >
            <Film size={16} /> Reel
          </button>
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {user && (
            <>
              <NavLink
                to={`/profile/${user.username}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-orange-500/20 text-orange-400"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  }`
                }
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
                ) : (
                  <User size={18} />
                )}
                {user.username}
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-400 transition-colors"
              >
                <LogOut size={18} /> Log out
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-zinc-900/80 backdrop-blur-lg border-t border-zinc-800 flex justify-around items-center py-2 px-2 z-10 pb-safe">
        {NAV.slice(0, 2).map(({ to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `p-2 rounded-lg ${isActive ? "text-orange-400" : "text-zinc-500"}`
            }
          >
            <Icon size={22} />
          </NavLink>
        ))}
        
        <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setIsPostModalOpen(true)}
            className="p-2.5 bg-orange-500 text-white rounded-xl shadow-[0_4px_14px_rgba(249,115,22,0.4)] active:scale-90 transition-transform"
          >
            <ImageIcon size={20} />
          </button>
          <button 
            onClick={() => setIsReelModalOpen(true)}
            className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-[0_4px_14px_rgba(99,102,241,0.4)] active:scale-90 transition-transform"
          >
            <Film size={20} />
          </button>
        </div>

        {NAV.slice(2, 4).map(({ to, icon: Icon, isNotif }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `p-2 rounded-lg relative ${isActive ? "text-orange-400" : "text-zinc-500"}`
            }
          >
            <Icon size={22} />
            {isNotif && (unread?.unread_count ?? 0) > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-zinc-900" />
            )}
          </NavLink>
        ))}
        
        {user && (
          <NavLink to={`/profile/${user.username}`} className={({ isActive }) =>
            `p-2 rounded-lg ${isActive ? "text-orange-400" : "text-zinc-500"}`
          }>
            <User size={22} />
          </NavLink>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-60 pb-20 md:pb-0 relative">
        {/* Verification Banner */}
        {user && !user.is_verified && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-0 z-20 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-400 shrink-0" size={20} />
              <p className="text-red-400 text-sm font-medium">
                <span className="font-bold">Action Required:</span> Please verify your email address to unlock your account.
              </p>
            </div>
            {user.email && (
              <button
                onClick={async (e) => {
                  const btn = e.currentTarget;
                  btn.disabled = true;
                  btn.innerText = "Sending...";
                  try {
                    const { auth } = await import("../lib/api");
                    await auth.resendVerification(user.email!);
                    btn.innerText = "Sent!";
                    btn.classList.add("text-green-400", "border-green-400/30", "bg-green-400/10");
                    btn.classList.remove("text-red-400", "border-red-400/30", "hover:bg-red-400/20");
                  } catch {
                    btn.innerText = "Error (Try Again)";
                    btn.disabled = false;
                  }
                }}
                className="px-4 py-1.5 rounded-full text-xs font-bold border border-red-400/30 text-red-500 hover:bg-red-500/20 hover:text-red-400 transition-colors whitespace-nowrap disabled:opacity-50 shrink-0"
              >
                Resend Email
              </button>
            )}
          </div>
        )}
        {children}
        <UploadBackgroundManager />
      </main>

      <AnimatePresence>
        {isPostModalOpen && (
          <CreatePostModal 
            isOpen={isPostModalOpen} 
            onClose={() => setIsPostModalOpen(false)} 
          />
        )}
        {isReelModalOpen && (
          <CreateReelModal 
            isOpen={isReelModalOpen} 
            onClose={() => setIsReelModalOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
