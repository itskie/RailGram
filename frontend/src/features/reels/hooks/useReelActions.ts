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
        await reels.unlike(id);
        return { id, liked: false };
      } else {
        const res = await reels.like(id);
        return { id, liked: (res as any)?.liked ?? true };
      }
    },
    onSuccess: (data) => {
      const queryKeys = queryClient.getQueriesData({ queryKey: ['reels'] }).map(([key]) => key);
      queryKeys.forEach((key) => {
        queryClient.setQueryData<InfiniteReelData>(key, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((reel) =>
                reel.id === data.id
                  ? { ...reel, viewer_liked: data.liked, likes_count: data.liked ? reel.likes_count + 1 : Math.max(0, reel.likes_count - 1) }
                  : reel
              ),
            })),
          };
        });
      });
      queryClient.invalidateQueries({ queryKey: ['reels'], refetchType: 'active' });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reels'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['saved-reels'], refetchType: 'active' });
    },
  });

  const recordViewMutation = useMutation({
    mutationFn: async ({ id, watched_secs }: { id: string; watched_secs: number }) => {
      return reels.view(id, watched_secs);
    },
    onSuccess: (_data, { id }) => {
      // Update views count in cache after a view is recorded
      const queryKeys = queryClient.getQueriesData({ queryKey: ['reels'] }).map(([key]) => key);
      queryKeys.forEach((key) => {
        queryClient.setQueryData<InfiniteReelData>(key, (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((reel) =>
                reel.id === id ? { ...reel, views: reel.views + 1 } : reel
              ),
            })),
          };
        });
      });
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
      // Backend POST /users/{username}/follow is a toggle; follow() and unfollow() both POST.
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
    isLikePending: toggleLikeMutation.isPending,
    isSavePending: toggleSaveMutation.isPending,
  };
}
