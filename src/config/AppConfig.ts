/**
 * Application configuration
 * In production backend, this would come from environment variables
 * In frontend, this is hardcoded but can be overridden
 */
export interface AppConfig {
  github: {
    owner: string;
    repository: string;
    branch: string;
    uploadPath: string;
    token?: string; // In backend, this would come from env vars
  };
  upload: {
    maxSizeBytes: number;
    allowedExtensions: string[];
    allowedMimeTypes: string[];
  };
}

/**
 * Default configuration
 * When moved to backend, this would be loaded from environment
 */
export const defaultConfig: AppConfig = {
  github: {
    owner: 'AppGates',
    repository: 'PongPush',
    branch: 'claude/photo-upload-cicd-P9UDV',
    uploadPath: 'uploads',
    // Token will be injected at runtime from GitHub Secret
  },
  upload: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  },
};

/**
 * Get configuration with runtime overrides
 * In backend, this would read from process.env
 */
export function getConfig(): AppConfig {
  const config = { ...defaultConfig };

  // In browser context, token comes from build-time injection
  // In backend context, this would be process.env.GITHUB_TOKEN
  if (typeof window !== 'undefined') {
    // @ts-ignore - injected by build process
    config.github.token = window.__GITHUB_TOKEN__;
  }

  return config;
}
