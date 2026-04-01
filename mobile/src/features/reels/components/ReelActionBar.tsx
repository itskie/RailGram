import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Share, StyleSheet } from 'react-native';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react-native';
import type { Reel } from '../types/reel';
import { useReelActions } from '../hooks/useReelActions';

interface ReelActionBarProps {
  reel: Reel;
  onCommentClick: () => void;
  viewsOverride?: number;
}

export function ReelActionBar({ reel, onCommentClick, viewsOverride }: ReelActionBarProps) {
  const { toggleLike, toggleSave } = useReelActions();
  const [localLiked, setLocalLiked] = useState(reel.viewer_liked);
  const [localLikeCount, setLocalLikeCount] = useState(reel.likes_count);
  const [localSaved, setLocalSaved] = useState(reel.viewer_saved);
  const [localSaveCount, setLocalSaveCount] = useState(reel.saves_count);

  const handleLike = () => {
    toggleLike({ id: reel.id, isLiked: localLiked });
    setLocalLiked((v) => !v);
    setLocalLikeCount((c) => localLiked ? Math.max(0, c - 1) : c + 1);
  };

  const handleSave = () => {
    toggleSave({ id: reel.id, isSaved: localSaved });
    setLocalSaved((v) => !v);
    setLocalSaveCount((c) => localSaved ? Math.max(0, c - 1) : c + 1);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this reel: ${reel.title} on RailGram! https://railgram.in/reels/${reel.id}`,
      });
    } catch (error) {
       console.error(error);
    }
  };

  const ActionButton = ({ icon: Icon, label, onPress, active, color }: any) => (
    <TouchableOpacity 
      style={styles.actionButton} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, active && styles.activeBg]}>
        <Icon 
          color={active ? color : 'white'} 
          fill={active ? color : 'transparent'} 
          size={32} 
          strokeWidth={2.4}
        />
      </View>
      <Text style={styles.actionText}>
        {label > 0 ? Intl.NumberFormat('en-IN', { notation: 'compact' }).format(label) : '0'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      <ActionButton
        icon={Heart}
        label={localLikeCount}
        onPress={handleLike}
        active={localLiked}
        color="#f43f5e"
      />
      <ActionButton
        icon={MessageCircle}
        label={reel.comments_count}
        onPress={onCommentClick}
      />
      <ActionButton
        icon={Bookmark}
        label={localSaveCount}
        onPress={handleSave}
        active={localSaved}
        color="#eab308"
      />
      
      <TouchableOpacity 
        style={styles.actionButton} 
        onPress={handleShare} 
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Share2 color="white" size={32} strokeWidth={2.4} />
        </View>
        <Text style={styles.actionText}>Share</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 8,
    bottom: 24, // Clear bottom tabs
    alignItems: 'center',
    gap: 16,
    zIndex: 20,
  },
  actionButton: {
    alignItems: 'center',
    gap: 2,
    marginVertical: 4,
  },
  iconContainer: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBg: {
    // No background needed for active state to keep it clean
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  }
});
