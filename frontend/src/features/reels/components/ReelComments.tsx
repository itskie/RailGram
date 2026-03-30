import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, Loader2 } from 'lucide-react';
import { reels } from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { formatDistanceToNow } from 'date-fns';

interface ReelCommentsProps {
  isOpen: boolean;
  onClose: () => void;
  reelId: string;
}

export function ReelComments({ isOpen, onClose, reelId }: ReelCommentsProps) {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, reelId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const data = await reels.getComments(reelId);
      setComments(Array.isArray(data) ? data : (data as any).items || []);
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isPosting || !user) return;

    const newComment = {
      id: 'temp-' + Date.now(),
      body: commentText,
      created_at: new Date().toISOString(),
      user: {
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
      }
    };

    setIsPosting(true);
    // Optimistic Update
    setComments(prev => [newComment, ...prev]);
    setCommentText('');

    try {
      await reels.addComment(reelId, commentText);
      // We don't necessarily need to re-fetch if backend confirmed success,
      // but usually fetching gives the real ID.
    } catch (err) {
      console.error('Failed to post comment', err);
      // Rollback on error
      setComments(prev => prev.filter(c => c.id !== newComment.id));
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
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-30"
          />
          
          {/* Drawer Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 h-[70%] bg-zinc-900 rounded-t-3xl border-t border-zinc-800 z-40 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <span className="font-semibold text-zinc-100">Comments</span>
              <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400">
                <X size={24} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col h-full items-center justify-center text-zinc-500 gap-2">
                  <p className="text-sm">No comments yet.</p>
                  <p className="text-xs">Be the first to share your thoughts!</p>
                </div>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-3 animate-in fade-in duration-300">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                      {c.user?.avatar_url ? (
                        <img src={c.user.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <User size={16} className="text-zinc-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-zinc-100">{c.user?.username || 'user'}</span>
                        <span className="text-[10px] text-zinc-500">{formatDistanceToNow(new Date(c.created_at))} ago</span>
                      </div>
                      <p className="text-sm text-zinc-300 leading-relaxed">{c.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 pb-8 sm:pb-4">
              <form onSubmit={handlePostComment} className="flex gap-2 items-center bg-zinc-800 rounded-2xl px-3 py-1 border border-zinc-700 focus-within:border-teal-500 transition-colors">
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
                  className="p-2 text-teal-400 disabled:text-zinc-600 hover:text-teal-300 transition-colors"
                >
                  {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
