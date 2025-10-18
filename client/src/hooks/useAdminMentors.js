import { useQuery, useQueryClient } from '@tanstack/react-query';
import ApiConfig from '../components/apiConfig';

export const adminMentorsKeys = {
  all: ['adminMentors'],
  list: (schoolId) => [...adminMentorsKeys.all, 'list', schoolId],
};

// Hook to fetch mentors for admin
export const useAdminMentors = (schoolId) => {
  return useQuery({
    queryKey: adminMentorsKeys.list(schoolId),
    queryFn: async () => {
      const res = await ApiConfig.api.get(`/api/mentori?schoolId=${schoolId}`);
      
      // SECURITY: Filter out developer account from client-side (redundancy)
      const filteredData = Array.isArray(res.data) 
        ? res.data.filter(mentor => 
            mentor.korisnickoIme !== 'cadenza.dev' && 
            mentor.email !== 'app.info.cadenza@gmail.com'
          )
        : res.data;
      
      return filteredData;
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 3, // Retry on failure
  });
};

// Hook to invalidate admin mentors (after mutations)
export const useInvalidateAdminMentors = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: adminMentorsKeys.all });
  };
};

