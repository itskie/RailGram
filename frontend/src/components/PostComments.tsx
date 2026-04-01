import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Heart, CornerDownRight, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useComments } from '../hooks/useComments';
import type { Comment } from '../hooks/useComments';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';

interface PostCommentsProps {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
}

export function PostComments({ isOpen, onClose, postId }: PostCommentsProps) {
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
  } = useComments({ type: 'post', entityId: postId, isOpen });

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    postComment(commentText);
    setCommentText('');
  };

  const handleReply = (comment: Comment) => {
    if (comment.parent_id) return;
    setReplyingTo(comment);
    setCommentText(`@${comment.author.username} `);
  };

  const renderComment = (c: Comment, depth: number = 0, parentId?: string) => {
    const isReply = depth > 0;
    const hasReplies = c.reply_count > 0;
    const isExpanded = !!expandedReplies[c.id];
    const isLoadingReplies = loadingReplies[c.id];

    return (
      <div key={c.id} className={`${isReply ? 'ml-8' : ''}`}>
        <div className="flex gap-3 py-3">
          <Avatar
            src={c.author?.avatar_url}
            name={c.author?.display_name || c.author?.username}
            username={c.author?.username}
            size={isReply ? 7 : 8}
            linkTo={`/profile/${c.author?.username}`}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-white text-[13px] font-semibold">{c.author?.username}</span>
              <span className="text-zinc-500 text-[11px]">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-zinc-200 text-[13px] mt-0.5 leading-snug whitespace-pre-wrap">{c.body}</p>
            <div className="flex items-center gap-4 mt-1.5">
              {user && !isReply && (
                <button
                  onClick={() => handleReply(c)}
                  className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                >
                  Reply
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
            {/* Show replies toggle */}
            {hasReplies && (
              <button
                onClick={() => loadReplies(c)}
                className="flex items-center gap-1 mt-1.5 text-[11px] font-bold text-zinc-500 hover:text-orange-400 transition-colors"
              >
                {isLoadingReplies ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <ChevronDown size={11} className={isExpanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
                )}
                {isExpanded ? 'Hide replies' : `${c.reply_count} ${c.reply_count === 1 ? 'reply' : 'replies'}`}
              </button>
            )}
          </div>
        </div>
        {/* Render expanded replies */}
        {isExpanded && expandedReplies[c.id] && (
          <div className="border-l-2 border-zinc-800 ml-4 pl-2">
            {expandedReplies[c.id].map(reply => renderComment(reply, depth + 1, c.id))}
          </div>
        )}
      </div>
    );
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
            className="fixed bottom-0 left-0 md:left-[72px] right-0 w-full max-w-[470px] mx-auto h-[70%] bg-zinc-900 rounded-t-3xl border-t border-zinc-800 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <span className="font-semibold text-zinc-100">Comments</span>
              <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full text-zinc-400">
                <X size={22} />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
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
                <div className="space-y-0">
                  {comments.map((c) => renderComment(c))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-zinc-800 pb-8 sm:pb-4">
              {replyingTo && (
                <div className="flex items-center gap-2 mb-2 text-xs text-zinc-400">
                  <CornerDownRight size={11} />
                  <span>Replying to <span className="text-orange-400 font-semibold">@{replyingTo.author.username}</span></span>
                  <button onClick={() => setReplyingTo(null)} className="ml-auto text-zinc-600 hover:text-zinc-400">
                    <X size={13} />
                  </button>
                </div>
              )}
              {user ? (
                <form
                  onSubmit={handlePost}
                  className="flex gap-2 items-center bg-zinc-800 rounded-2xl px-3 py-1 border border-zinc-700 focus-within:border-orange-500/60 transition-colors"
                >
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
