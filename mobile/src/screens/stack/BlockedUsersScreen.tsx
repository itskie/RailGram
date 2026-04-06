import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield, UserCheck } from 'lucide-react-native';
import { api } from '../../api/client';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

interface BlockedUser {
  id: number;
  blocked_user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  created_at: string;
}

export default function BlockedUsersScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: blocked, isLoading } = useQuery<BlockedUser[]>({
    queryKey: ['blocked-users'],
    queryFn: async () => {
      const res = await api.get('/users/blocked');
      return res.data?.blocked_users ?? res.data ?? [];
    },
  });

  const unblockMut = useMutation({
    mutationFn: (username: string) => api.delete(`/users/${username}/block`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocked-users'] }),
    onError: (e: any) => Alert.alert('Error', e.response?.data?.detail || 'Failed to unblock'),
  });

  const handleUnblock = (username: string) => {
    Alert.alert('Unblock User', `Unblock @${username}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: () => unblockMut.mutate(username) },
    ]);
  };

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const avatarUrl = item.blocked_user.avatar_url
      ? (item.blocked_user.avatar_url.startsWith('http') ? item.blocked_user.avatar_url : `${CDN}${item.blocked_user.avatar_url}`)
      : null;
    const letter = (item.blocked_user.display_name || item.blocked_user.username)[0].toUpperCase();

    return (
      <View style={s.row}>
        <View style={s.avatar}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
            : <Text style={s.avatarText}>{letter}</Text>}
        </View>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>{item.blocked_user.display_name || item.blocked_user.username}</Text>
          <Text style={s.username}>@{item.blocked_user.username}</Text>
        </View>
        <TouchableOpacity style={s.unblockBtn} onPress={() => handleUnblock(item.blocked_user.username)} disabled={unblockMut.isPending}>
          <UserCheck size={16} color="#4ade80" strokeWidth={2} />
          <Text style={s.unblockText}>Unblock</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Blocked Users</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color="#FF6B35" /></View>
      ) : (
        <FlatList
          data={blocked ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Shield size={48} color="#333" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No blocked users</Text>
              <Text style={s.emptySubtext}>Users you block will appear here</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1e1e1e' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 14, fontWeight: '600' },
  username: { color: '#666', fontSize: 12, marginTop: 1 },
  unblockBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0d2010', borderRadius: 8, borderWidth: 1, borderColor: '#4ade8040' },
  unblockText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },
  separator: { height: 0.5, backgroundColor: '#1e1e1e' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: '#555', fontSize: 13, textAlign: 'center' },
});
