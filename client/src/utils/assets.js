export function getAssetUrl(path) {
  if (!path) return path;
  
  // If it's already an absolute URL or a data URI, return as-is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  
  // Get the backend API URL from the environment, defaulting to empty string (relative)
  const baseUrl = import.meta.env.VITE_API_URL || '';
  
  // Ensure we don't have double slashes if path starts with '/'
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  // Remove trailing slash from baseUrl if exists
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  return `${cleanBaseUrl}${normalizedPath}`;
}
