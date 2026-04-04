import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { admin as adminApi } from "../lib/api";
import { Link } from "react-router-dom";
import {
  BarChart2, Users, Flag, Megaphone, Shield, Trash2,
  CheckCircle, XCircle, Award, ChevronLeft, ChevronRight,
  Search, Ban, UserCheck, Train, MessageSquare, FileImage,
  Film, AlertTriangle, TrendingUp, UserPlus, Activity,
  ExternalLink,
} from "lucide-react";

type Tab = "dashboard" | "users" | "reports" | "broadcast";

// ── Avatar placeholder ────────────────────────────────────────────────────────
function UserAvatar({ url, username }: { url?: string | null; username: string }) {
  if (url) {
    return <img src={url} alt={username} className="w-10 h-10 rounded-full object-cover shrink-0 border border-zinc-700" />;
  }
  return (
    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center shrink-0 border border-zinc-700">
      <span className="text-white text-sm font-bold uppercase">{username[0]}</span>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-zinc-400 text-xs uppercase tracking-widest mb-1">{label}</p>
        <p className="text-white text-2xl font-bold leading-none">{value}</p>
        {sub && <p className="text-zinc-500 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ── Dashboard tab ─────────────────────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: adminApi.stats });

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500" />
    </div>
  );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-white font-semibold text-base mb-1">Users</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={data.users.total} icon={<Users size={16} className="text-blue-400" />} color="bg-blue-500/10" />
          <StatCard label="Active" value={data.users.active} icon={<Activity size={16} className="text-green-400" />} color="bg-green-500/10" />
          <StatCard label="New today" value={data.users.new_today} icon={<UserPlus size={16} className="text-orange-400" />} color="bg-orange-500/10" />
          <StatCard label="This week" value={data.users.new_this_week} icon={<TrendingUp size={16} className="text-purple-400" />} color="bg-purple-500/10" />
        </div>
      </div>

      <div>
        <h2 className="text-white font-semibold text-base mb-1">Content</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Posts" value={data.content.total_posts} icon={<FileImage size={16} className="text-sky-400" />} color="bg-sky-500/10" />
          <StatCard label="Reels" value={data.content.total_reels} icon={<Film size={16} className="text-pink-400" />} color="bg-pink-500/10" />
          <StatCard label="Comments" value={data.content.total_comments} icon={<MessageSquare size={16} className="text-yellow-400" />} color="bg-yellow-500/10" />
          <StatCard
            label="Pending reports"
            value={data.reports.pending}
            sub={`${data.reports.total} total`}
            icon={<AlertTriangle size={16} className="text-red-400" />}
            color="bg-red-500/10"
          />
        </div>
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

  const banMut = useMutation({ mutationFn: (id: string) => adminApi.banUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }) });
  const unbanMut = useMutation({ mutationFn: (id: string) => adminApi.unbanUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }) });
  const verifyMut = useMutation({ mutationFn: (id: string) => adminApi.verifyUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }) });
  const unverifyMut = useMutation({ mutationFn: (id: string) => adminApi.unverifyUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }) });
  const deleteMut = useMutation({ mutationFn: (id: string) => adminApi.deleteUser(id), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }) });
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
            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <button
          onClick={() => { setSearch(searchInput); setPage(1); }}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition-colors"
        >
          Search
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500" />
        </div>
      ) : (
        <div className="space-y-2">
          {data?.users.map((u: any) => (
            <div key={u.id} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 flex items-center gap-4 transition-colors">
              {/* Avatar */}
              <UserAvatar url={u.avatar_url} username={u.username} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/profile/${u.username}`}
                    target="_blank"
                    className="text-white text-sm font-semibold hover:text-orange-400 transition-colors flex items-center gap-1"
                  >
                    @{u.username}
                    <ExternalLink size={11} className="text-zinc-500" />
                  </Link>
                  {u.display_name && <span className="text-zinc-400 text-xs">({u.display_name})</span>}
                  {u.is_verified && (
                    <span className="flex items-center gap-0.5 text-xs text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded-full">
                      <CheckCircle size={10} /> Verified
                    </span>
                  )}
                  {u.is_admin && (
                    <span className="flex items-center gap-0.5 text-xs text-orange-400 bg-orange-400/10 px-1.5 py-0.5 rounded-full">
                      <Shield size={10} /> Admin
                    </span>
                  )}
                  {!u.is_active && (
                    <span className="text-xs text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">Banned</span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-zinc-400 text-xs truncate">{u.email}</span>
                  {u.is_email_verified
                    ? <span className="text-xs text-green-400 bg-green-400/10 px-1.5 py-0.5 rounded-full shrink-0">Email ✓</span>
                    : <span className="text-xs text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded-full shrink-0">Email ✗</span>
                  }
                </div>

                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="text-zinc-500 text-xs">
                    Karma: <span className="text-orange-400 font-medium">{u.karma}</span>
                  </span>
                  <span className="text-zinc-500 text-xs">
                    Posts: <span className="text-zinc-300 font-medium">{u.post_count ?? 0}</span>
                  </span>
                  <span className="text-zinc-500 text-xs">
                    Reels: <span className="text-zinc-300 font-medium">{u.reel_count ?? 0}</span>
                  </span>
                </div>
                <p className="text-zinc-500 text-xs mt-0.5">
                  Joined {new Date(u.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {u.is_active ? (
                  <button onClick={() => banMut.mutate(u.id)} title="Ban user"
                    className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
                    <Ban size={14} />
                  </button>
                ) : (
                  <button onClick={() => unbanMut.mutate(u.id)} title="Unban user"
                    className="p-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors">
                    <UserCheck size={14} />
                  </button>
                )}
                {u.is_verified ? (
                  <button onClick={() => unverifyMut.mutate(u.id)} title="Remove blue tick"
                    className="p-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors">
                    <XCircle size={14} />
                  </button>
                ) : (
                  <button onClick={() => verifyMut.mutate(u.id)} title="Give blue tick"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-blue-500/10 text-zinc-400 hover:text-blue-400 transition-colors">
                    <CheckCircle size={14} />
                  </button>
                )}
                <button onClick={() => setKarmaTarget(karmaTarget === u.id ? null : u.id)} title="Adjust karma"
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-orange-500/10 text-zinc-400 hover:text-orange-400 transition-colors">
                  <Award size={14} />
                </button>
                <button
                  onClick={() => { if (window.confirm(`Delete @${u.username}? This cannot be undone.`)) deleteMut.mutate(u.id); }}
                  title="Delete user"
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {karmaTarget && (
            <div className="bg-zinc-900 border border-orange-500/30 rounded-2xl p-4 flex items-center gap-3">
              <Award size={16} className="text-orange-400 shrink-0" />
              <span className="text-zinc-300 text-sm flex-1">Karma adjustment:</span>
              <input
                type="number"
                value={karmaDelta}
                onChange={(e) => setKarmaDelta(e.target.value)}
                className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-sm text-white focus:outline-none text-center"
                placeholder="±50"
              />
              <button
                onClick={() => karmaMut.mutate({ id: karmaTarget, delta: parseInt(karmaDelta) || 0 })}
                disabled={!karmaDelta || karmaMut.isPending}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Apply
              </button>
              <button onClick={() => setKarmaTarget(null)} className="text-zinc-500 hover:text-white text-sm transition-colors">Cancel</button>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-xl transition-colors">
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-zinc-500 text-sm">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-xl transition-colors">
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  reviewed: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  resolved: "text-green-400 bg-green-400/10 border-green-400/20",
  dismissed: "text-zinc-400 bg-zinc-700/50 border-zinc-600",
};

const REASON_LABELS: Record<string, string> = {
  spam: "Spam",
  hate: "Hate speech",
  violence: "Violence",
  nudity: "Nudity",
  misinformation: "Misinformation",
  other: "Other",
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

  const deletePostMut = useMutation({
    mutationFn: ({ postId, reportId }: { postId: string; reportId: string }) =>
      adminApi.deletePost(postId).then(() => adminApi.updateReport(reportId, { status: "resolved", admin_note: "Content deleted by admin" })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  const deleteReelMut = useMutation({
    mutationFn: ({ reelId, reportId }: { reelId: string; reportId: string }) =>
      adminApi.deleteReel(reelId).then(() => adminApi.updateReport(reportId, { status: "resolved", admin_note: "Content deleted by admin" })),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 1;

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { val: "pending", label: "Pending" },
          { val: "reviewed", label: "Reviewed" },
          { val: "resolved", label: "Resolved" },
          { val: "dismissed", label: "Dismissed" },
          { val: "", label: "All" },
        ].map(({ val, label }) => (
          <button
            key={val || "all"}
            onClick={() => { setFilter(val); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
              filter === val
                ? "bg-orange-500/20 border-orange-500 text-orange-400"
                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {data?.reports.length === 0 && (
            <div className="text-center py-16 space-y-2">
              <Flag size={32} className="text-zinc-700 mx-auto" />
              <p className="text-zinc-500 text-sm">No reports found</p>
            </div>
          )}
          {data?.reports.map((r: any) => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${STATUS_COLORS[r.status] || "text-zinc-400"}`}>
                      {r.status}
                    </span>
                    <span className="text-white text-sm font-semibold">
                      {REASON_LABELS[r.reason] || r.reason}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.post_id ? "text-sky-400 bg-sky-400/10" : "text-pink-400 bg-pink-400/10"}`}>
                      {r.post_id ? "Post" : "Reel"}
                    </span>
                  </div>

                  <p className="text-zinc-400 text-xs">
                    Reported by <span className="text-zinc-200 font-medium">@{r.reporter_username}</span>
                    {" · "}{new Date(r.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>

                  {r.details && (
                    <p className="text-zinc-400 text-xs italic bg-zinc-800 rounded-lg px-3 py-2">
                      "{r.details}"
                    </p>
                  )}
                  {r.admin_note && (
                    <p className="text-zinc-500 text-xs bg-zinc-800/50 rounded-lg px-3 py-2">
                      <span className="text-zinc-400 font-medium">Admin note:</span> {r.admin_note}
                    </p>
                  )}
                </div>

                {/* View link */}
                <div className="shrink-0">
                  {r.post_id && (
                    <a href={`/posts/${r.post_id}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors border border-zinc-700">
                      <ExternalLink size={11} /> View post
                    </a>
                  )}
                  {r.reel_id && (
                    <a href={`/reels/${r.reel_id}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors border border-zinc-700">
                      <ExternalLink size={11} /> View reel
                    </a>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {r.status === "pending" && (
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-zinc-800">
                  <button onClick={() => updateMut.mutate({ id: r.id, status: "reviewed" })}
                    className="px-3 py-1.5 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-xl transition-colors font-medium">
                    Mark reviewed
                  </button>
                  <button onClick={() => updateMut.mutate({ id: r.id, status: "resolved" })}
                    className="px-3 py-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl transition-colors font-medium">
                    Resolve
                  </button>
                  <button onClick={() => updateMut.mutate({ id: r.id, status: "dismissed" })}
                    className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-xl transition-colors font-medium">
                    Dismiss
                  </button>
                  <button onClick={() => setNoteTarget(noteTarget === r.id ? null : r.id)}
                    className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors font-medium">
                    + Note
                  </button>
                  {r.post_id && (
                    <button
                      onClick={() => { if (window.confirm("Delete this post? Cannot be undone.")) deletePostMut.mutate({ postId: r.post_id, reportId: r.id }); }}
                      disabled={deletePostMut.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors font-medium disabled:opacity-50"
                    >
                      <Trash2 size={11} /> Delete post
                    </button>
                  )}
                  {r.reel_id && (
                    <button
                      onClick={() => { if (window.confirm("Delete this reel? Cannot be undone.")) deleteReelMut.mutate({ reelId: r.reel_id, reportId: r.id }); }}
                      disabled={deleteReelMut.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-colors font-medium disabled:opacity-50"
                    >
                      <Trash2 size={11} /> Delete reel
                    </button>
                  )}
                </div>
              )}

              {noteTarget === r.id && (
                <div className="flex gap-2">
                  <input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add admin note…"
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
                  />
                  <button
                    onClick={() => updateMut.mutate({ id: r.id, status: r.status, admin_note: noteText })}
                    disabled={updateMut.isPending}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
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
            className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-xl transition-colors">
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-zinc-500 text-sm">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-300 text-sm rounded-xl transition-colors">
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
    <div className="max-w-xl space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex gap-3">
        <AlertTriangle size={16} className="text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-zinc-400 text-sm">
          Sends an in-app notification to all active users. Use sparingly — this goes to everyone.
        </p>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={300}
        rows={5}
        placeholder="Write your broadcast message…"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-600"
      />

      <div className="flex items-center justify-between">
        <span className="text-zinc-500 text-xs">{message.length} / 300</span>
        <button
          disabled={!message.trim() || mut.isPending}
          onClick={() => { if (window.confirm("Send this to all active users?")) mut.mutate(); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Megaphone size={15} />
          {mut.isPending ? "Sending…" : "Broadcast"}
        </button>
      </div>

      {sent !== null && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3">
          <CheckCircle size={15} />
          Sent to {sent} users successfully.
        </div>
      )}
      {mut.isError && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
          <XCircle size={15} />
          Failed to broadcast. Try again.
        </div>
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
      <div className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Train size={15} className="text-orange-500" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">RailGram</p>
              <p className="text-zinc-500 text-xs">Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-orange-400 bg-orange-400/10 border border-orange-400/20 px-2.5 py-1.5 rounded-full">
            <Shield size={11} />
            Admin
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
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
