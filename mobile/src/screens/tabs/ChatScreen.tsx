import React from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../../api/client';
import type { Conversation } from '../../types';
import type { TabScreenProps } from '../../navigation/types';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAuthStore } from '../../store/authStore';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ConversationRow({ conv }: { conv: Conversation }) {
  const navigation = useNavigation<Nav>();
  const { user } = useAuthStore();

  // For 1:1 conversations, show the other participant's info
  const other = conv.participants.find((p) => p.username !== user?.username) ?? conv.participants[0];
  const title = conv.is_group ? (conv.title ?? 'Group') : other?.display_name ?? 'Unknown';
  const subtitle = conv.last_message?.body ?? 'No messages yet';

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('ChatRoom', { conversationId: conv.id })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{title[0]?.toUpperCase() ?? '?'}</Text>
      </View>
      <View style={styles.info}>
        <View style={styles.infoTop}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {conv.last_message && (
            <Text style={styles.time}>
              {new Date(conv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
        <View style={styles.infoBottom}>
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          {conv.unread_count > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{conv.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ChatScreen(_: TabScreenProps<'Chat'>) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: chatApi.list,
  });

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#E53935" /></View>;
  }
  if (isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Failed to load conversations</Text>
        <TouchableOpacity onPress={() => refetch()}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => <ConversationRow conv={item} />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>Visit a user profile to start a chat</Text>
        </View>
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: '#fff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, minHeight: 300 },
  errorText: { color: '#666', fontSize: 16, marginBottom: 12 },
  retryText: { color: '#E53935', fontSize: 15, fontWeight: '600' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#333', fontSize: 17, fontWeight: '600' },
  emptySubtext: { color: '#999', fontSize: 14, marginTop: 6 },
  row: { flexDirection: 'row', padding: 14, gap: 12, alignItems: 'center' },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#E53935',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  info: { flex: 1 },
  infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '600', color: '#111', flex: 1 },
  time: { fontSize: 12, color: '#999' },
  infoBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  subtitle: { fontSize: 13, color: '#888', flex: 1 },
  badge: {
    backgroundColor: '#E53935', borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  separator: { height: 1, backgroundColor: '#f0f0f0', marginLeft: 74 },
});
