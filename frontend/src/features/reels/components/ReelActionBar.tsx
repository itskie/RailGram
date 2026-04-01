import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import type { Reel } from '../types/reel';
import { useAuthStore } from '../../../store/authStore';
import { useEngagement } from '../../../hooks/useEngagement';
import { reels as reelsApi } from '../../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ThreeDotMenu from '../../../components/ThreeDotMenu';
import { useLoginPrompt } from '../../../hooks/useLoginPrompt';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

interface ReelActionBarProps {
  reel: Reel;
  onCommentClick: () => void;
  variant?: 'overlay' | 'sidebar';
  viewsOverride?: number;
}

export function ReelActionBar({ reel, onCommentClick, variant = 'overlay', viewsOverride }: ReelActionBarProps) {
  const { toggleLike, toggleSave } = useEngagement();
  const me = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const qc = useQueryClient();
  const isOwnReel = me?.id === reel.user.id;
  const { requireAuth } = useLoginPrompt();

  const [localLiked, setLocalLiked] = useState(reel.viewer_liked ?? false);
  const [localLikeCount, setLocalLikeCount] = useState(reel.likes_count ?? 0);
  const [localSaved, setLocalSaved] = useState(reel.viewer_saved ?? false);
  const [localSaveCount, setLocalSaveCount] = useState(reel.saves_count ?? 0);
  const displayViews = viewsOverride ?? reel.views;

  // Sync local state when reel prop updates (after refetch or navigation)
  useEffect(() => {
    setLocalLiked(reel.viewer_liked ?? false);
    setLocalLikeCount(reel.likes_count ?? 0);
    setLocalSaved(reel.viewer_saved ?? false);
    setLocalSaveCount(reel.saves_count ?? 0);
  }, [reel.viewer_liked, reel.likes_count, reel.viewer_saved, reel.saves_count]);


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
          onClick: () => {
            if (window.confirm("Delete this reel?")) deleteMut.mutate();
          },
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
    // Optimistic update
    setLocalLiked((v) => !v);
    setLocalLikeCount((c) => localLiked ? Math.max(0, c - 1) : c + 1);
    // Global engagement hook handles the API call
    toggleLike('reel', parseInt(reel.id.toString()));
  };

  const handleSave = () => {
    if (!requireAuth()) return;
    // Optimistic update
    setLocalSaved((v) => !v);
    setLocalSaveCount((c) => localSaved ? Math.max(0, c - 1) : c + 1);
    // Global engagement hook handles the API call
    toggleSave(parseInt(reel.id.toString()));
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

  const ActionButton = ({ icon: Icon, label, onClick, active = false, activeColor }: any) => (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center gap-1 group outline-none",
        variant === 'sidebar' ? "my-1" : "my-0"
      )}
    >
      <div className="p-2 transition-transform active:scale-90 group-hover:scale-110">
        <Icon
          className={clsx(
            "w-8 h-8 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] transition-colors",
            active ? activeColor : "text-white group-hover:text-zinc-200"
          )}
          fill={active ? "currentColor" : "none"}
          strokeWidth={2.2}
        />
      </div>
      <span className={clsx(
        "text-white font-bold text-[13px] drop-shadow-[0_2px_3px_rgba(0,0,0,1)]",
        variant === 'sidebar' && "text-zinc-300 group-hover:text-white"
      )}>
        {label > 0 ? new Intl.NumberFormat('en-IN', { notation: "compact", compactDisplay: "short" }).format(label) : '0'}
      </span>
    </button>
  );

  const ViewsDisplay = () => (
    <div className="flex flex-col items-center gap-1 my-1">
      <div className="px-3 py-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
        <span className="text-white font-bold text-[13px] drop-shadow-md">
          {displayViews > 0
            ? new Intl.NumberFormat('en-IN', { notation: "compact", compactDisplay: "short" }).format(displayViews)
            : '0'
          }
        </span>
      </div>
      <span className={clsx(
        "text-white font-bold text-[13px] drop-shadow-[0_2px_3px_rgba(0,0,0,1)]",
        variant === 'sidebar' && "text-zinc-300 group-hover:text-white"
      )}>Views</span>
    </div>
  );

  return (
    <div className={clsx(
      "flex flex-col gap-5 z-10 pointer-events-auto items-center",
      variant === 'overlay' ? "absolute right-2 bottom-20 pr-2" : "relative mb-8"
    )}>
      <ActionButton
        icon={Heart}
        label={localLikeCount}
        onClick={handleLike}
        active={localLiked}
        activeColor="text-red-500"
      />
      <ActionButton
        icon={MessageCircle}
        label={reel.comments_count}
        onClick={onCommentClick}
      />
      <ActionButton
        icon={Bookmark}
        label={localSaveCount}
        onClick={handleSave}
        active={localSaved}
        activeColor="text-yellow-400"
      />

      <ViewsDisplay />

      <button
        onClick={handleShare}
        className="flex flex-col items-center gap-1 group outline-none mt-1"
      >
        <div className="p-2 transition-transform active:scale-90 group-hover:scale-110">
          <Share2
            className="w-8 h-8 text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:text-zinc-200"
            strokeWidth={2.2}
          />
        </div>
        <span className={clsx(
          "text-white font-bold text-[13px] drop-shadow-[0_2px_3px_rgba(0,0,0,1)]",
          variant === 'sidebar' && "text-zinc-300 group-hover:text-white"
        )}>Share</span>
      </button>
      {me && (
        <div className="mt-1">
          <ThreeDotMenu options={menuOptions} iconColor="white" align="left" direction="up" />
        </div>
      )}
    </div>
  );
}
