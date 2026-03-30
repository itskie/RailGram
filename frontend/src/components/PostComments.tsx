import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { posts as postsApi } from '../lib/api';
import { useAuthStore } from '../store/authStore';
import { useQueryClient } from '@tanstack/react-query';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';

interface PostCommentsProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

export function PostComments({ isOpen, onClose, postId }: PostCommentsProps) {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const { user } = useAuthStore();
  const qc = useQueryClient();

  useEffect(() => {
    if (isOpen) fetchComments();
  }, [isOpen, postId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const data = await postsApi.comments(postId) as any;
      setComments(data?.comments || []);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isPosting || !user) return;

    const temp = {
      id: 'temp-' + Date.now(),
      body: commentText,
      created_at: new Date().toISOString(),
      author: { username: user.username, display_name: user.display_name, avatar_url: user.avatar_url },
    };

    setIsPosting(true);
    setComments(prev => [...prev, temp]);
    setCommentText('');

    try {
      await postsApi.addComment(postId, temp.body);
      qc.invalidateQueries({ queryKey: ['feed'] });
      fetchComments();
    } catch (err) {
      console.error('Failed to post comment', err);
      setComments(prev => prev.filter(c => c.id !== temp.id));
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[70vh] bg-zinc-900 rounded-t-3xl border-t border-zinc-800 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="font-semibold text-zinc-100">Comments</span>
              <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400">
                <X size={22} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center text-zinc-500 gap-2">
                  <p className="text-sm">No comments yet.</p>
                  <p className="text-xs">Be the first to share your thoughts!</p>
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <Avatar
                      src={c.author?.avatar_url}
                      name={c.author?.display_name || c.author?.username}
                      username={c.author?.username}
                      size={8}
                      linkTo={`/profile/${c.author?.username}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-white text-[13px] font-semibold">{c.author?.username}</span>
                        <span className="text-zinc-500 text-[11px]">
                          {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-zinc-200 text-[13px] mt-0.5 leading-snug">{c.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-zinc-800 pb-8 sm:pb-4">
              {user ? (
                <form
                  onSubmit={handlePost}
                  className="flex gap-2 items-center bg-zinc-800 rounded-2xl px-3 py-1 border border-zinc-700 focus-within:border-orange-500/60 transition-colors"
                >
                  <input
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 bg-transparent border-none py-3 text-sm text-white focus:outline-none placeholder:text-zinc-500"
                    disabled={isPosting}
                  />
                  <button
                    type="submit"
                    disabled={!commentText.trim() || isPosting}
                    className="p-2 text-orange-400 disabled:text-zinc-600 hover:text-orange-300 transition-colors"
                  >
                    {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </form>
              ) : (
                <p className="text-center text-zinc-500 text-sm py-2">Log in to comment</p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
