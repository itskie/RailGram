import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Train, Map, Home, User, MessageSquare, Trophy, LogOut, Film, Search, Bell, Plus
} from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useQuery } from "@tanstack/react-query";
import { notifications as notifApi } from "../lib/api";
import CreatePostModal from "./CreatePostModal";

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

        <button
          onClick={() => setIsPostModalOpen(true)}
          className="flex items-center gap-3 px-3 py-3 mt-4 rounded-xl bg-orange-500 text-white text-sm font-black uppercase tracking-widest transition-all hover:bg-orange-600 hover:shadow-[0_0_20px_rgba(249,115,22,0.3)] active:scale-95"
        >
          <Plus size={18} />
          Create Post
        </button>

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
        
        <button 
          onClick={() => setIsPostModalOpen(true)}
          className="p-3 bg-orange-500 text-white rounded-2xl shadow-lg active:scale-90 transition-transform"
        >
          <Plus size={24} />
        </button>

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
      <main className="flex-1 md:ml-60 pb-20 md:pb-0">
        {children}
      </main>

      <AnimatePresence>
        {isPostModalOpen && (
          <CreatePostModal 
            isOpen={isPostModalOpen} 
            onClose={() => setIsPostModalOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
