import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageSquare } from 'lucide-react-native';
import { api } from '../../api/client';
import { formatDistanceToNow } from 'date-fns';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

interface Conversation {
  id: string;
  other_username: string;
  other_display_name: string | null;
  other_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export default function ChatListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();

  const { data: convs, isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await api.get('/chat/conversations');
      return res.data?.conversations ?? res.data ?? [];
    },
    refetchInterval: 15000,
  });

  const renderItem = ({ item }: { item: Conversation }) => {
    const avatarUrl = item.other_avatar_url
      ? (item.other_avatar_url.startsWith('http') ? item.other_avatar_url : `${CDN}${item.other_avatar_url}`)
      : null;
    const letter = (item.other_display_name || item.other_username || 'U')[0].toUpperCase();

    return (
      <TouchableOpacity style={s.row} onPress={() => navigation.navigate('ChatRoom', { convId: item.id, username: item.other_username })}>
        <View style={s.avatar}>
          {avatarUrl
            ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
            : <Text style={s.avatarText}>{letter}</Text>}
        </View>
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>{item.other_display_name || item.other_username}</Text>
          <Text style={s.lastMsg} numberOfLines={1}>{item.last_message || 'No messages yet'}</Text>
        </View>
        <View style={s.meta}>
          {item.last_message_at && (
            <Text style={s.time}>{formatDistanceToNow(new Date(item.last_message_at), { addSuffix: false })}</Text>
          )}
          {item.unread_count > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{item.unread_count > 9 ? '9+' : item.unread_count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ArrowLeft size={22} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Messages</Text>
        <View style={{ width: 22 }} />
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color="#FF6B35" /></View>
      ) : (
        <FlatList
          data={convs ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <MessageSquare size={48} color="#333" strokeWidth={1.5} />
              <Text style={s.emptyTitle}>No conversations yet</Text>
              <Text style={s.emptySubtext}>Visit a user's profile to start a DM</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  info: { flex: 1 },
  name: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 3 },
  lastMsg: { color: '#666', fontSize: 13 },
  meta: { alignItems: 'flex-end', gap: 4 },
  time: { color: '#555', fontSize: 11 },
  badge: { backgroundColor: '#FF6B35', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  separator: { height: 0.5, backgroundColor: '#1a1a1a' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptySubtext: { color: '#555', fontSize: 13, textAlign: 'center' },
});
