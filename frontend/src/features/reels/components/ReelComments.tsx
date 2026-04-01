import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, User, Loader2, Heart, CornerDownRight, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../../../store/authStore';
import { useComments } from '../../../hooks/useComments';
import type { Comment } from '../../../hooks/useComments';
import { formatDistanceToNow } from 'date-fns';

interface ReelCommentsProps {
  isOpen: boolean;
  onClose: () => void;
  reelId: string;
}

export function ReelComments({ isOpen, onClose, reelId }: ReelCommentsProps) {
  const [commentText, setCommentText] = useState('');
  const { user } = useAuthStore();

  const {
    comments,
    isLoading,
    isPosting,
    replyingTo,
    setReplyingTo,
    expandedReplies,
    loadingReplies,
    postComment,
    likeComment,
    loadReplies,
  } = useComments({ type: 'reel', entityId: reelId, isOpen });

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    postComment(commentText);
    setCommentText('');
  };

  const renderComment = (c: Comment, isReply = false, parentId?: string) => (
    <div key={c.id} className={`flex gap-3 animate-in fade-in duration-300 ${isReply ? 'ml-10' : ''}`}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
        {c.author?.avatar_url ? (
          <img src={c.author.avatar_url} className="w-full h-full object-cover" alt="" />
        ) : (
          <User size={16} className="text-zinc-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">{c.author?.username || 'user'}</span>
          <span className="text-[10px] text-zinc-500">{formatDistanceToNow(new Date(c.created_at))} ago</span>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{c.body}</p>
        <div className="flex items-center gap-4 mt-1">
          {user && !isReply && (
            <button
              onClick={() => setReplyingTo(c)}
              className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <CornerDownRight size={11} /> Reply
            </button>
          )}
          <button
            onClick={() => likeComment(c, parentId)}
            className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${c.liked ? 'text-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            <Heart size={11} className={c.liked ? 'fill-red-400' : ''} />
            {c.like_count > 0 && c.like_count}
          </button>
        </div>
        {!isReply && c.reply_count > 0 && (
          <button
            onClick={() => loadReplies(c)}
            className="flex items-center gap-1 mt-1 text-[11px] font-bold text-zinc-500 hover:text-teal-400 transition-colors"
          >
            {loadingReplies[c.id] ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <ChevronDown size={11} className={expandedReplies[c.id] ? 'rotate-180 transition-transform' : 'transition-transform'} />
            )}
            {expandedReplies[c.id] ? 'Hide' : `${c.reply_count} ${c.reply_count === 1 ? 'reply' : 'replies'}`}
          </button>
        )}
      </div>
    </div>
  );

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
                  <div key={c.id} className="space-y-3">
                    {renderComment(c)}
                    {expandedReplies[c.id]?.map(r => renderComment(r, true, c.id))}
                  </div>
                ))
              )}
            </div>

            {/* Input Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 pb-8 sm:pb-4">
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
                  <CornerDownRight size={11} />
                  <span>Replying to <span className="text-teal-400 font-semibold">@{replyingTo.author.username}</span></span>
                  <button onClick={() => setReplyingTo(null)} className="ml-auto text-zinc-600 hover:text-zinc-400">
                    <X size={13} />
                  </button>
                </div>
              )}
              <form onSubmit={handlePostComment} className="flex gap-2 items-center bg-zinc-800 rounded-2xl px-3 py-1 border border-zinc-700 focus-within:border-teal-500 transition-colors">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={replyingTo ? `Reply to @${replyingTo.author.username}...` : 'Add a comment...'}
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
