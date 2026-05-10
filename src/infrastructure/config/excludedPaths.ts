const parseEnvPaths = (envVar: string | undefined): string[] => {
  if (!envVar) return [];
  return envVar
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
};

const rateLimitExcluded = parseEnvPaths(process.env.RATE_LIMIT_EXCLUDED_PATHS);
const authExcluded = parseEnvPaths(process.env.AUTH_EXCLUDED_PATHS);

export const isRateLimitExcluded = (path: string): boolean => {
  return rateLimitExcluded.some((excluded) => path.includes(excluded));
};

export const isAuthExcluded = (path: string): boolean => {
  // Always exclude health, login, and webhooks by default
  const defaults = ['/health', '/webhooks/gateway', '/auth/generate-token'];
  const allExcluded = [...new Set([...authExcluded, ...defaults])];
  return allExcluded.some((excluded) => path.includes(excluded));
};
