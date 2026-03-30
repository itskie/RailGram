import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2, Heart, CornerDownRight, ChevronDown } from 'lucide-react';
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

interface CommentData {
  id: string;
  body: string;
  created_at: string;
  like_count: number;
  reply_count: number;
  parent_id: string | null;
  author: { username: string; display_name?: string; avatar_url?: string };
  liked?: boolean;
}

export function PostComments({ isOpen, onClose, postId }: PostCommentsProps) {
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CommentData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, CommentData[]>>({});
  const [loadingReplies, setLoadingReplies] = useState<Record<string, boolean>>({});
  const { user } = useAuthStore();
  const qc = useQueryClient();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      setReplyingTo(null);
      setCommentText('');
      setExpandedReplies({});
    }
  }, [isOpen, postId]);

  const fetchComments = async () => {
    setIsLoading(true);
    try {
      const data = await postsApi.comments(postId) as any;
      setComments(Array.isArray(data) ? data : (data?.comments || []));
    } catch (err) {
      console.error('Failed to fetch comments', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReply = (comment: CommentData) => {
    // Only allow replies to root comments (no nested replies)
    if (comment.parent_id) {
      return; // Can't reply to a reply
    }
    setReplyingTo({ id: comment.id, username: comment.author.username });
    setCommentText(`@${comment.author.username} `);
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isPosting || !user) return;

    const tempId = 'temp-' + Date.now();
    const temp: CommentData = {
      id: tempId,
      body: commentText,
      created_at: new Date().toISOString(),
      like_count: 0,
      reply_count: 0,
      parent_id: replyingTo?.id ?? null,
      author: { username: user.username, display_name: user.display_name ?? undefined, avatar_url: user.avatar_url ?? undefined },
    };

    setIsPosting(true);
    const parentId = replyingTo?.id;

    if (parentId) {
      // Optimistically add to expanded replies
      setExpandedReplies(prev => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), temp],
      }));
    } else {
      setComments(prev => [...prev, temp]);
    }
    setCommentText('');
    setReplyingTo(null);

    try {
      await postsApi.addComment(postId, temp.body, parentId);
      qc.invalidateQueries({ queryKey: ['feed'] });
      if (parentId) {
        // Refresh replies
        const response = await postsApi.getReplies(postId, parentId) as any;
        const replies = Array.isArray(response) ? response : (response?.comments || []);
        setExpandedReplies(prev => ({ ...prev, [parentId]: replies }));
        // Bump reply count on parent
        setComments(prev => prev.map(c => c.id === parentId ? { ...c, reply_count: c.reply_count + 1 } : c));
      } else {
        fetchComments();
      }
    } catch (err) {
      console.error('Failed to post comment', err);
      if (parentId) {
        setExpandedReplies(prev => ({ ...prev, [parentId]: (prev[parentId] || []).filter(c => c.id !== tempId) }));
      } else {
        setComments(prev => prev.filter(c => c.id !== tempId));
      }
    } finally {
      setIsPosting(false);
    }
  };

  const handleLikeComment = async (comment: CommentData, isReply: boolean, parentId?: string) => {
    if (!user) return;
    const newLiked = !comment.liked;
    const delta = newLiked ? 1 : -1;

    const updateComment = (c: CommentData) =>
      c.id === comment.id ? { ...c, liked: newLiked, like_count: c.like_count + delta } : c;

    if (isReply && parentId) {
      setExpandedReplies(prev => ({
        ...prev,
        [parentId]: Array.isArray(prev[parentId]) ? prev[parentId].map(updateComment) : []
      }));
    } else {
      setComments(prev => prev.map(updateComment));
    }

    try {
      await postsApi.likeComment(comment.id);
    } catch {
      // revert
      if (isReply && parentId) {
        setExpandedReplies(prev => ({
          ...prev,
          [parentId]: Array.isArray(prev[parentId]) ? prev[parentId].map(c =>
            c.id === comment.id ? { ...c, liked: !newLiked, like_count: c.like_count - delta } : c
          ) : []
        }));
      } else {
        setComments(prev => prev.map(c =>
          c.id === comment.id ? { ...c, liked: !newLiked, like_count: c.like_count - delta } : c
        ));
      }
    }
  };

  const handleLoadReplies = async (comment: CommentData) => {
    if (expandedReplies[comment.id]) {
      // Toggle off
      setExpandedReplies(prev => { const next = { ...prev }; delete next[comment.id]; return next; });
      return;
    }
    setLoadingReplies(prev => ({ ...prev, [comment.id]: true }));
    try {
      const response = await postsApi.getReplies(postId, comment.id) as any;
      const replies = Array.isArray(response) ? response : (response?.comments || []);
      setExpandedReplies(prev => ({ ...prev, [comment.id]: replies }));
      // Update parent comment's reply_count to match what we loaded
      setComments(prev => prev.map(c => 
        c.id === comment.id ? { ...c, reply_count: replies.length } : c
      ));
    } catch (err) {
      console.error('Failed to load replies', err);
    } finally {
      setLoadingReplies(prev => ({ ...prev, [comment.id]: false }));
    }
  };

  const renderComment = (c: CommentData, depth: number = 0, parentId?: string) => {
    const isReply = depth > 0;
    const hasReplies = c.reply_count > 0;
    const isExpanded = !!expandedReplies[c.id];
    const isLoading = loadingReplies[c.id];

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
                onClick={() => handleLikeComment(c, isReply, parentId)}
                className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${c.liked ? 'text-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <Heart size={11} className={c.liked ? 'fill-red-400' : ''} />
                {c.like_count > 0 && c.like_count}
              </button>
            </div>
            {/* Show replies toggle */}
            {hasReplies && (
              <button
                onClick={() => handleLoadReplies(c)}
                className="flex items-center gap-1 mt-1.5 text-[11px] font-bold text-zinc-500 hover:text-orange-400 transition-colors"
              >
                {isLoading ? (
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
                  <span>Replying to <span className="text-orange-400 font-semibold">@{replyingTo.username}</span></span>
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
                    placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
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
