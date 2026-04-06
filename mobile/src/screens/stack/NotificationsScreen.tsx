import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { api } from '../../api/client';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

interface Notification {
  id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  actor: { username: string; avatar_url: string | null } | null;
  post_id: string | null;
  message: string | null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function notifText(n: Notification) {
  const username = n.actor?.username || 'Someone';
  switch (n.type) {
    case 'like': return `${username} liked your post`;
    case 'comment': return `${username} commented on your post`;
    case 'follow': return `${username} started following you`;
    case 'mention': return `${username} mentioned you`;
    case 'reel_like': return `${username} liked your reel`;
    case 'reel_comment': return `${username} commented on your reel`;
    default: return n.message || `${username} interacted with you`;
  }
}

export default function NotificationsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications', { params: { limit: 50 } });
      return res.data;
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications: Notification[] = data?.notifications ?? data?.items ?? data ?? [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={() => markAllRead.mutate()}>
          <Text style={styles.markRead}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color="#FF6B35" /></View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const avatarLetter = (item.actor?.username || '?')[0].toUpperCase();
            return (
              <TouchableOpacity style={[styles.row, !item.is_read && styles.rowUnread]}>
                {!item.is_read && <View style={styles.unreadDot} />}
                <View style={styles.avatar}>
                  {item.actor?.avatar_url ? (
                    <Image source={{ uri: item.actor.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                  )}
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.notifText}>{notifText(item)}</Text>
                  <Text style={styles.notifTime}>{timeAgo(item.created_at)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🔔</Text>
              <Text style={styles.emptyText}>No notifications yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1e1e1e',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  markRead: { color: '#FF6B35', fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#111',
  },
  rowUnread: { backgroundColor: '#0f0d0b' },
  unreadDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: '#FF6B35', position: 'absolute', left: 6, top: '50%',
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden', marginRight: 12,
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarLetter: { color: '#fff', fontWeight: 'bold', fontSize: 17 },
  rowText: { flex: 1 },
  notifText: { color: '#ddd', fontSize: 14, lineHeight: 20 },
  notifTime: { color: '#555', fontSize: 12, marginTop: 3 },
  emptyText: { color: '#444', fontSize: 14 },
});
