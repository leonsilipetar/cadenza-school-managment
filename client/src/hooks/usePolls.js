import { useQuery, useQueryClient } from '@tanstack/react-query';
import ApiConfig from '../components/apiConfig';

export const pollKeys = {
  all: ['polls'],
  active: () => [...pollKeys.all, 'active'],
};

// Hook to fetch active polls
export const useActivePolls = () => {
  return useQuery({
    queryKey: pollKeys.active(),
    queryFn: async () => {
      const response = await ApiConfig.cachedApi.get('/api/polls/active');
      
      // Filter out expired polls on client side too
      const now = new Date();
      const activePolls = (response.data?.polls || []).filter(poll =>
        new Date(poll.endDate) > now
      );
      
      return activePolls;
    },
    staleTime: 30 * 1000, // 30 seconds (polls update frequently)
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
  });
};

// Hook to invalidate polls (for real-time updates)
export const useInvalidatePolls = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: pollKeys.all });
  };
};

