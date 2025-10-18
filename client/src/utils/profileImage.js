import ApiConfig from '../components/apiConfig';

export async function fetchProfileImageOrNull(userId) {
  try {
    const response = await ApiConfig.cachedApi.get(`/api/profile-picture/${userId}`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (response && response.success && response.profilePicture) {
      return response.profilePicture;
    }
    return null;
  } catch (error) {
    // Treat 404 as no image; rethrow others
    if (error?.response?.status === 404) return null;
    throw error;
  }
}

export function toDataUrl(profilePicture) {
  if (!profilePicture) return null;
  const { contentType, data } = profilePicture;
  return `data:${contentType};base64,${data}`;
}


