import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reels } from '../../../lib/api';
import type { ReelFeedResponse } from '../types/reel';

// Type helper for TanStack infinite query data
type InfiniteReelData = {
  pages: ReelFeedResponse[];
  pageParams: unknown[];
};

export function useReelActions() {
  const queryClient = useQueryClient();

  const toggleLikeMutation = useMutation({
    mutationFn: async ({ id, isLiked }: { id: string; isLiked: boolean }) => {
      if (isLiked) {
        return reels.unlike(id);
      } else {
        return reels.like(id);
      }
    },
    // Optimistic Update
    onMutate: async ({ id, isLiked }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['reels'] });

      // Identify all queries matching 'reels' (feed, trending, etc)
      const queryKeys = queryClient.getQueriesData({ queryKey: ['reels'] }).map(([key]) => key);

      // Snapshot the previous value
      const previousData = queryKeys.map((key) => ({
        key,
        data: queryClient.getQueryData<InfiniteReelData>(key),
      }));

      // Optimistically update to the new value
      queryKeys.forEach((key) => {
        queryClient.setQueryData<InfiniteReelData>(key, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((reel) => {
                if (reel.id === id) {
                  return {
                    ...reel,
                    viewer_liked: !isLiked,
                    likes_count: isLiked ? Math.max(0, reel.likes_count - 1) : reel.likes_count + 1,
                  };
                }
                return reel;
              }),
            })),
          };
        });
      });

      return { previousData };
    },
    // If the mutation fails, use the context returned from onMutate to roll back
    onError: (_err, _newReel, context) => {
      context?.previousData.forEach(({ key, data }) => {
        if (data) queryClient.setQueryData(key, data);
      });
    },
    // Always refetch after error or success to ensure backend sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
  });

  const toggleSaveMutation = useMutation({
    mutationFn: async ({ id, isSaved }: { id: string; isSaved: boolean }) => {
      if (isSaved) {
        return reels.unsave(id);
      } else {
        return reels.save(id);
      }
    },
    onMutate: async ({ id, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: ['reels'] });
      const queryKeys = queryClient.getQueriesData({ queryKey: ['reels'] }).map(([key]) => key);
      const previousData = queryKeys.map((key) => ({
        key,
        data: queryClient.getQueryData<InfiniteReelData>(key),
      }));

      queryKeys.forEach((key) => {
        queryClient.setQueryData<InfiniteReelData>(key, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((reel) => {
                if (reel.id === id) {
                  return {
                    ...reel,
                    viewer_saved: !isSaved,
                    saves_count: isSaved ? Math.max(0, reel.saves_count - 1) : reel.saves_count + 1,
                  };
                }
                return reel;
              }),
            })),
          };
        });
      });

      return { previousData };
    },
    onError: (_err, _variables, context) => {
      context?.previousData.forEach(({ key, data }) => {
        if (data) queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
  });

  const recordViewMutation = useMutation({
    mutationFn: async ({ id, watched_secs }: { id: string; watched_secs: number }) => {
      return reels.view(id, watched_secs);
    },
    // Don't optimistically update views to avoid UI jumps, just let the silent API call fly
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
        const reel = data.pages.flatMap(p => p.items).find(r => r.id === id);
        if (reel) {
          authorId = reel.user.id;
          break;
        }
      }

      if (authorId) {
        queryKeys.forEach((key) => {
          queryClient.setQueryData<InfiniteReelData>(key, (old) => {
            if (!old) return old;
            return {
              ...old,
              pages: old.pages.map((page) => ({
                ...page,
                items: page.items.map((reel) => {
                  if (reel.user.id === authorId) {
                    return {
                      ...reel,
                      user: {
                        ...reel.user,
                        viewer_followed: !reel.user.viewer_followed,
                      },
                    };
                  }
                  return reel;
                }),
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
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
  });

  return {
    toggleLike: toggleLikeMutation.mutate,
    toggleSave: toggleSaveMutation.mutate,
    recordView: recordViewMutation.mutate,
    toggleFollow: toggleFollowMutation.mutate,
  };
}
