import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin as adminApi } from "../lib/api";
import {
  BarChart2, Users, Flag, Megaphone, Shield, Trash2,
  CheckCircle, XCircle, Award, ChevronLeft, ChevronRight,
  Search, Ban, UserCheck,
} from "lucide-react";

type Tab = "dashboard" | "users" | "reports" | "broadcast";

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-1">
      <p className="text-zinc-400 text-xs uppercase tracking-widest">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-zinc-500 text-xs">{sub}</p>}
    </div>
  );
}

// ── Dashboard tab ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: adminApi.stats });

  if (isLoading) return <div className="text-zinc-500 text-sm">Loading stats…</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-white font-semibold text-lg">Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total users" value={data.users.total} />
        <StatCard label="Active users" value={data.users.active} />
        <StatCard label="New today" value={data.users.new_today} />
        <StatCard label="New this week" value={data.users.new_this_week} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Posts" value={data.content.total_posts} />
        <StatCard label="Reels" value={data.content.total_reels} />
        <StatCard label="Comments" value={data.content.total_comments} />
        <StatCard
          label="Pending reports"
          value={data.reports.pending}
          sub={`${data.reports.total} total`}
        />
      </div>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [karmaTarget, setKarmaTarget] = useState<string | null>(null);
  const [karmaDelta, setKarmaDelta] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", page, search],
    queryFn: () => adminApi.users({ page, search: search || undefined }),
  });

  const banMut = useMutation({
    mutationFn: (id: string) => adminApi.banUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const unbanMut = useMutation({
    mutationFn: (id: string) => adminApi.unbanUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const verifyMut = useMutation({
    mutationFn: (id: string) => adminApi.verifyUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const unverifyMut = useMutation({
    mutationFn: (id: string) => adminApi.unverifyUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
  const karmaMut = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => adminApi.updateKarma(id, delta),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-users"] }); setKarmaTarget(null); setKarmaDelta(""); },
  });

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            placeholder="Search username or email…"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <button
          onClick={() => { setSearch(searchInput); setPage(1); }}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-xl transition-colors"
        >
          Search
        </button>
      </div>

      {isLoading ? (
        <div className="text-zinc-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-2">
          {data?.users.map((u: any) => (
            <div key={u.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium truncate">{u.username}</span>
                  {u.display_name && <span className="text-zinc-400 text-xs truncate">({u.display_name})</span>}
                  {u.is_verified && <CheckCircle size={12} className="text-blue-400 shrink-0" />}
                  {u.is_admin && <Shield size={12} className="text-orange-400 shrink-0" />}
                  {!u.is_active && <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-md">Banned</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-zinc-400 text-xs truncate">{u.email}</p>
                  {u.is_email_verified
                    ? <span className="text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-md shrink-0">Email ✓</span>
                    : <span className="text-xs text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-md shrink-0">Email ✗</span>
                  }
                </div>
                <p className="text-zinc-500 text-xs">Karma: {u.karma} · Joined {new Date(u.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {u.is_active ? (
                  <button
                    onClick={() => banMut.mutate(u.id)}
                    title="Ban user"
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  >
                    <Ban size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => unbanMut.mutate(u.id)}
                    title="Unban user"
                    className="p-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
                  >
                    <UserCheck size={13} />
                  </button>
                )}
                {u.is_verified ? (
                  <button
                    onClick={() => unverifyMut.mutate(u.id)}
                    title="Remove verification"
                    className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-blue-400 transition-colors"
                  >
                    <XCircle size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => verifyMut.mutate(u.id)}
                    title="Verify user"
                    className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-blue-400 transition-colors"
                  >
                    <CheckCircle size={13} />
                  </button>
                )}
                <button
                  onClick={() => setKarmaTarget(karmaTarget === u.id ? null : u.id)}
                  title="Adjust karma"
                  className="p-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-orange-400 transition-colors"
                >
                  <Award size={13} />
                </button>
                <button
                  onClick={() => { if (window.confirm(`Delete ${u.username}? This cannot be undone.`)) deleteMut.mutate(u.id); }}
                  title="Delete user"
                  className="p-1.5 rounded-lg bg-zinc-700 hover:bg-red-500/20 text-red-400 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
          {karmaTarget && (
            <div className="bg-zinc-900 border border-orange-500/30 rounded-xl p-3 flex items-center gap-2">
              <span className="text-zinc-300 text-sm flex-1">Karma delta (positive = award, negative = deduct):</span>
              <input
                type="number"
                value={karmaDelta}
                onChange={(e) => setKarmaDelta(e.target.value)}
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-white focus:outline-none"
                placeholder="e.g. 50"
              />
              <button
                onClick={() => karmaMut.mutate({ id: karmaTarget, delta: parseInt(karmaDelta) || 0 })}
                disabled={!karmaDelta || karmaMut.isPending}
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                Apply
              </button>
              <button onClick={() => setKarmaTarget(null)} className="text-zinc-400 hover:text-white text-sm">Cancel</button>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-lg transition-colors"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-zinc-500 text-sm">Page {page} of {totalPages}</span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-lg transition-colors"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10",
  reviewed: "text-blue-400 bg-blue-400/10",
  resolved: "text-green-400 bg-green-400/10",
  dismissed: "text-zinc-400 bg-zinc-700",
};

function ReportsTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("pending");
  const [noteTarget, setNoteTarget] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", page, filter],
    queryFn: () => adminApi.reports({ page, status: filter || undefined }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, status, admin_note }: { id: string; status: string; admin_note?: string }) =>
      adminApi.updateReport(id, { status, admin_note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-reports"] }); setNoteTarget(null); setNoteText(""); },
  });

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {["pending", "reviewed", "resolved", "dismissed", ""].map((s) => (
          <button
            key={s || "all"}
            onClick={() => { setFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-sm border transition-colors ${
              filter === s
                ? "bg-orange-500/20 border-orange-500 text-orange-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-zinc-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-2">
          {data?.reports.length === 0 && (
            <p className="text-zinc-500 text-sm text-center py-8">No reports found</p>
          )}
          {data?.reports.map((r: any) => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || "text-zinc-400"}`}>
                      {r.status}
                    </span>
                    <span className="text-zinc-300 text-sm font-medium">{r.reason}</span>
                    {r.post_id && <span className="text-zinc-500 text-xs">Post</span>}
                    {r.reel_id && <span className="text-zinc-500 text-xs">Reel</span>}
                  </div>
                  <p className="text-zinc-400 text-xs mt-0.5">
                    By <span className="text-zinc-300">@{r.reporter_username}</span> · {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  {r.details && <p className="text-zinc-400 text-xs mt-1 italic">"{r.details}"</p>}
                  {r.admin_note && <p className="text-zinc-500 text-xs mt-1">Note: {r.admin_note}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {r.post_id && (
                    <a href={`/posts/${r.post_id}`} target="_blank" rel="noopener noreferrer"
                      className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
                      View
                    </a>
                  )}
                  {r.reel_id && (
                    <a href={`/reels/${r.reel_id}`} target="_blank" rel="noopener noreferrer"
                      className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors">
                      View
                    </a>
                  )}
                </div>
              </div>

              {r.status === "pending" && (
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-zinc-800">
                  <button
                    onClick={() => updateMut.mutate({ id: r.id, status: "reviewed" })}
                    className="px-2 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
                  >
                    Mark reviewed
                  </button>
                  <button
                    onClick={() => updateMut.mutate({ id: r.id, status: "resolved" })}
                    className="px-2 py-1 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg transition-colors"
                  >
                    Resolve
                  </button>
                  <button
                    onClick={() => updateMut.mutate({ id: r.id, status: "dismissed" })}
                    className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-400 rounded-lg transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => setNoteTarget(noteTarget === r.id ? null : r.id)}
                    className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                  >
                    Add note
                  </button>
                </div>
              )}

              {noteTarget === r.id && (
                <div className="flex gap-2 pt-1">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Admin note…"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-white placeholder-zinc-500 focus:outline-none"
                  />
                  <button
                    onClick={() => updateMut.mutate({ id: r.id, status: r.status, admin_note: noteText })}
                    disabled={updateMut.isPending}
                    className="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-lg transition-colors">
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-zinc-500 text-sm">Page {page} of {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-lg transition-colors">
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Broadcast tab ─────────────────────────────────────────────────────────────
function BroadcastTab() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState<number | null>(null);

  const mut = useMutation({
    mutationFn: () => adminApi.broadcast(message),
    onSuccess: (data: any) => { setSent(data.sent_to); setMessage(""); },
  });

  return (
    <div className="space-y-4 max-w-xl">
      <p className="text-zinc-400 text-sm">
        Send a notification to all active users. This creates an in-app notification for everyone.
        Use sparingly.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={300}
        rows={4}
        placeholder="Broadcast message…"
        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
      />
      <div className="flex items-center justify-between">
        <span className="text-zinc-500 text-xs">{message.length}/300</span>
        <button
          disabled={!message.trim() || mut.isPending}
          onClick={() => { if (window.confirm(`Send this to all active users?`)) mut.mutate(); }}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Megaphone size={14} />
          {mut.isPending ? "Sending…" : "Broadcast"}
        </button>
      </div>
      {sent !== null && (
        <p className="text-green-400 text-sm">Sent to {sent} users.</p>
      )}
      {mut.isError && (
        <p className="text-red-400 text-sm">Failed to broadcast.</p>
      )}
    </div>
  );
}

// ── Main AdminPage ─────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "dashboard", label: "Dashboard", icon: <BarChart2 size={15} /> },
  { id: "users", label: "Users", icon: <Users size={15} /> },
  { id: "reports", label: "Reports", icon: <Flag size={15} /> },
  { id: "broadcast", label: "Broadcast", icon: <Megaphone size={15} /> },
];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-2">
          <Shield size={18} className="text-orange-500" />
          <h1 className="text-white font-bold text-lg">RailGram Admin</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-orange-500 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "dashboard" && <DashboardTab />}
        {tab === "users" && <UsersTab />}
        {tab === "reports" && <ReportsTab />}
        {tab === "broadcast" && <BroadcastTab />}
      </div>
    </div>
  );
}
