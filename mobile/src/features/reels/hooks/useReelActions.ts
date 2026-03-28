import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reelsApi } from '../../../api/client';
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
        return reelsApi.unlike(id);
      } else {
        return reelsApi.like(id);
      }
    },
    onMutate: async ({ id, isLiked }) => {
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
    onError: (_err, _variables, context) => {
      context?.previousData.forEach(({ key, data }) => {
        if (data) queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['reels'] });
    },
  });

  const toggleSaveMutation = useMutation({
    mutationFn: async ({ id, isSaved }: { id: string; isSaved: boolean }) => {
      if (isSaved) {
        return reelsApi.unsave(id);
      } else {
        return reelsApi.save(id);
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
      return reelsApi.view(id, watched_secs);
    },
  });

  return {
    toggleLike: toggleLikeMutation.mutate,
    toggleSave: toggleSaveMutation.mutate,
    recordView: recordViewMutation.mutate,
  };
}
