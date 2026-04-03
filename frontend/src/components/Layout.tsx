import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Train, Map, Home, User, Send, Trophy, LogOut, Film, Search, Heart, AlertTriangle, Image as ImageIcon, Menu, Plus, Compass
} from "lucide-react";
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
  { to: "/search",      icon: Search,        label: "Search Trains" },
  { to: "/discover",    icon: Compass,       label: "Discover"    },
  { to: "/notifications", icon: Heart,       label: "Notifications", isNotif: true },
];

const SECONDARY_NAV = [
  { to: "/map",         icon: Map,           label: "Live Map"    },
  { to: "/leaderboard", icon: Trophy,        label: "Leaderboard" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isReelModalOpen, setIsReelModalOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
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

  const expanded = hovered;

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`hidden md:flex flex-col bg-black px-3 py-6 gap-1 fixed h-full z-30 transition-all duration-300 ease-in-out overflow-hidden border-r border-zinc-800/40 ${
          expanded ? "w-60" : "w-[72px]"
        }`}
      >
        {/* Logo - Top */}
        <Link
          to="/"
          className="flex items-center gap-3 px-2 py-3 mb-6 text-white hover:opacity-80 transition-opacity"
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

        {/* Main Navigation - Centered */}
        <div className="flex-1 flex flex-col justify-center gap-1">
          {/* Nav links */}
          {NAV.map(({ to, icon: Icon, label, isNotif }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-4 text-sm font-medium transition-all duration-150 ${
                  expanded
                    ? `px-2 py-3 rounded-xl ${isActive ? "bg-zinc-900 text-white [box-shadow:inset_0_0_0_1px_rgba(249,115,22,0.25)]" : "text-zinc-400 hover:bg-zinc-900/70 hover:text-white"}`
                    : `justify-center p-2.5 rounded-full ${isActive ? "bg-zinc-900 text-white [box-shadow:inset_0_0_0_1px_rgba(249,115,22,0.25)]" : "text-zinc-400 hover:bg-zinc-900/70 hover:text-white"}`
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
                className={`whitespace-nowrap transition-all duration-200 font-bold ${
                  expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
                }`}
              >
                {label}
              </span>
            </NavLink>
          ))}

          {/* Create button */}
          <div className="relative">
            <button
              onClick={() => setCreateOpen(!createOpen)}
              className={`w-full flex items-center gap-4 text-sm font-medium transition-all duration-150 ${
                expanded ? "px-2 py-3 rounded-xl" : "justify-center p-2.5 rounded-full"
              } ${
                createOpen
                  ? "bg-zinc-900 text-white [box-shadow:inset_0_0_0_1px_rgba(249,115,22,0.25)]"
                  : "text-zinc-400 hover:bg-zinc-900/70 hover:text-white"
              }`}
            >
              <Plus size={24} strokeWidth={1.8} className="shrink-0" />
              <span className={`whitespace-nowrap transition-all duration-200 font-bold ${expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}`}>
                Create
              </span>
            </button>

            {/* Create dropdown */}
            {createOpen && (
              <div className="absolute left-0 bottom-full mb-2 w-full bg-zinc-950 rounded-xl border border-zinc-800/50 overflow-hidden z-50">
                <button
                  onClick={() => {
                    setIsPostModalOpen(true);
                    setCreateOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-2 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all"
                >
                  <ImageIcon size={20} strokeWidth={1.8} className="shrink-0" />
                  <span>Post</span>
                </button>
                <button
                  onClick={() => {
                    setIsReelModalOpen(true);
                    setCreateOpen(false);
                  }}
                  className="w-full flex items-center gap-4 px-2 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all border-t border-zinc-800/50"
                >
                  <Film size={20} strokeWidth={1.8} className="shrink-0" />
                  <span>Reel</span>
                </button>
              </div>
            )}
          </div>

          {/* Profile button */}
          {user && (
            <NavLink
              to={`/profile/${user.username}`}
              className={({ isActive }) =>
                `flex items-center gap-4 text-sm font-medium transition-all duration-150 ${
                  expanded
                    ? `px-2 py-3 rounded-xl ${isActive ? "bg-zinc-900 text-white [box-shadow:inset_0_0_0_1px_rgba(249,115,22,0.25)]" : "text-zinc-400 hover:bg-zinc-900/70 hover:text-white"}`
                    : `justify-center p-2.5 rounded-full ${isActive ? "bg-zinc-900 text-white [box-shadow:inset_0_0_0_1px_rgba(249,115,22,0.25)]" : "text-zinc-400 hover:bg-zinc-900/70 hover:text-white"}`
                }`
              }
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} className="w-6 h-6 rounded-full object-cover shrink-0" alt="" />
              ) : (
                <User size={24} strokeWidth={1.8} className="shrink-0" />
              )}
              <span
                className={`whitespace-nowrap transition-all duration-200 font-bold ${
                  expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
                }`}
              >
                Profile
              </span>
            </NavLink>
          )}
        </div>

        {/* Bottom: more menu + logout */}
        <div className="mt-auto flex flex-col gap-1">
          {user ? (
            <>
              {/* More menu */}
              <div className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  className={`w-full flex items-center gap-4 text-sm font-medium transition-all duration-150 ${
                    expanded ? "px-2 py-3 rounded-xl" : "justify-center p-2.5 rounded-full"
                  } ${
                    moreOpen
                      ? "bg-zinc-900 text-white [box-shadow:inset_0_0_0_1px_rgba(249,115,22,0.25)]"
                      : "text-zinc-400 hover:bg-zinc-900/70 hover:text-white"
                  }`}
                >
                  <Menu size={24} strokeWidth={1.8} className="shrink-0" />
                  <span
                    className={`whitespace-nowrap transition-all duration-200 font-bold ${
                      expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
                    }`}
                  >
                    More
                  </span>
                </button>

                {/* More dropdown */}
                {moreOpen && (
                  <div className="absolute left-0 bottom-full mb-2 w-full bg-zinc-950 rounded-xl border border-zinc-800/50 overflow-hidden z-50">
                    {SECONDARY_NAV.map(({ to, icon: Icon, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={() => setMoreOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-4 px-2 py-2.5 text-sm font-medium transition-all ${
                            isActive
                              ? "bg-zinc-900 text-white"
                              : "text-zinc-300 hover:bg-zinc-900 hover:text-white"
                          }`
                        }
                      >
                        <Icon size={20} strokeWidth={1.8} className="shrink-0" />
                        <span className="whitespace-nowrap font-bold">{label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className={`flex items-center gap-4 text-sm font-medium text-zinc-400 hover:bg-zinc-900/70 hover:text-red-400 transition-all duration-150 ${expanded ? "px-2 py-3 rounded-xl" : "justify-center p-2.5 rounded-full"}`}
              >
                <LogOut size={24} strokeWidth={1.8} className="shrink-0" />
                <span className={`whitespace-nowrap transition-all duration-200 font-bold ${expanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}`}>
                  Log out
                </span>
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
              className={`flex items-center gap-4 text-sm font-semibold text-orange-400 hover:bg-orange-500/10 transition-all duration-150 ${expanded ? "px-2 py-3 rounded-xl" : "justify-center p-2.5 rounded-full"}`}
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
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-black/95 backdrop-blur-lg border-t border-zinc-800/50 flex justify-around items-center py-2 px-2 z-30 pb-safe">
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

        <div className="relative flex items-center gap-1.5">
          <button
            onClick={() => setCreateOpen(!createOpen)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <Plus size={22} strokeWidth={1.8} />
          </button>

          {/* Mobile Create dropdown */}
          {createOpen && (
              <div className="absolute bottom-full left-0 mb-2 bg-zinc-950 rounded-xl border border-zinc-800/50 overflow-hidden z-50 w-max">
              <button
                onClick={() => {
                  setIsPostModalOpen(true);
                  setCreateOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all whitespace-nowrap"
              >
                <ImageIcon size={16} />
                Post
              </button>
              <button
                onClick={() => {
                  setIsReelModalOpen(true);
                  setCreateOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all whitespace-nowrap border-t border-zinc-800/50"
              >
                <Film size={16} />
                Reel
              </button>
            </div>
          )}
        </div>

        {/* Search + Discover + Notifications (indices 3,4,5) */}
        {NAV.slice(2, 6).filter(({ to }) => to !== "/notifications").map(({ to, icon: Icon, isNotif }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `p-2 rounded-lg relative ${isActive ? "text-white" : "text-zinc-500"}`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
            {isNotif && (unread?.unread_count ?? 0) > 0 && (
              <div className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-black" />
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
