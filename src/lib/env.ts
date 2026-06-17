export interface Env {
  adminPassword: string;
  sessionSecret: string;
  githubToken: string;
  githubRepo: string;
  githubBranch: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
}

const KEYS: Record<keyof Env, string> = {
  adminPassword: 'ADMIN_PASSWORD',
  sessionSecret: 'SESSION_SECRET',
  githubToken: 'GITHUB_TOKEN',
  githubRepo: 'GITHUB_REPO',
  githubBranch: 'GITHUB_BRANCH',
  cloudinaryCloudName: 'CLOUDINARY_CLOUD_NAME',
  cloudinaryApiKey: 'CLOUDINARY_API_KEY',
  cloudinaryApiSecret: 'CLOUDINARY_API_SECRET',
};

export function getEnv(): Env {
  const out = {} as Env;
  const missing: string[] = [];
  for (const [field, envName] of Object.entries(KEYS) as [keyof Env, string][]) {
    const val = process.env[envName];
    if (!val) missing.push(envName);
    else out[field] = val;
  }
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
  return out;
}

/** Read a single env var directly without requiring all vars. For auth module. */
export function requireEnvVar(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env var: ${name}`);
  return val;
}
