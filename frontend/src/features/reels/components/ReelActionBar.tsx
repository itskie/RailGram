import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import type { Reel } from '../types/reel';
import { useReelActions } from '../hooks/useReelActions';
import clsx from 'clsx';

interface ReelActionBarProps {
  reel: Reel;
  onCommentClick: () => void;
}

export function ReelActionBar({ reel, onCommentClick }: ReelActionBarProps) {
  const { toggleLike, toggleSave } = useReelActions();

  const handleLike = () => {
    toggleLike({ id: reel.id, isLiked: reel.viewer_liked });
  };

  const handleSave = () => {
    toggleSave({ id: reel.id, isSaved: reel.viewer_saved });
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
      className="flex flex-col items-center gap-1.5 group outline-none"
    >
      <div className={clsx(
        "p-3 rounded-full bg-black/40 backdrop-blur-md transition-transform active:scale-95 border border-white/10",
        active && "bg-black/60"
      )}>
        <Icon 
          className={clsx("w-6 h-6 transition-colors", active ? activeColor : "text-white group-hover:text-zinc-300")} 
          fill={active ? "currentColor" : "none"}
        />
      </div>
      <span className="text-white font-medium text-xs drop-shadow-md">
        {label > 0 ? new Intl.NumberFormat('en-IN', { notation: "compact", compactDisplay: "short" }).format(label) : '0'}
      </span>
    </button>
  );

  return (
    <div className="absolute right-4 bottom-24 flex flex-col gap-6 z-10 pointer-events-auto items-center">
      <ActionButton
        icon={Heart}
        label={reel.likes_count}
        onClick={handleLike}
        active={reel.viewer_liked}
        activeColor="text-red-500"
      />
      <ActionButton
        icon={MessageCircle}
        label={reel.comments_count}
        onClick={onCommentClick}
      />
      <ActionButton
        icon={Bookmark}
        label={reel.saves_count}
        onClick={handleSave}
        active={reel.viewer_saved}
        activeColor="text-yellow-400"
      />
      <button 
        onClick={handleShare}
        className="flex flex-col items-center gap-1.5 group outline-none mt-2"
      >
        <div className="p-3 rounded-full bg-black/40 backdrop-blur-md transition-transform active:scale-95 border border-white/10">
          <Share2 className="w-6 h-6 text-white group-hover:text-zinc-300" />
        </div>
        <span className="text-white font-medium text-xs drop-shadow-md">Share</span>
      </button>
    </div>
  );
}
