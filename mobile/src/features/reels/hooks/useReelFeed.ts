import { useInfiniteQuery } from '@tanstack/react-query';
import { reelsApi } from '../../../api/client';

export function useReelFeed(type: 'feed' | 'trending' = 'feed') {
  return useInfiniteQuery({
    queryKey: ['reels', type],
    queryFn: async ({ pageParam = undefined }) => {
      if (type === 'trending') {
        return reelsApi.trending();
      }
      return reelsApi.feed(pageParam);
    },
    initialPageParam: undefined as string | undefined, // cursor string
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
  });
}
