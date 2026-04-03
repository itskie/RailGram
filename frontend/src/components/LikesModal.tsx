import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { posts as postsApi, reels as reelsApi } from '../lib/api';
import Avatar from './Avatar';
import { Link } from 'react-router-dom';

interface LikeUser {
  id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
}

interface LikesModalProps {
  type: 'post' | 'reel';
  entityId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LikesModal({ type, entityId, isOpen, onClose }: LikesModalProps) {
  const [users, setUsers] = useState<LikeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (cursor?: number) => {
    try {
      const res: any = type === 'post'
        ? await postsApi.likes(entityId, cursor)
        : await reelsApi.likes(entityId, cursor);
      if (cursor) {
        setUsers(prev => [...prev, ...(res.users ?? [])]);
      } else {
        setUsers(res.users ?? []);
      }
      setNextCursor(res.next_cursor ?? null);
    } catch {
      // ignore
    }
  }, [type, entityId]);

  useEffect(() => {
    if (!isOpen) return;
    setUsers([]);
    setNextCursor(null);
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [isOpen, load]);

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    await load(nextCursor);
    setLoadingMore(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Sheet */}
        <motion.div
          className="relative w-full sm:max-w-md bg-zinc-900 border border-zinc-800 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
            <h3 className="font-bold text-white text-base">Likes</h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={24} className="animate-spin text-zinc-500" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm">No likes yet</div>
            ) : (
              <>
                {users.map((u) => (
                  <Link
                    key={u.id}
                    to={`/profile/${u.username}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/60 transition-colors"
                  >
                    <Avatar
                      src={u.avatar_url}
                      name={u.display_name}
                      username={u.username}
                      size={10}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{u.username}</p>
                      {u.display_name && u.display_name !== u.username && (
                        <p className="text-zinc-500 text-xs truncate">{u.display_name}</p>
                      )}
                    </div>
                  </Link>
                ))}
                {nextCursor && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full py-3 text-sm text-orange-400 hover:text-orange-300 transition-colors flex items-center justify-center gap-2"
                  >
                    {loadingMore ? <Loader2 size={16} className="animate-spin" /> : "Load more"}
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
