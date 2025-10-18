import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import ApiConfig from '../components/apiConfig';

export const notificationKeys = {
  all: ['notifications'],
  lists: () => [...notificationKeys.all, 'list'],
  unread: () => [...notificationKeys.all, 'unread'],
};

// Hook to fetch all notifications
export const useNotifications = () => {
  return useQuery({
    queryKey: notificationKeys.lists(),
    queryFn: async () => {
      const response = await ApiConfig.api.get('/api/notifications');
      return Array.isArray(response.data) ? response.data : [];
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// Hook to get unread notifications
export const useUnreadNotifications = () => {
  const { data: notifications = [] } = useNotifications();
  
  return useMemo(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);
};

// Hook to mark notification as read
export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (notificationId) => {
      return ApiConfig.api.put(`/api/notifications/${notificationId}/read`);
    },
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.lists() });
      
      const previousNotifications = queryClient.getQueryData(notificationKeys.lists());
      
      // Optimistically update
      queryClient.setQueryData(notificationKeys.lists(), (old) =>
        old ? old.map(n => n.id === notificationId ? { ...n, read: true } : n) : []
      );
      
      return { previousNotifications };
    },
    onError: (err, variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          notificationKeys.lists(),
          context.previousNotifications
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
};

// Hook to mark all notifications as read
export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Call the context's markNotificationsAsRead or make API call
      return ApiConfig.api.put('/api/notifications/mark-all-read');
    },
    onSuccess: () => {
      // Invalidate to refetch all notifications
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
};

// Hook to invalidate notifications (for real-time updates)
export const useInvalidateNotifications = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
  };
};

