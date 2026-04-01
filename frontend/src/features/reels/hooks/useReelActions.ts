import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reels } from '../../../lib/api';
import type { ReelFeedResponse } from '../types/reel';

type InfiniteReelData = {
  pages: ReelFeedResponse[];
  pageParams: unknown[];
};

function updateReelInAllCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  reelId: string,
  updater: (reel: ReelFeedResponse['items'][number]) => ReelFeedResponse['items'][number]
) {
  const queryKeys = queryClient.getQueriesData({ queryKey: ['reels'] }).map(([key]) => key);
  queryKeys.forEach((key) => {
    queryClient.setQueryData<InfiniteReelData>(key, (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          items: page.items.map((r) => (r.id === reelId ? updater(r) : r)),
        })),
      };
    });
  });
}

export function useReelActions() {
  const queryClient = useQueryClient();

  const toggleLikeMutation = useMutation({
    mutationFn: async ({ id, isLiked }: { id: string; isLiked: boolean }) => {
      // Optimistically predict the result; backend toggles and confirms
      const res = await reels.like(id) as { liked: boolean; likes_count?: number };
      return { id, liked: res?.liked ?? !isLiked, likes_count: res?.likes_count };
    },
    onMutate: async ({ id, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: ['reels'] });
      const queryKeys = queryClient.getQueriesData({ queryKey: ['reels'] }).map(([key]) => key);
      const previousData = queryKeys.map((key) => ({
        key,
        data: queryClient.getQueryData<InfiniteReelData>(key),
      }));
      // Optimistic update — only viewer_liked, count handled by component local state
      updateReelInAllCaches(queryClient, id, (r) => ({
        ...r,
        viewer_liked: !isLiked,
      }));
      return { previousData };
    },
    onSuccess: (data) => {
      // Sync viewer_liked and likes_count from server
      updateReelInAllCaches(queryClient, data.id, (r) => ({
        ...r,
        viewer_liked: data.liked,
        likes_count: data.likes_count ?? r.likes_count,
      }));
    },
    onError: (_err, _vars, context) => {
      context?.previousData.forEach(({ key, data }) => {
        if (data) queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reels'], refetchType: 'active' });
    },
  });

  const toggleSaveMutation = useMutation({
    mutationFn: async ({ id, isSaved }: { id: string; isSaved: boolean }) => {
      const res = await reels.save(id) as { saved: boolean; saves_count?: number };
      return { id, saved: res?.saved ?? !isSaved, saves_count: res?.saves_count };
    },
    onMutate: async ({ id, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: ['reels'] });
      const queryKeys = queryClient.getQueriesData({ queryKey: ['reels'] }).map(([key]) => key);
      const previousData = queryKeys.map((key) => ({
        key,
        data: queryClient.getQueryData<InfiniteReelData>(key),
      }));
      updateReelInAllCaches(queryClient, id, (r) => ({
        ...r,
        viewer_saved: !isSaved,
      }));
      return { previousData };
    },
    onSuccess: (data) => {
      updateReelInAllCaches(queryClient, data.id, (r) => ({
        ...r,
        viewer_saved: data.saved,
        saves_count: data.saves_count ?? r.saves_count,
      }));
    },
    onError: (_err, _variables, context) => {
      context?.previousData.forEach(({ key, data }) => {
        if (data) queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reels'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['saved-reels'], refetchType: 'active' });
    },
  });

  const recordViewMutation = useMutation({
    mutationFn: async ({ id, watched_secs }: { id: string; watched_secs: number }) => {
      return reels.view(id, watched_secs);
    },
    onSuccess: (_data, { id }) => {
      updateReelInAllCaches(queryClient, id, (r) => ({ ...r, views: r.views + 1 }));
    },
  });

  const toggleFollowMutation = useMutation({
    mutationFn: async ({
      username,
      isFollowing,
    }: {
      username: string;
      id: string;
      isFollowing: boolean;
    }) => {
      const { users } = await import('../../../lib/api');
      return isFollowing ? users.unfollow(username) : users.follow(username);
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['reels'] });
      const queryKeys = queryClient.getQueriesData({ queryKey: ['reels'] }).map(([key]) => key);
      const previousData = queryKeys.map((key) => ({
        key,
        data: queryClient.getQueryData<InfiniteReelData>(key),
      }));

      // Find authorId from snapshot
      let authorId: string | null = null;
      for (const { data } of previousData) {
        if (!data) continue;
        const reel = data.pages.flatMap((p) => p.items).find((r) => r.id === id);
        if (reel) { authorId = reel.user.id; break; }
      }

      if (authorId) {
        queryKeys.forEach((key) => {
          queryClient.setQueryData<InfiniteReelData>(key, (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((reel) =>
                  reel.user.id === authorId
                    ? { ...reel, user: { ...reel.user, viewer_followed: !reel.user.viewer_followed } }
                    : reel
                ),
              })),
            };
          });
        });
      }

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      context?.previousData.forEach(({ key, data }) => {
        if (data) queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reels'], refetchType: 'active' });
    },
  });

  return {
    toggleLike: toggleLikeMutation.mutate,
    toggleSave: toggleSaveMutation.mutate,
    recordView: recordViewMutation.mutate,
    toggleFollow: toggleFollowMutation.mutate,
    isLikePending: toggleLikeMutation.isPending,
    isSavePending: toggleSaveMutation.isPending,
  };
}
