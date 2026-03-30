import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../api/client';
import type { Notification } from '../../types';
import type { RootStackScreenProps } from '../../navigation/types';
import { Heart, MessageCircle, UserPlus, Zap, CheckCheck } from 'lucide-react-native';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

type Props = RootStackScreenProps<'Notifications'>;

const NOTIF_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  follow:        { icon: UserPlus,      color: '#3B82F6', label: 'started following you' },
  like_post:     { icon: Heart,         color: '#E53935', label: 'liked your post' },
  comment_post:  { icon: MessageCircle, color: '#14B8A6', label: 'commented on your post' },
  like_reel:     { icon: Heart,         color: '#EC4899', label: 'liked your reel' },
  comment_reel:  { icon: MessageCircle, color: '#10B981', label: 'commented on your reel' },
  mention:       { icon: Zap,           color: '#F59E0B', label: 'mentioned you' },
  reply_post:    { icon: MessageCircle, color: '#F97316', label: 'replied to your comment' },
  reply_reel:    { icon: MessageCircle, color: '#F97316', label: 'replied to your comment' },
  like_comment:  { icon: Heart,         color: '#F43F5E', label: 'liked your comment' },
};

export default function NotificationsScreen({ navigation }: Props) {
  const qc = useQueryClient();

  const { data: notifs, isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(50),
    refetchInterval: 30000,
  });

  const readAll = useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const readOne = useMutation({
    mutationFn: (id: string) => notificationsApi.readOne(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['notif-unread-count'] });
    },
  });

  const handlePress = (n: Notification) => {
    if (!n.is_read) readOne.mutate(n.id);

    const reelTypes = ['like_reel', 'comment_reel', 'reply_reel'];
    const postTypes = ['like_post', 'comment_post', 'mention', 'reply_post', 'like_comment'];

    if (n.notif_type === 'follow' && n.actor) {
      navigation.navigate('UserProfile', { username: n.actor.username });
    } else if (n.target_id) {
      if (reelTypes.includes(n.notif_type)) {
        navigation.navigate('Main');
      } else if (postTypes.includes(n.notif_type)) {
        navigation.navigate('PostDetail', { postId: n.target_id });
      }
    }
  };

  const hasUnread = notifs?.some((n) => !n.is_read);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#E53935" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {hasUnread && (
        <TouchableOpacity
          style={styles.markAllBtn}
          onPress={() => readAll.mutate()}
          disabled={readAll.isPending}
        >
          <CheckCheck size={16} color="#E53935" />
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={notifs ?? []}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Zap size={40} color="#ccc" />
            <Text style={styles.emptyTitle}>Quiet on the tracks...</Text>
            <Text style={styles.emptySubtitle}>New alerts will appear here</Text>
          </View>
        }
        renderItem={({ item: n }) => {
          const cfg = NOTIF_CONFIG[n.notif_type] ?? NOTIF_CONFIG.mention;
          const Icon = cfg.icon;
          return (
            <TouchableOpacity
              style={[styles.item, !n.is_read && styles.itemUnread]}
              onPress={() => handlePress(n)}
              activeOpacity={0.7}
            >
              {/* Avatar + icon badge */}
              <View style={styles.avatarWrap}>
                {n.actor?.avatar_url ? (
                  <Image source={{ uri: n.actor.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarInitial}>
                      {n.actor?.username?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
                <View style={[styles.iconBadge, { backgroundColor: cfg.color }]}>
                  <Icon size={10} color="#fff" />
                </View>
              </View>

              {/* Text */}
              <View style={styles.textWrap}>
                <Text style={styles.notifText} numberOfLines={2}>
                  <Text style={styles.actor}>@{n.actor?.username ?? 'Someone'} </Text>
                  {cfg.label}
                </Text>
                <Text style={styles.time}>{timeAgo(n.created_at)}</Text>
              </View>

              {/* Unread dot */}
              {!n.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  markAllText: { fontSize: 13, color: '#E53935', fontWeight: '600' },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  itemUnread: { backgroundColor: '#FFF5F5' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  iconBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  textWrap: { flex: 1 },
  notifText: { fontSize: 14, color: '#333', lineHeight: 20 },
  actor: { fontWeight: '700', color: '#111' },
  time: { fontSize: 11, color: '#999', marginTop: 3, fontWeight: '500' },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: '#E53935',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#555' },
  emptySubtitle: { fontSize: 13, color: '#aaa' },
});
