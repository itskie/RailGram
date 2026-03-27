import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Train, Map, Home, User, MessageSquare, Trophy, LogOut,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";

const NAV = [
  { to: "/",           icon: Home,          label: "Feed"       },
  { to: "/map",        icon: Map,           label: "Live Map"   },
  { to: "/trains",     icon: Train,         label: "Trains"     },
  { to: "/chat",       icon: MessageSquare, label: "Chat"       },
  { to: "/leaderboard",icon: Trophy,        label: "Leaderboard"},
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();

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
        {NAV.map(({ to, icon: Icon, label }) => (
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
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

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
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-zinc-900 border-t border-zinc-800 flex justify-around py-2 z-10">
        {NAV.map(({ to, icon: Icon }) => (
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
        {user && (
          <NavLink to={`/profile/${user.username}`} className={({ isActive }) =>
            `p-2 rounded-lg ${isActive ? "text-orange-400" : "text-zinc-500"}`
          }>
            <User size={22} />
          </NavLink>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-1 md:ml-60 pb-16 md:pb-0">
        {children}
      </main>
    </div>
  );
}
