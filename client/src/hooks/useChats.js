import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import ApiConfig from '../components/apiConfig';

// Query Keys - centralized for consistency
export const chatKeys = {
  all: ['chats'],
  lists: () => [...chatKeys.all, 'list'],
  list: (filters) => [...chatKeys.lists(), filters],
  details: () => [...chatKeys.all, 'detail'],
  detail: (id) => [...chatKeys.details(), id],
  messages: (chatId) => [...chatKeys.all, 'messages', chatId],
};

// Hook to fetch all chats
export const useChats = () => {
  return useQuery({
    queryKey: chatKeys.lists(),
    queryFn: async () => {
      const response = await ApiConfig.api.get('/api/chats');
      return Array.isArray(response.data) ? response.data : [];
    },
    staleTime: 30 * 1000, // 30 seconds for chats (frequently updated)
    onError: (error) => {
      console.error('Error fetching chats:', error);
    },
  });
};

// Hook to calculate unread count from chats
export const useUnreadCount = (user) => {
  const { data: chats = [] } = useChats();
  
  return useMemo(() => {
    if (!chats || !Array.isArray(chats) || !user) return 0;
    
    return chats.reduce((total, chat) => {
      if (chat.participant) {
        return total + (parseInt(chat.unreadCount || 0, 10));
      }
      if (chat.groupId) {
        return total + (parseInt(
          user?.isMentor ? chat.unreadCountMentor : chat.unreadCountUser,
          10
        ) || 0);
      }
      return total;
    }, 0);
  }, [chats, user?.isMentor]);
};

// Hook to mark messages as read
export const useMarkMessagesRead = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ chatId, messageIds }) => {
      return ApiConfig.api.put(`/api/chats/${chatId}/mark-read`, { messageIds });
    },
    onSuccess: () => {
      // Invalidate chats list to update unread counts
      queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
};

// Hook to send a message
export const useSendMessage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ chatId, message, ...rest }) => {
      return ApiConfig.api.post(`/api/chats/${chatId}/messages`, { 
        message,
        ...rest 
      });
    },
    onMutate: async ({ chatId, message }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: chatKeys.messages(chatId) });
      
      // Snapshot previous value
      const previousMessages = queryClient.getQueryData(chatKeys.messages(chatId));
      
      // Optimistically update if we have previous messages
      if (previousMessages) {
        queryClient.setQueryData(chatKeys.messages(chatId), (old) => [
          ...old,
          {
            id: 'temp-' + Date.now(),
            message,
            createdAt: new Date(),
            sending: true,
          },
        ]);
      }
      
      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          chatKeys.messages(variables.chatId),
          context.previousMessages
        );
      }
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: chatKeys.messages(variables.chatId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
    },
  });
};

// Hook to invalidate chats (for socket updates)
export const useInvalidateChats = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
  };
};

