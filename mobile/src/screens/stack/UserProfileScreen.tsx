import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, FlatList, Modal, Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/client';
import type { Post, User } from '../../types';
import type { RootStackScreenProps } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';

type Props = RootStackScreenProps<'UserProfile'>;

export default function UserProfileScreen({ route, navigation }: Props) {
  const { username } = route.params;
  const { user: me } = useAuthStore();
  const queryClient = useQueryClient();
  const isOwnProfile = me?.username === username;
  const [listModal, setListModal] = useState<'followers' | 'following' | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.profile(username),
  });

  const { data: posts, isLoading: loadingPosts } = useQuery({
    queryKey: ['user-posts', username],
    queryFn: () => usersApi.posts(username),
  });

  const { data: modalList, isLoading: modalLoading } = useQuery<User[]>({
    queryKey: ['user-list', username, listModal],
    queryFn: () =>
      listModal === 'followers'
        ? usersApi.followers(username)
        : usersApi.following(username),
    enabled: !!listModal,
  });

  const followMutation = useMutation({
    mutationFn: () => usersApi.follow(username),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', username] }),
  });

  const blockMutation = useMutation({
    mutationFn: () => usersApi.block(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      navigation.goBack(); // Go back after blocking
    },
  });

  const unblockMutation = useMutation({
    mutationFn: () => usersApi.unblock(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      setShowMenu(false);
    },
  });

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#E53935" /></View>;
  }
  if (!profile) {
    return <View style={styles.centered}><Text style={styles.errorText}>User not found</Text></View>;
  }

  const isFollowing = Boolean(profile.is_following);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{profile.display_name[0].toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.headerTextContainer}>
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{profile.display_name}</Text>
            {profile.is_verified && <Text style={styles.verifiedBadge}>✓</Text>}
            {profile.is_private && <Text style={styles.privateBadge}>🔒</Text>}
          </View>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>
        {!isOwnProfile && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => setShowMenu(true)}
          >
            <Text style={styles.menuButtonText}>⋮</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{profile.follower_count}</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <TouchableOpacity style={styles.stat} onPress={() => setListModal('followers')}>
          <Text style={styles.statNum}>{profile.follower_count}</Text>
          <Text style={[styles.statLabel, styles.statLabelTap]}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stat} onPress={() => setListModal('following')}>
          <Text style={styles.statNum}>{profile.following_count}</Text>
          <Text style={[styles.statLabel, styles.statLabelTap]}>Following</Text>
        </TouchableOpacity>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{profile.karma ?? profile.karma_points}</Text>
          <Text style={styles.statLabel}>Karma</Text>
        </View>
      </View>

      {/* Follow button */}
      {!isOwnProfile && (
        <View style={styles.followSection}>
          <TouchableOpacity
            style={isFollowing ? styles.followingBtn : styles.followBtn}
            onPress={() => followMutation.mutate()}
            disabled={followMutation.isPending}
          >
            <Text style={isFollowing ? styles.followingBtnText : styles.followBtnText}>
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Private profile notice */}
      {profile.is_private && !isFollowing && !isOwnProfile ? (
        <View style={styles.privateNotice}>
          <Text style={styles.privateIcon}>🔒</Text>
          <Text style={styles.privateText}>This account is private</Text>
          <Text style={styles.privateSubtext}>Follow to see their posts</Text>
        </View>
      ) : (
        <View style={styles.postsSection}>
          {loadingPosts ? (
            <ActivityIndicator color="#E53935" style={{ marginTop: 32 }} />
          ) : (
            <FlatList
              data={posts ?? []}
              keyExtractor={(p) => p.id}
              numColumns={3}
              scrollEnabled={false}
              renderItem={({ item }: { item: Post }) => (
                <TouchableOpacity
                  style={styles.gridItem}
                  onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                >
                  {item.media_urls[0] ? (
                    <Image source={{ uri: item.media_urls[0] }} style={styles.gridImage} />
                  ) : (
                    <View style={[styles.gridImage, styles.gridNoImage]}>
                      <Text style={{ fontSize: 20 }}>🖼️</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.noPostsText}>No posts yet</Text>
              }
            />
          )}
        </View>
      )}

      {/* Followers / Following Modal */}
      <Modal
        visible={!!listModal}
        transparent
        animationType="slide"
        onRequestClose={() => setListModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setListModal(null)}>
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{listModal === 'followers' ? 'Followers' : 'Following'}</Text>
              <TouchableOpacity onPress={() => setListModal(null)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {modalLoading ? (
              <ActivityIndicator color="#E53935" style={{ marginTop: 32 }} />
            ) : !modalList || modalList.length === 0 ? (
              <Text style={styles.modalEmpty}>No {listModal} yet.</Text>
            ) : (
              <FlatList
                data={modalList}
                keyExtractor={(u) => u.id}
                renderItem={({ item: u }) => (
                  <TouchableOpacity
                    style={styles.userRow}
                    onPress={() => {
                      setListModal(null);
                      navigation.push('UserProfile', { username: u.username });
                    }}
                  >
                    <View style={styles.userAvatar}>
                      {u.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={styles.userAvatarImg} />
                      ) : (
                        <Text style={styles.userAvatarText}>{u.display_name[0].toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.userName}>{u.display_name}</Text>
                      <Text style={styles.userHandle}>@{u.username}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Block User Action Sheet */}
      <Modal
        visible={showMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={styles.actionSheet} onPress={() => {}}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>@{profile.username}</Text>
            </View>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => {
                if (profile.is_blocked) {
                  unblockMutation.mutate();
                } else {
                  blockMutation.mutate();
                }
              }}
            >
              <Text style={[
                styles.actionSheetItemText,
                profile.is_blocked ? styles.unblockText : styles.blockText
              ]}>
                {profile.is_blocked ? 'Unblock User' : 'Block User'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionSheetItem}
              onPress={() => setShowMenu(false)}
            >
              <Text style={styles.actionSheetItemText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#666', fontSize: 16 },
  header: { alignItems: 'center', padding: 24, paddingTop: 32 },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  displayName: { fontSize: 20, fontWeight: 'bold', color: '#111' },
  username: { fontSize: 14, color: '#888', marginTop: 2 },
  bio: { fontSize: 14, color: '#555', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  headerTextContainer: { flex: 1, alignItems: 'center', marginTop: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedBadge: { color: '#1DA1F2', fontSize: 16, fontWeight: 'bold' },
  privateBadge: { fontSize: 14 },
  menuButton: { position: 'absolute', top: 12, right: 12, padding: 8 },
  menuButtonText: { fontSize: 24, color: '#666', fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },
  statLabelTap: { color: '#E53935' },
  followSection: { padding: 16 },
  followBtn: { backgroundColor: '#E53935', borderRadius: 8, padding: 12, alignItems: 'center' },
  followBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  followingBtn: { borderWidth: 1.5, borderColor: '#ddd', borderRadius: 8, padding: 12, alignItems: 'center' },
  followingBtnText: { color: '#666', fontSize: 15, fontWeight: '600' },
  privateNotice: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  privateIcon: { fontSize: 40 },
  privateText: { fontSize: 17, fontWeight: '600', color: '#111' },
  privateSubtext: { fontSize: 14, color: '#888' },
  postsSection: { padding: 2 },
  gridItem: { flex: 1 / 3, margin: 1 },
  gridImage: { width: '100%', aspectRatio: 1 },
  gridNoImage: { backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  noPostsText: { textAlign: 'center', color: '#999', fontSize: 14, paddingVertical: 32 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  modalTitle: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  modalClose: { fontSize: 18, color: '#888' },
  modalEmpty: { textAlign: 'center', color: '#999', fontSize: 14, paddingVertical: 32 },
  userRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  userAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  userAvatarText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  userName: { fontSize: 14, fontWeight: '600', color: '#111' },
  userHandle: { fontSize: 12, color: '#888', marginTop: 1 },
  // Action Sheet
  actionSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34 },
  actionSheetHeader: { padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  actionSheetTitle: { fontSize: 14, color: '#888', textAlign: 'center' },
  actionSheetItem: { padding: 16, borderBottomWidth: 1, borderColor: '#f0f0f0', alignItems: 'center' },
  actionSheetItemText: { fontSize: 16, fontWeight: '600' },
  blockText: { color: '#E53935' },
  unblockText: { color: '#27ae60' },
});
