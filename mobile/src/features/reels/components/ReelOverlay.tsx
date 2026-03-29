import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Reel } from '../types/reel';
import { useAuthStore } from '../../../store/authStore';
import { useReelActions } from '../hooks/useReelActions';

interface ReelOverlayProps {
  reel: Reel;
}

export function ReelOverlay({ reel }: ReelOverlayProps) {
  const { user: currentUser } = useAuthStore();
  const { toggleFollow } = useReelActions();
  const isOwnReel = Boolean(currentUser && currentUser.id === reel.user.id);
  const isFollowing = Boolean(reel.user.viewer_followed);

  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
      style={styles.container}
      pointerEvents="none"
    >
      <View style={styles.content} pointerEvents="auto">
        {/* User Info — Instagram-style: handle row + Follow pill */}
        <View style={styles.userRow}>
          {reel.user.avatar_url ? (
            <Image source={{ uri: reel.user.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{reel.user.username.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.userTextBlock}>
            <View style={styles.handleRow}>
              <Text style={styles.handle} numberOfLines={1}>
                {reel.user.username}
              </Text>
              {currentUser && !isOwnReel && (
                <Pressable
                  onPress={() =>
                    toggleFollow({
                      username: reel.user.username,
                      id: reel.id,
                      isFollowing,
                    })
                  }
                  style={({ pressed }) => [
                    styles.followPill,
                    isFollowing ? styles.followPillFollowing : styles.followPillDefault,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.followPillText}>{isFollowing ? 'Following' : 'Follow'}</Text>
                </Pressable>
              )}
            </View>
            {!!(
              reel.user.display_name?.trim() &&
              reel.user.display_name !== reel.user.username
            ) && (
              <Text style={styles.displayNameSub} numberOfLines={1}>
                {reel.user.display_name}
              </Text>
            )}
            <Text style={styles.atUsername} numberOfLines={1}>
              @{reel.user.username}
            </Text>
          </View>
        </View>

        {reel.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {reel.description}
          </Text>
        ) : null}

        {/* Train & Station Tags */}
        {(reel.train_number || reel.station_tag) && (
          <View style={styles.tagRow}>
            <View style={styles.tagPill}>
              {reel.train_number && (
                <Text style={styles.tagText}>🚂 {reel.train_number} {reel.train_name ? `- ${reel.train_name}` : ''}</Text>
              )}
              {reel.train_number && reel.station_tag && <Text style={styles.tagDot}> • </Text>}
              {reel.station_tag && (
                <View style={styles.flexRow}>
                  <MapPin size={12} color="#ffffffaa" />
                  <Text style={[styles.tagText, { marginLeft: 4 }]}>{reel.station_tag}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 80, // For smooth gradient
    paddingBottom: 24, // Tab bar clearance
    paddingHorizontal: 16,
    zIndex: 10,
  },
  content: {
    paddingRight: 60, // Leave room for right action bar
    gap: 8,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  userTextBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  handle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
    maxWidth: '70%',
  },
  followPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  followPillDefault: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  followPillFollowing: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  followPillText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
  },
  displayNameSub: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '500',
  },
  atUsername: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3f3f46', // zinc-700
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tagRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  tagDot: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  }
});
