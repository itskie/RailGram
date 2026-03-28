import React from 'react';
import { View, Text, TouchableOpacity, Share, StyleSheet } from 'react-native';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react-native';
import type { Reel } from '../types/reel';
import { useReelActions } from '../hooks/useReelActions';

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
          size={24} 
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
        label={reel.likes_count}
        onPress={handleLike}
        active={reel.viewer_liked}
        color="#f43f5e" // rose-500
      />
      <ActionButton
        icon={MessageCircle}
        label={reel.comments_count}
        onPress={onCommentClick}
      />
      <ActionButton
        icon={Bookmark}
        label={reel.saves_count}
        onPress={handleSave}
        active={reel.viewer_saved}
        color="#eab308" // yellow-500
      />
      
      <TouchableOpacity 
        style={styles.actionButton} 
        onPress={handleShare} 
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Share2 color="white" size={24} />
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
    gap: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeBg: {
    backgroundColor: 'rgba(0,0,0,0.6)',
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
