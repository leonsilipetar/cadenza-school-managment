import { useQuery, useQueryClient } from '@tanstack/react-query';
import ApiConfig from '../components/apiConfig';

export const adminUsersKeys = {
  all: ['adminUsers'],
  list: (schoolId) => [...adminUsersKeys.all, 'list', schoolId],
};

// Hook to fetch students (korisnici) for admin
export const useAdminUsers = (schoolId) => {
  return useQuery({
    queryKey: adminUsersKeys.list(schoolId),
    queryFn: async () => {
      // Fetch both school users and users without school
      const [resSchool, resAll] = await Promise.all([
        ApiConfig.api.get(`/api/korisnici?schoolId=${schoolId}`),
        ApiConfig.api.get('/api/korisnici')
      ]);

      const noSchool = Array.isArray(resAll.data) 
        ? resAll.data.filter(u => !u.schoolId) 
        : [];

      // Merge and deduplicate by id
      const mergedMap = new Map();
      (resSchool.data || []).forEach(u => mergedMap.set(u.id, u));
      noSchool.forEach(u => { 
        if (!mergedMap.has(u.id)) mergedMap.set(u.id, u); 
      });
      
      return Array.from(mergedMap.values());
    },
    enabled: !!schoolId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Hook to invalidate admin users (after mutations)
export const useInvalidateAdminUsers = () => {
  const queryClient = useQueryClient();
  
  return () => {
    queryClient.invalidateQueries({ queryKey: adminUsersKeys.all });
  };
};

