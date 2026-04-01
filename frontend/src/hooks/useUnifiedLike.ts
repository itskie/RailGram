/**
 * UNIFIED LIKE HOOK - Global solution for all post/reel likes
 * Handles: Feed posts, Feed reels, Profile posts, Profile reels, Bookmarks
 * Auto-manages: Optimistic updates, cache invalidation, error handling
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { posts } from '../lib/api';
import { reels } from '../features/reels/lib/api';

interface LikeResponse {
  liked: boolean;
  like_count?: number;
  likes_count?: number; // reels use this naming
}

export interface UseUnifiedLikeParams {
  id: string;
  type: 'post' | 'reel'; // What type of item is being liked
  currentLiked: boolean;
  currentCount: number;
  onSuccess?: (response: LikeResponse) => void;
  onError?: (error: Error) => void;
}

export function useUnifiedLike() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: UseUnifiedLikeParams) => {
      const { id, type } = params;

      if (type === 'post') {
        return (await posts.likePost(id)) as LikeResponse;
      } else if (type === 'reel') {
        return (await reels.like(id)) as LikeResponse;
      }

      throw new Error(`Unknown like type: ${type}`);
    },

    onMutate: async (params) => {
      const { id, type, currentLiked, currentCount } = params;

      // Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: [type === 'post' ? 'posts' : 'reels'] });
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      await queryClient.cancelQueries({ queryKey: ['unified_feed'] });
      await queryClient.cancelQueries({ queryKey: ['user-posts'] });
      await queryClient.cancelQueries({ queryKey: ['user-reels'] });
      await queryClient.cancelQueries({ queryKey: ['bookmarks'] });
      await queryClient.cancelQueries({ queryKey: ['saved-reels'] });

      // Store previous data for rollback
      const previousQueries = {
        posts: queryClient.getQueriesData({ queryKey: ['posts'] }),
        feed: queryClient.getQueriesData({ queryKey: ['feed'] }),
        unifiedFeed: queryClient.getQueriesData({ queryKey: ['unified_feed'] }),
        userPosts: queryClient.getQueriesData({ queryKey: ['user-posts'] }),
        reels: queryClient.getQueriesData({ queryKey: ['reels'] }),
        userReels: queryClient.getQueriesData({ queryKey: ['user-reels'] }),
        bookmarks: queryClient.getQueriesData({ queryKey: ['bookmarks'] }),
        savedReels: queryClient.getQueriesData({ queryKey: ['saved-reels'] }),
      };

      // Optimistic update
      optimisticUpdateAllCaches(queryClient, id, type, !currentLiked, currentCount + (currentLiked ? -1 : 1));

      return { previousQueries };
    },

    onSuccess: (response, params) => {
      const { id, type } = params;
      const count = type === 'post' ? response.like_count : response.likes_count;

      // Sync actual server values to all caches
      syncAllCaches(queryClient, id, type, response.liked, count ?? 0);
    },

    onError: (_error, _params, context) => {
      // Rollback all changes
      if (context?.previousQueries) {
        Object.entries(context.previousQueries).forEach(([_key, queries]) => {
          queries.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data);
          });
        });
      }
    },

    onSettled: (_data, _error, params) => {
      // Invalidate all affected queries to ensure freshness
      queryClient.invalidateQueries({ queryKey: ['posts'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['feed'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['unified_feed'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['user-posts'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['reels'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['user-reels'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['bookmarks'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['saved-reels'], refetchType: 'active' });
    },
  });

  return {
    like: (params: UseUnifiedLikeParams) => mutation.mutate(params),
    likeAsync: (params: UseUnifiedLikeParams) => mutation.mutateAsync(params),
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * Optimistic update across ALL caches
 */
function optimisticUpdateAllCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  itemId: string,
  type: 'post' | 'reel',
  liked: boolean,
  count: number
) {
  const updatePost = (p: any) => ({
    ...p,
    viewer_liked: typeof p.viewer_liked === 'boolean' ? liked : undefined,
    like_count: typeof p.like_count === 'number' ? count : undefined,
  });

  const updateReel = (r: any) => ({
    ...r,
    viewer_liked: typeof r.viewer_liked === 'boolean' ? liked : undefined,
    likes_count: typeof r.likes_count === 'number' ? count : undefined,
  });

  const updater = type === 'post' ? updatePost : updateReel;

  // Update feed queries
  ['posts', 'reels', 'feed', 'unified_feed', 'user-posts', 'user-reels', 'bookmarks', 'saved-reels'].forEach((key) => {
    updateQueryData(queryClient, key, itemId, updater);
  });
}

/**
 * Sync server values across ALL caches
 */
function syncAllCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  itemId: string,
  type: 'post' | 'reel',
  liked: boolean,
  count: number
) {
  const updatePost = (p: any) => ({
    ...p,
    viewer_liked: liked,
    like_count: count,
  });

  const updateReel = (r: any) => ({
    ...r,
    viewer_liked: liked,
    likes_count: count,
  });

  const updater = type === 'post' ? updatePost : updateReel;

  ['posts', 'reels', 'feed', 'unified_feed', 'user-posts', 'user-reels', 'bookmarks', 'saved-reels'].forEach((key) => {
    updateQueryData(queryClient, key, itemId, updater);
  });
}

/**
 * Helper to update an item in query data
 */
function updateQueryData(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: string,
  itemId: string,
  updater: (item: any) => any
) {
  const queries = queryClient.getQueriesData({ queryKey: [queryKey] });

  queries.forEach(([key, data]) => {
    if (!data) return;

    // Handle paginated data (infinite queries)
    if (Array.isArray((data as any).pages)) {
      queryClient.setQueryData(key, {
        ...data,
        pages: (data as any).pages.map((page: any) => ({
          ...page,
          items: (page.items || []).map((item: any) => (item.id === itemId ? updater(item) : item)),
        })),
      });
    } else if (Array.isArray((data as any).items)) {
      // Handle simple array responses
      queryClient.setQueryData(key, {
        ...data,
        items: (data as any).items.map((item: any) => (item.id === itemId ? updater(item) : item)),
      });
    } else if ((data as any).id === itemId) {
      // Single item response
      queryClient.setQueryData(key, updater(data));
    }
  });
}
