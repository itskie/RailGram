import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, X } from 'lucide-react-native';
import { api } from '../../api/client';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

interface FollowRequest {
  id: number;
  follower: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  created_at: string;
}

export default function FollowRequestsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const { data: requests, isLoading } = useQuery<FollowRequest[]>({
    queryKey: ['follow-requests'],
    queryFn: async () => {
      const res = await api.get('/users/follow-requests/pending');
      return res.data?.requests ?? res.data ?? [];
    },
    refetchInterval: 10000,
  });

  const acceptMut = useMutation({
    mutationFn: (id: number) => api.post(`/users/follow-requests/${id}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow-requests'] });
      qc.invalidateQueries({ queryKey: ['my-profile'] });
    },
  });

  const declineMut = useMutation({
    mutationFn: (id: number) => api.post(`/users/follow-requests/${id}/decline`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-requests'] }),
  });

  const renderItem = ({ item }: { item: FollowRequest }) => {
    const avatarUrl = item.follower.avatar_url
      ? (item.follower.avatar_url.startsWith('http') ? item.follower.avatar_url : `${CDN}${item.follower.avatar_url}`)
      : null;
    const letter = (item.follower.display_name || item.follower.username)[0].toUpperCase();

    return (
      <View style={s.row}>
        <TouchableOpacity onPress={() => navigation.navigate('UserProfile', { username: item.follower.username })}>
          <View style={s.avatar}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
              : <Text style={s.avatarText}>{letter}</Text>}
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={s.info} onPress={() => navigation.navigate('UserProfile', { username: item.follower.username })}>
          <Text style={s.name} numberOfLines={1}>{item.follower.display_name || item.follower.username}</Text>
          <Text style={s.username}>@{item.follower.username}</Text>
        </TouchableOpacity>
        <View style={s.actions}>
          <TouchableOpacity style={s.declineBtn} onPress={() => declineMut.mutate(item.id)} disabled={declineMut.isPending}>
            <X size={18} color="#aaa" strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity style={s.acceptBtn} onPress={() => acceptMut.mutate(item.id)} disabled={acceptMut.isPending}>
            <Check size={18} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Follow Requests</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color="#FF6B35" /></View>
      ) : (
        <FlatList
          data={requests ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>👥</Text>
              <Text style={s.emptyTitle}>No pending requests</Text>
              <Text style={s.emptySubtext}>When someone requests to follow you, they'll appear here</Text>
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
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 14, fontWeight: '600' },
  username: { color: '#666', fontSize: 12, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  declineBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#2a2a2a' },
  acceptBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center' },
  separator: { height: 0.5, backgroundColor: '#1e1e1e' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySubtext: { color: '#555', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
});
