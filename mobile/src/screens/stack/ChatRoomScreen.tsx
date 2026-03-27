import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { chatApi } from '../../api/client';
import { useWebSocket } from '../../utils/websocket';
import type { RootStackScreenProps } from '../../navigation/types';

interface Message {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  msg_type: string;
}

type Props = RootStackScreenProps<'ChatRoom'>;

export function ChatRoomScreen({ route, navigation }: Props) {
  const { conversationId } = route.params;
  const { user, token } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const optimisticIdRef = useRef(0);

  // Fetch message history
  const {
    data: messageHistory,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['chat', conversationId, 'messages'],
    queryFn: async () => {
      const response = await fetch(
        `https://railgram.in/api/v1/conversations/${conversationId}/messages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data = await response.json();
      return data.messages || [];
    },
    enabled: !!token && !!conversationId,
  });

  // WebSocket connection
  const { ws, isConnected, status, error } = useWebSocket(conversationId, token || '');

  // Initialize messages from history
  useEffect(() => {
    if (messageHistory) {
      setMessages(messageHistory);
      // Scroll to bottom after a short delay to allow FlatList to render
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messageHistory]);

  // Listen for WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (msg: any) => {
      const newMsg: Message = {
        id: msg.id,
        sender_id: msg.sender_id,
        body: msg.body,
        created_at: msg.created_at,
        msg_type: msg.msg_type,
      };
      setMessages((prev) => [...prev, newMsg]);
      flatListRef.current?.scrollToEnd({ animated: true });
    };

    ws.on('message', handleMessage);
  }, [ws]);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim() || !ws || sending) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic update (placeholder message)
    const optimisticId = `temp_${++optimisticIdRef.current}`;
    const now = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        sender_id: user?.id || '',
        body: text,
        created_at: now,
        msg_type: 'text',
      },
    ]);

    try {
      // Send via REST API (backend fans out to WebSocket subscribers)
      const response = await fetch(
        `https://railgram.in/api/v1/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            msg_type: 'text',
            body: text,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const sentMsg = await response.json();

      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? sentMsg : m))
      );

      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (err) {
      console.error('Failed to send message:', err);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      // Optionally show error toast here
    } finally {
      setSending(false);
    }
  }, [inputText, ws, sending, token, conversationId, user?.id]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwn = item.sender_id === user?.id;
    const isOptimistic = item.id.startsWith('temp_');

    return (
      <View
        style={[
          styles.messageRow,
          isOwn ? styles.messageRowRight : styles.messageRowLeft,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwn ? styles.bubbleOwn : styles.bubbleOther,
            isOptimistic && styles.messagePending,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOwn ? styles.messageTextOwn : styles.messageTextOther,
            ]}
          >
            {item.body}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isOwn ? styles.messageTimeOwn : styles.messageTimeOther,
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  const renderStatusBar = () => {
    if (status === 'connected') return null;

    let statusText = 'Connecting...';
    let statusColor = '#FFA500';

    if (status === 'disconnected') {
      statusText = 'Reconnecting...';
    } else if (status === 'error' || error) {
      statusText = error || 'Connection error';
      statusColor = '#FF6B6B';
    }

    return (
      <View style={[styles.statusBar, { backgroundColor: statusColor }]}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Failed to load chat</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : StatusBar.currentHeight}
      >
        {renderStatusBar()}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          onEndReachedThreshold={0.1}
          contentContainerStyle={styles.messageList}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Start a conversation</Text>
            </View>
          }
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
            editable={isConnected && !sending}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!isConnected || sending || !inputText.trim()) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!isConnected || sending || !inputText.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleOther: {
    backgroundColor: '#E8E8E8',
  },
  bubbleOwn: {
    backgroundColor: '#007AFF',
  },
  messagePending: {
    opacity: 0.6,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  messageTextOther: {
    color: '#000',
  },
  messageTextOwn: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
  },
  messageTimeOther: {
    color: '#666',
  },
  messageTimeOwn: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    gap: 8,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statusBar: {
    flex: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
  },
});
