import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Train, Map, Home, User, Send, Trophy, LogOut, Film, Search, Heart, AlertTriangle, Image as ImageIcon, Sun, Moon, Menu, Plus
} from "lucide-react";
import { useThemeStore } from "../store/themeStore";
import { AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useQuery } from "@tanstack/react-query";
import { notifications as notifApi } from "../lib/api";
import CreatePostModal from "./CreatePostModal";
import CreateReelModal from "../features/reels/components/CreateReelModal";
import UploadBackgroundManager from "./UploadBackgroundManager";
import { OfflineBanner } from "./OfflineBanner";

const NAV = [
  { to: "/",            icon: Home,          label: "Home"        },
  { to: "/reels",       icon: Film,          label: "Reels"       },
  { to: "/chat",        icon: Send,          label: "Messages"    },
  { to: "/search",      icon: Search,        label: "Search"      },
  { to: "/notifications", icon: Heart,       label: "Notifications", isNotif: true },
];

const SECONDARY_NAV = [
  { to: "/map",         icon: Map,           label: "Live Map"    },
  { to: "/trains",      icon: Train,         label: "Trains"      },
  { to: "/leaderboard", icon: Trophy,        label: "Leaderboard" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  const { dark, toggle: toggleTheme } = useThemeStore();
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isReelModalOpen, setIsReelModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

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

  return (
    <div className="flex min-h-screen flex-col">
      {/* ── Sidebar (Hidden) ── */}
      <aside className="hidden"></aside>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-lg border-t border-zinc-800/60 flex justify-center items-center py-3 px-2 z-30 pb-safe">
        <div className="flex items-center justify-around gap-1 max-w-3xl w-full">
          {NAV.map(({ to, icon: Icon, isNotif }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `p-2.5 rounded-lg relative transition-colors ${isActive ? "text-white bg-zinc-800/60" : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"}`
              }
            >
              <Icon size={24} strokeWidth={1.8} />
              {isNotif && (unread?.unread_count ?? 0) > 0 && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full border border-zinc-900" />
              )}
            </NavLink>
          ))}

          {/* Create button */}
          <div className="relative">
            <button
              onClick={() => setCreateOpen(!createOpen)}
              className={`p-2.5 rounded-lg relative transition-colors ${
                createOpen ? "text-white bg-zinc-800/60" : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
              }`}
            >
              <Plus size={24} strokeWidth={1.8} />
            </button>

            {/* Create dropdown */}
            {createOpen && (
              <div className="absolute bottom-full mb-2 right-0 bg-zinc-800/95 rounded-xl border border-zinc-700 overflow-hidden z-50 w-max">
                <button
                  onClick={() => {
                    setIsPostModalOpen(true);
                    setCreateOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700/60 hover:text-white transition-all whitespace-nowrap"
                >
                  <ImageIcon size={18} strokeWidth={1.8} />
                  Post
                </button>
                <button
                  onClick={() => {
                    setIsReelModalOpen(true);
                    setCreateOpen(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700/60 hover:text-white transition-all whitespace-nowrap border-t border-zinc-700"
                >
                  <Film size={18} strokeWidth={1.8} />
                  Reel
                </button>
              </div>
            )}
          </div>

          {/* Profile */}
          <NavLink
            to={user ? `/profile/${user.username}` : "/login"}
            className={({ isActive }) =>
              `p-2.5 rounded-lg relative transition-colors ${isActive ? "text-white bg-zinc-800/60" : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"}`
            }
          >
            {user?.avatar_url ? (
              <img src={user.avatar_url} className="w-6 h-6 rounded-full object-cover" alt="" />
            ) : (
              <User size={24} strokeWidth={1.8} />
            )}
          </NavLink>

          {/* More Menu */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`p-2.5 rounded-lg relative transition-colors ${
                moreOpen ? "text-white bg-zinc-800/60" : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
              }`}
            >
              <Menu size={24} strokeWidth={1.8} />
            </button>

            {/* More dropdown */}
            {moreOpen && (
              <div className="absolute bottom-full mb-2 right-0 bg-zinc-800/95 rounded-xl border border-zinc-700 overflow-hidden z-50 w-max">
                {SECONDARY_NAV.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
                        isActive
                          ? "bg-zinc-700/60 text-white"
                          : "text-zinc-300 hover:bg-zinc-700/40 hover:text-white"
                      }`
                    }
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    {label}
                  </NavLink>
                ))}
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700/40 hover:text-white transition-all whitespace-nowrap border-t border-zinc-700"
                >
                  {dark ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
                  {dark ? "Light Mode" : "Dark Mode"}
                </button>
                {user && (
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-all whitespace-nowrap border-t border-zinc-700"
                  >
                    <LogOut size={18} strokeWidth={1.8} />
                    Log out
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 pb-24 relative">
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
        <OfflineBanner />
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
