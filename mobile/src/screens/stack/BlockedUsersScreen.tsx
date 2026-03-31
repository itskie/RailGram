import React from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ActivityIndicator, Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/client';
import type { RootStackScreenProps } from '../../navigation/types';
import type { BlockedUserResponse } from '../../types';
import { ArrowLeft, Shield, UserCheck } from 'lucide-react-native';

type Props = RootStackScreenProps<'BlockedUsers'>;

export default function BlockedUsersScreen({ navigation }: Props) {
  const queryClient = useQueryClient();

  const { data: blocked, isLoading } = useQuery<BlockedUserResponse[]>({
    queryKey: ['blocked-users'],
    queryFn: () => usersApi.getBlocked(),
    refetchInterval: 10000,
  });

  const unblockMutation = useMutation({
    mutationFn: (username: string) => usersApi.unblock(username),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
    },
  });

  const handleUnblock = (username: string) => {
    Alert.alert(
      'Unblock User',
      `@${username} will be able to see your profile and posts again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: () => unblockMutation.mutate(username),
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: BlockedUserResponse }) => (
    <View style={styles.item}>
      <View style={styles.avatarContainer}>
        {item.blocked_user.avatar_url ? (
          <Image source={{ uri: item.blocked_user.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>
              {(item.blocked_user.display_name || item.blocked_user.username)[0].toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.displayName} numberOfLines={1}>
          {item.blocked_user.display_name || item.blocked_user.username}
        </Text>
        <Text style={styles.username}>@{item.blocked_user.username}</Text>
      </View>
      <TouchableOpacity
        style={styles.unblockButton}
        onPress={() => handleUnblock(item.blocked_user.username)}
        disabled={unblockMutation.isPending}
      >
        <UserCheck size={18} color="#22c55e" />
        <Text style={styles.unblockText}>Unblock</Text>
      </TouchableOpacity>
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
        <Text style={styles.title}>Blocked Users</Text>
      </View>

      {!blocked || blocked.length === 0 ? (
        <View style={styles.empty}>
          <Shield size={48} color="#52525b" opacity={0.2} />
          <Text style={styles.emptyText}>No blocked users</Text>
          <Text style={styles.emptySubtext}>Users you block will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={blocked}
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
  unblockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
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
