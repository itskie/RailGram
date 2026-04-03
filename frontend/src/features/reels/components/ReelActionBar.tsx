import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import type { Reel } from '../types/reel';
import { useAuthStore } from '../../../store/authStore';
import { reels as reelsApi } from '../../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ThreeDotMenu from '../../../components/ThreeDotMenu';
import { useLoginPrompt } from '../../../hooks/useLoginPrompt';
import clsx from 'clsx';
import { useReelSave } from '../../../hooks/useEngagement';
import { useState } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog';

interface ReelActionBarProps {
  reel: Reel;
  onCommentClick: () => void;
  variant?: 'overlay' | 'sidebar';
  liked: boolean;
  likeCount: number;
  onLike: () => void;
  commentCount?: number;
}

export function ReelActionBar({ reel, onCommentClick, variant = 'overlay', liked, likeCount, onLike, commentCount }: ReelActionBarProps) {
  const me = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const qc = useQueryClient();
  const isOwnReel = me?.id === reel.user.id;
  const { requireAuth } = useLoginPrompt();
  const [, setLikeAnim] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  const toggleLike = onLike;
  const { saved, toggle: toggleSave } = useReelSave(
    reel.id, reel.viewer_saved ?? false
  );

  const deleteMut = useMutation({
    mutationFn: () => reelsApi.delete(reel.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reels"], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ["user-reels"], refetchType: 'active' });
      qc.invalidateQueries({ queryKey: ["unified_feed"], refetchType: 'active' });
    },
  });

  const menuOptions = isOwnReel
    ? [
        {
          label: "Delete reel",
          danger: true,
          onClick: () => setConfirmOpen(true),
        },
        {
          label: "Copy link",
          onClick: () => navigator.clipboard.writeText(`${window.location.origin}/reels/${reel.id}`),
        },
      ]
    : [
        {
          label: "Go to profile",
          onClick: () => nav(`/profile/${reel.user.username}`),
        },
        {
          label: "Copy link",
          onClick: () => navigator.clipboard.writeText(`${window.location.origin}/reels/${reel.id}`),
        },
        {
          label: "Report",
          danger: true,
          onClick: () => alert("Thanks for your report. We'll review it."),
        },
      ];

  const handleLike = () => {
    if (!requireAuth()) return;
    if (!liked) { setLikeAnim(true); setTimeout(() => setLikeAnim(false), 400); }
    toggleLike();
  };

  const handleSave = () => {
    if (!requireAuth()) return;
    toggleSave();
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: reel.title,
          text: reel.description,
          url: window.location.origin + `/reels/${reel.id}`,
        });
      } else {
        await navigator.clipboard.writeText(window.location.origin + `/reels/${reel.id}`);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing', err);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { notation: 'compact', compactDisplay: 'short' }).format(n);

  const ActionButton = ({ icon: Icon, count, onClick, active = false, activeColor, filled = false }: {
    icon: any; count?: number; onClick?: () => void;
    active?: boolean; activeColor?: string; filled?: boolean;
  }) => (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 group outline-none"
    >
      <Icon
        size={24}
        className={clsx(
          'filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] transition-all group-hover:scale-110 active:scale-90',
          active ? activeColor : 'text-white'
        )}
        fill={active || filled ? 'currentColor' : 'none'}
        strokeWidth={active || filled ? 0 : 1.8}
      />
      {count !== undefined && (
        <span className="text-white text-[13px] font-semibold drop-shadow-[0_1px_4px_rgba(0,0,0,1)] leading-none">
          {fmt(count)}
        </span>
      )}
    </button>
  );

  return (
    <div className={clsx(
      'flex flex-col items-center gap-6 z-10 pointer-events-auto',
      variant === 'overlay' ? 'absolute right-3 bottom-20' : 'relative mb-8'
    )}>
      {/* Like */}
      <ActionButton
        icon={Heart}
        count={likeCount}
        onClick={handleLike}
        active={liked}
        activeColor="text-red-500"
      />

      {/* Comment */}
      <ActionButton
        icon={MessageCircle}
        count={commentCount ?? reel.comments_count}
        onClick={onCommentClick}
      />

      {/* Share / Send */}
      <ActionButton
        icon={Send}
        onClick={handleShare}
      />

      {/* Bookmark / Save */}
      <ActionButton
        icon={Bookmark}
        count={reel.saves_count ?? 0}
        onClick={handleSave}
        active={saved}
        activeColor="text-yellow-400"
      />

      {/* Three dot menu */}
      {me && <ThreeDotMenu options={menuOptions} iconColor="white" align="left" direction="up" />}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete this reel?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { deleteMut.mutate(); setConfirmOpen(false); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
