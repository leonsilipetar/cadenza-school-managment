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
    staleTime: 3 * 60 * 1000, // 3 minutes - posts don't change frequently
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
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
    },
  });
};

// Hook to update a post
export const useUpdatePost = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ postId, data }) => {
      return ApiConfig.api.put(`/api/posts/${postId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
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
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
    },
  });
};

