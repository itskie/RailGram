import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ActionSheetIOS, Alert, Platform, Share } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';
import type { Reel } from '../types/reel';
import { useAuthStore } from '../../../store/authStore';
import { useReelActions } from '../hooks/useReelActions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reelsApi } from '../../../api/client';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ReelOverlayProps {
  reel: Reel;
}

export function ReelOverlay({ reel }: ReelOverlayProps) {
  const { user: currentUser } = useAuthStore();
  const { toggleFollow } = useReelActions();
  const navigation = useNavigation<Nav>();
  const qc = useQueryClient();
  const isOwnReel = Boolean(currentUser && currentUser.id === reel.user.id);
  const isFollowing = Boolean(reel.user.viewer_followed);

  const goToProfile = () => navigation.navigate('UserProfile', { username: reel.user.username });

  const deleteMut = useMutation({
    mutationFn: () => reelsApi.delete(reel.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reels'] }),
  });

  const showMenu = () => {
    const reelUrl = `https://railgram.in/reels/${reel.id}`;
    if (isOwnReel) {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Copy Link', 'Delete Reel'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
          (i) => {
            if (i === 1) Share.share({ url: reelUrl });
            if (i === 2) Alert.alert('Delete Reel', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate() },
            ]);
          }
        );
      } else {
        Alert.alert('Reel Options', '', [
          { text: 'Copy Link', onPress: () => Share.share({ message: reelUrl }) },
          { text: 'Delete Reel', style: 'destructive', onPress: () => Alert.alert('Delete Reel', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteMut.mutate() },
          ]) },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    } else {
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ['Cancel', 'Go to Profile', 'Copy Link', 'Report'], destructiveButtonIndex: 3, cancelButtonIndex: 0 },
          (i) => {
            if (i === 1) goToProfile();
            if (i === 2) Share.share({ url: reelUrl });
            if (i === 3) Alert.alert('Reported', "Thanks for your report. We'll review it.");
          }
        );
      } else {
        Alert.alert('Reel Options', '', [
          { text: 'Go to Profile', onPress: goToProfile },
          { text: 'Copy Link', onPress: () => Share.share({ message: reelUrl }) },
          { text: 'Report', style: 'destructive', onPress: () => Alert.alert('Reported', "Thanks for your report.") },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }
    }
  };

  return (
    <LinearGradient
      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.8)']}
      style={styles.container}
      pointerEvents="none"
    >
      <View style={styles.content} pointerEvents="auto">
        {/* User Info — Instagram-style: handle row + Follow pill */}
        <View style={styles.userRow}>
          <Pressable onPress={goToProfile}>
            {reel.user.avatar_url ? (
              <Image source={{ uri: reel.user.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{reel.user.username.slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
          </Pressable>
          <View style={styles.handleRow}>
              <Pressable onPress={goToProfile}>
                <Text style={styles.handle} numberOfLines={1}>
                  {reel.user.username}
                </Text>
              </Pressable>
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
              {currentUser && (
                <Pressable onPress={showMenu} hitSlop={8} style={styles.menuBtn}>
                  <Text style={styles.menuDots}>•••</Text>
                </Pressable>
              )}
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
  },
  menuBtn: { padding: 4 },
  menuDots: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});
