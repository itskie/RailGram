import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react-native';
import { api } from '../../api/client';
import { useAuthStore } from '../../store/authStore';
import { formatDistanceToNow } from 'date-fns';

const CDN = 'https://dzdr0nfpn0f2c.cloudfront.net/';

interface Message {
  id: string;
  sender_username: string;
  sender_avatar_url: string | null;
  content: string;
  created_at: string;
  read: boolean;
}

interface MessagesResponse {
  messages: Message[];
  has_more: boolean;
}

export default function ChatRoomScreen({ route, navigation }: any) {
  const { convId, username } = route.params;
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const { data, isLoading } = useQuery<MessagesResponse>({
    queryKey: ['messages', convId],
    queryFn: async () => {
      const res = await api.get(`/chat/conversations/${convId}/messages`);
      return res.data;
    },
    refetchInterval: 3000,
  });

  const messages = data?.messages ?? [];

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const sendMut = useMutation({
    mutationFn: (content: string) =>
      api.post(`/chat/conversations/${convId}/messages`, { content }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['messages', convId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sendMut.isPending) return;
    sendMut.mutate(trimmed);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.sender_username === user?.username;
    const avatarUrl = item.sender_avatar_url
      ? (item.sender_avatar_url.startsWith('http') ? item.sender_avatar_url : `${CDN}${item.sender_avatar_url}`)
      : null;

    return (
      <View style={[s.msgRow, isMe && s.msgRowMe]}>
        {!isMe && (
          <View style={s.msgAvatar}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={s.msgAvatarImg} />
              : <Text style={s.msgAvatarText}>{item.sender_username[0]?.toUpperCase()}</Text>}
          </View>
        )}
        <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
          <Text style={[s.bubbleText, isMe && s.bubbleTextMe]}>{item.content}</Text>
          <Text style={[s.msgTime, isMe && s.msgTimeMe]}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: false })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[s.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ArrowLeft size={22} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerUser} onPress={() => navigation.navigate('UserProfile', { username })}>
            <Text style={s.headerTitle}>@{username}</Text>
          </TouchableOpacity>
          <View style={{ width: 22 }} />
        </View>

        {/* Messages */}
        {isLoading ? (
          <View style={s.center}><ActivityIndicator color="#FF6B35" /></View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyText}>No messages yet. Say hi!</Text>
              </View>
            }
          />
        )}

        {/* Input */}
        <View style={[s.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={s.input}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            placeholderTextColor="#555"
            multiline
            maxLength={2000}
          />
          <TouchableOpacity style={s.sendBtn} onPress={handleSend} disabled={!text.trim() || sendMut.isPending}>
            {sendMut.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Send size={18} color="#fff" strokeWidth={2} />}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#1e1e1e' },
  headerUser: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  msgAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  msgAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble: { maxWidth: '75%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleMe: { backgroundColor: '#FF6B35', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#1e1e1e', borderBottomLeftRadius: 4 },
  bubbleText: { color: '#fff', fontSize: 15, lineHeight: 20 },
  bubbleTextMe: { color: '#fff' },
  msgTime: { color: '#aaa', fontSize: 10, marginTop: 3, alignSelf: 'flex-end' },
  msgTimeMe: { color: 'rgba(255,255,255,0.65)' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#1e1e1e', backgroundColor: '#0a0a0a' },
  input: { flex: 1, backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, color: '#fff', fontSize: 15, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF6B35', justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#555', fontSize: 14 },
});
