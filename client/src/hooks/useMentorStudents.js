import { useQuery, useQueryClient } from '@tanstack/react-query';
import ApiConfig from '../components/apiConfig';

export const mentorStudentsKeys = {
  all: ['mentorStudents'],
  list: () => [...mentorStudentsKeys.all, 'list'],
};

// Hook to fetch mentor's students
export const useMentorStudents = (enabled = true) => {
  return useQuery({
    queryKey: mentorStudentsKeys.list(),
    queryFn: async () => {
      const res = await ApiConfig.api.get('/api/mentors/students');
      return Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];
    },
    enabled: enabled,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

// Hook to invalidate mentor students (after mutations)
export const useInvalidateMentorStudents = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: mentorStudentsKeys.all });
  };
};

