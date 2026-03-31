import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/client';
import type { RootStackScreenProps } from '../../navigation/types';
import type { FollowRequestResponse } from '../../types';
import { ArrowLeft, Check, X } from 'lucide-react-native';

type Props = RootStackScreenProps<'FollowRequests'>;

type TabType = 'incoming' | 'sent';

export default function FollowRequestsScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('incoming');

  const { data: requests, isLoading } = useQuery<FollowRequestResponse[]>({
    queryKey: ['follow-requests', activeTab],
    queryFn: () => activeTab === 'incoming' 
      ? usersApi.getFollowRequests()
      : usersApi.getSentRequests(),
    refetchInterval: 10000,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => usersApi.acceptRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-requests'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: number) => usersApi.declineRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-requests'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => usersApi.cancelRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-requests'] });
    },
  });

  const handleAccept = (id: number, username: string) => {
    Alert.alert(
      'Accept Follow Request',
      `@${username} will be able to see your posts and reels.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept',
          style: 'default',
          onPress: () => acceptMutation.mutate(id),
        },
      ]
    );
  };

  const handleDecline = (id: number, username: string) => {
    Alert.alert(
      'Decline Follow Request',
      `@${username} will not be able to see your posts and reels.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => declineMutation.mutate(id),
        },
      ]
    );
  };

  const handleCancel = (id: number, username: string) => {
    Alert.alert(
      'Cancel Request',
      `Cancel your follow request to @${username}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cancel Request',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(id),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: FollowRequestResponse }) => (
    <View style={styles.item}>
      <View style={styles.avatarContainer}>
        {item.follower.avatar_url ? (
          <Image source={{ uri: item.follower.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {(item.follower.display_name || item.follower.username)[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.displayName} numberOfLines={1}>
          {item.follower.display_name || item.follower.username}
        </Text>
        <Text style={styles.username}>@{item.follower.username}</Text>
      </View>
      {activeTab === 'incoming' ? (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={() => handleDecline(item.id, item.follower.username)}
            disabled={declineMutation.isPending}
          >
            <X size={18} color="#ef4444" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAccept(item.id, item.follower.username)}
            disabled={acceptMutation.isPending}
          >
            <Check size={18} color="#22c55e" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sentBadge}>
          <Text style={styles.sentText}>Sent</Text>
          <TouchableOpacity
            onPress={() => handleCancel(item.id, item.follower.username)}
            disabled={cancelMutation.isPending}
          >
            <X size={16} color="#71717a" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={20} color="#e4e4e7" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Follow Requests</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'incoming' && styles.tabActive]}
          onPress={() => setActiveTab('incoming')}
        >
          <Text style={[styles.tabText, activeTab === 'incoming' && styles.tabTextActive]}>
            Incoming
          </Text>
          {activeTab === 'incoming' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.tabActive]}
          onPress={() => setActiveTab('sent')}
        >
          <Text style={[styles.tabText, activeTab === 'sent' && styles.tabTextActive]}>
            Sent
          </Text>
          {activeTab === 'sent' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {!requests || requests.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {activeTab === 'incoming'
              ? 'No pending follow requests'
              : 'No sent follow requests'}
          </Text>
          <Text style={styles.emptySubtext}>
            {activeTab === 'incoming'
              ? 'When someone requests to follow you, they\'ll appear here'
              : 'Your sent follow requests will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    color: '#a1a1aa',
    fontSize: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fafafa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090b',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    position: 'relative',
  },
  tabActive: {
    backgroundColor: '#18181b',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#71717a',
  },
  tabTextActive: {
    color: '#fafafa',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 40,
    height: 3,
    backgroundColor: '#f97316',
    borderRadius: 3,
  },
  list: {
    padding: 16,
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  avatar: {
    width: 44,
    height: 44,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fafafa',
  },
  username: {
    fontSize: 13,
    color: '#71717a',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  declineButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  sentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a1a1aa',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#71717a',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#52525b',
    marginTop: 8,
    textAlign: 'center',
  },
});
