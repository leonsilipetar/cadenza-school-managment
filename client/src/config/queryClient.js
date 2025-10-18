import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache settings - aggressive for performance
      staleTime: 2 * 60 * 1000, // 2 minutes - data stays fresh
      cacheTime: 10 * 60 * 1000, // 10 minutes - cache retention
      
      // Refetch settings - keep data updated
      refetchOnWindowFocus: true, // Refresh when user returns to tab
      refetchOnReconnect: true, // Refresh when internet reconnects
      refetchOnMount: 'always', // Always check for fresh data
      
      // Retry settings - handle flaky connections
      retry: 2, // Retry failed requests twice
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Network mode
      networkMode: 'online',
      
      // Show data while refetching
      keepPreviousData: true,
    },
    mutations: {
      // Mutation settings
      retry: 1,
      networkMode: 'online',
      
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

