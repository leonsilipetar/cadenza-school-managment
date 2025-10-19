import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ApiConfig from '../components/apiConfig';

export const postKeys = {
  all: ['posts'],
  lists: () => [...postKeys.all, 'list'],
  details: () => [...postKeys.all, 'detail'],
  detail: (id) => [...postKeys.details(), id],
};

// Hook to fetch all posts
export const usePosts = () => {
  return useQuery({
    queryKey: postKeys.lists(),
    queryFn: async () => {
      const response = await ApiConfig.cachedApi.get('/api/posts');
      return response.posts || response.data || response || [];
    },
    staleTime: 30 * 1000, // 30 seconds - shorter for fresh content
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchInterval: 60 * 1000, // Auto-refetch every 60 seconds in background
  });
};

// Hook to create a post
export const useCreatePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postData) => {
      return ApiConfig.api.post('/api/posts', postData);
    },
    onSuccess: () => {
      // Force immediate refetch instead of just invalidating
      queryClient.refetchQueries({ queryKey: postKeys.lists() });
    },
  });
};

// Hook to update a post
export const useUpdatePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ postId, data }) => {
      return ApiConfig.api.put(`/api/posts-edit/${postId}`, data);
    },
    onSuccess: () => {
      // Force immediate refetch instead of just invalidating
      queryClient.refetchQueries({ queryKey: postKeys.lists() });
    },
  });
};

// Hook to delete a post
export const useDeletePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (postId) => {
      return ApiConfig.api.delete(`/api/posts/${postId}`);
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: postKeys.lists() });
      
      const previousPosts = queryClient.getQueryData(postKeys.lists());
      
      // Optimistically remove post
      queryClient.setQueryData(postKeys.lists(), (old) =>
        old ? old.filter(post => post.id !== postId) : []
      );
      
      return { previousPosts };
    },
    onError: (err, variables, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(postKeys.lists(), context.previousPosts);
      }
    },
    onSuccess: () => {
      // Force immediate refetch instead of just invalidating
      queryClient.refetchQueries({ queryKey: postKeys.lists() });
    },
  });
};

