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
      className="flex flex-col items-center gap-1 group outline-none"
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
      <span className="text-white font-bold text-[13px] drop-shadow-[0_2px_3px_rgba(0,0,0,1)]">
        {label > 0 ? new Intl.NumberFormat('en-IN', { notation: "compact", compactDisplay: "short" }).format(label) : '0'}
      </span>
    </button>
  );

  return (
    <div className="absolute right-2 bottom-20 flex flex-col gap-5 z-10 pointer-events-auto items-center pr-2">
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
        className="flex flex-col items-center gap-1 group outline-none mt-1"
      >
        <div className="p-2 transition-transform active:scale-90 group-hover:scale-110">
          <Share2 
            className="w-8 h-8 text-white filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:text-zinc-200" 
            strokeWidth={2.2}
          />
        </div>
        <span className="text-white font-bold text-[13px] drop-shadow-[0_2px_3px_rgba(0,0,0,1)]">Share</span>
      </button>
    </div>
  );
}
