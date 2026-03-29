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
  { to: "/",            icon: Home,          label: "Feed"        },
  { to: "/search",      icon: Search,        label: "Search"      },
  { to: "/reels",       icon: Film,          label: "Reels"       },
  { to: "/notifications", icon: Bell,        label: "Alerts",  isNotif: true },
  { to: "/chat",        icon: MessageSquare, label: "Chat"        },
  { to: "/map",         icon: Map,           label: "Live Map"    },
  { to: "/trains",      icon: Train,         label: "Trains"      },
  { to: "/leaderboard", icon: Trophy,        label: "Leaderboard" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isReelModalOpen, setIsReelModalOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ["unread-notifs"],
    queryFn: () => notifApi.unreadCount(),
    enabled: !!user,
    refetchInterval: 30000,
  });

  const handleLogout = async () => {
    await logout();
    nav("/login");
  };

  const expanded = hovered;

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`hidden md:flex flex-col bg-zinc-950 border-r border-zinc-800/60 px-3 py-6 gap-1 fixed h-full z-30 transition-all duration-300 ease-in-out overflow-hidden ${
          expanded ? "w-60" : "w-[72px]"
        }`}
      >
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 px-2 py-3 mb-3 text-white hover:opacity-80 transition-opacity"
        >
          <Train size={26} className="text-orange-400 shrink-0" />
          <span
            className={`font-bold text-xl text-orange-400 whitespace-nowrap transition-all duration-200 ${
              expanded ? "opacity-100 w-auto" : "opacity-0 w-0"
            }`}
          >
            RailGram
          </span>
        </Link>

        {/* Nav links */}
        {NAV.map(({ to, icon: Icon, label, isNotif }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-4 px-2 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
              }`
            }
          >
            <div className="relative shrink-0">
              <Icon size={24} strokeWidth={1.8} />
              {isNotif && (unread?.unread_count ?? 0) > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full border border-zinc-950" />
              )}
            </div>
            <span
              className={`whitespace-nowrap transition-all duration-200 ${
                expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
              }`}
            >
              {label}
            </span>
          </NavLink>
        ))}

        {/* Create buttons */}
        <div className={`flex gap-2 mt-3 transition-all duration-200 ${expanded ? "" : "flex-col"}`}>
          <button
            onClick={() => setIsPostModalOpen(true)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-[11px] font-black uppercase tracking-widest transition-all hover:bg-orange-600 shadow-[0_4px_14px_rgba(249,115,22,0.3)] active:scale-95 ${
              expanded ? "flex-1" : "w-full"
            }`}
          >
            <ImageIcon size={16} className="shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-200 ${expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}`}>
              Post
            </span>
          </button>
          <button
            onClick={() => setIsReelModalOpen(true)}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-all hover:bg-indigo-600 shadow-[0_4px_14px_rgba(99,102,241,0.3)] active:scale-95 ${
              expanded ? "flex-1" : "w-full"
            }`}
          >
            <Film size={16} className="shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-200 ${expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}`}>
              Reel
            </span>
          </button>
        </div>

        {/* Bottom: profile + logout */}
        <div className="mt-auto flex flex-col gap-1">
          {user ? (
            <>
              <NavLink
                to={`/profile/${user.username}`}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-2 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-white"
                  }`
                }
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
                ) : (
                  <User size={24} strokeWidth={1.8} className="shrink-0" />
                )}
                <span className={`whitespace-nowrap transition-all duration-200 ${expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}`}>
                  {user.username}
                </span>
              </NavLink>
              <button
                onClick={handleLogout}
                className="flex items-center gap-4 px-2 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-800/60 hover:text-red-400 transition-all duration-150"
              >
                <LogOut size={24} strokeWidth={1.8} className="shrink-0" />
                <span className={`whitespace-nowrap transition-all duration-200 ${expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}`}>
                  Log out
                </span>
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
              className="flex items-center gap-4 px-2 py-3 rounded-xl text-sm font-semibold text-orange-400 hover:bg-orange-500/10 transition-all duration-150"
            >
              <LogOut size={24} strokeWidth={1.8} className="shrink-0" />
              <span className={`whitespace-nowrap transition-all duration-200 ${expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}`}>
                Log in
              </span>
            </NavLink>
          )}
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-zinc-900/90 backdrop-blur-lg border-t border-zinc-800 flex justify-around items-center py-2 px-2 z-30 pb-safe">
        {NAV.slice(0, 2).map(({ to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `p-2 rounded-lg ${isActive ? "text-white" : "text-zinc-500"}`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
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
              `p-2 rounded-lg relative ${isActive ? "text-white" : "text-zinc-500"}`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
            {isNotif && (unread?.unread_count ?? 0) > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-zinc-900" />
            )}
          </NavLink>
        ))}

        <NavLink
          to={user ? `/profile/${user.username}` : "/login"}
          className={({ isActive }) => `p-2 rounded-lg ${isActive ? "text-white" : "text-zinc-500"}`}
        >
          <User size={22} strokeWidth={1.8} />
        </NavLink>
      </nav>

      {/* Main content — shifts right based on sidebar width */}
      <main
        className={`flex-1 pb-20 md:pb-0 relative transition-all duration-300 ${
          expanded ? "md:ml-60" : "md:ml-[72px]"
        }`}
      >
        {/* Email verification banner */}
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
