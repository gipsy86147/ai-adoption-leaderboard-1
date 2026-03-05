/**
 * GitHub Device Flow Authentication
 *
 * This implements OAuth device flow for static sites (no backend needed).
 * Only requires a public client ID - no client secret.
 *
 * Flow:
 * 1. Request device code from GitHub
 * 2. Show user the code and verification URL
 * 3. Poll GitHub until user approves
 * 4. Receive access token
 */

const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_API_URL = 'https://api.github.com';

// Storage keys
const TOKEN_STORAGE_KEY = 'github_access_token';
const USER_STORAGE_KEY = 'github_user';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  token: string | null;
}

/**
 * Get the GitHub OAuth Client ID from environment or config
 */
export function getClientId(): string {
  // For static builds, this needs to be baked in at build time
  // Next.js will inline NEXT_PUBLIC_ env vars at build time
  const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

  if (!clientId) {
    throw new Error('NEXT_PUBLIC_GITHUB_CLIENT_ID is not configured');
  }

  return clientId;
}

/**
 * Request a device code from GitHub
 * @param includePrivate - If true, request full repo scope for private repos
 */
export async function requestDeviceCode(includePrivate: boolean = false): Promise<DeviceCodeResponse> {
  const clientId = getClientId();

  // Minimal scopes: public_repo for public repos only, or repo for private
  // read:org allows listing org memberships (needed for org repos)
  const scope = includePrivate
    ? 'repo read:org'  // Full repo access needed for private repos
    : 'public_repo read:org';  // Public repos only (read-only)

  const response = await fetch(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      scope,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to request device code: ${error}`);
  }

  return response.json();
}

interface PollResult {
  access_token?: string;
  error?: string;
  error_description?: string;
}

/**
 * Poll for the access token after user authorizes
 */
export async function pollForToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onPoll?: () => void
): Promise<string> {
  const clientId = getClientId();
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;

  while (Date.now() < expiresAt) {
    // Wait for the specified interval
    await new Promise(resolve => setTimeout(resolve, interval * 1000));

    onPoll?.();

    const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    const result: PollResult = await response.json();

    if (result.access_token) {
      return result.access_token;
    }

    if (result.error === 'authorization_pending') {
      // User hasn't authorized yet, keep polling
      continue;
    }

    if (result.error === 'slow_down') {
      // We're polling too fast, increase interval
      interval += 5;
      continue;
    }

    if (result.error === 'expired_token') {
      throw new Error('Authorization request expired. Please try again.');
    }

    if (result.error === 'access_denied') {
      throw new Error('Access denied. User cancelled authorization.');
    }

    if (result.error) {
      throw new Error(result.error_description || result.error);
    }
  }

  throw new Error('Authorization request timed out. Please try again.');
}

/**
 * Fetch the authenticated user's info
 */
export async function fetchUser(token: string): Promise<GitHubUser> {
  const response = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return response.json();
}

/**
 * Fetch user's organizations
 */
async function fetchUserOrgsDevice(token: string): Promise<string[]> {
  const orgs: string[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `${GITHUB_API_URL}/user/orgs?per_page=${perPage}&page=${page}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      // If we can't fetch orgs (e.g., missing scope), just return empty
      console.warn('Could not fetch organizations:', response.status);
      break;
    }

    const pageOrgs = await response.json();

    if (pageOrgs.length === 0) {
      break;
    }

    orgs.push(...pageOrgs.map((org: { login: string }) => org.login));

    if (pageOrgs.length < perPage) {
      break;
    }

    page++;

    // Safety limit
    if (page > 10) {
      break;
    }
  }

  return orgs;
}

type DeviceRepo = {
  owner: string;
  name: string;
  displayName: string;
  fullName: string;
  private: boolean;
};

/**
 * Fetch repositories for a specific organization
 * Returns repos array and a boolean indicating if access was denied
 */
async function fetchOrgReposDevice(token: string, org: string): Promise<{ repos: DeviceRepo[]; accessDenied: boolean }> {
  const repos: DeviceRepo[] = [];

  let page = 1;
  const perPage = 100;

  while (true) {
    const response = await fetch(
      `${GITHUB_API_URL}/orgs/${org}/repos?per_page=${perPage}&page=${page}&sort=pushed&direction=desc`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      // Org may not have granted access to the OAuth app
      console.warn(`Could not fetch repos for org ${org}:`, response.status);
      return { repos: [], accessDenied: true };
    }

    const pageRepos = await response.json();

    if (pageRepos.length === 0) {
      break;
    }

    repos.push(...pageRepos.map((repo: { owner: { login: string }; name: string; full_name: string; private: boolean }) => ({
      owner: repo.owner.login,
      name: repo.name,
      displayName: repo.full_name,
      fullName: repo.full_name,
      private: repo.private,
    })));

    if (pageRepos.length < perPage) {
      break;
    }

    page++;

    // Safety limit - 500 repos per org max
    if (page > 5) {
      break;
    }
  }

  return { repos, accessDenied: false };
}

export interface FetchReposResultDevice {
  repos: DeviceRepo[];
  deniedOrgs: string[];
}

/**
 * Fetch user's repositories (including org repos)
 * Also returns list of organizations that denied access
 */
export async function fetchUserRepos(token: string): Promise<FetchReposResultDevice> {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
  };

  const mapRepo = (repo: { owner: { login: string }; name: string; full_name: string; private: boolean }): DeviceRepo => ({
    owner: repo.owner.login,
    name: repo.name,
    displayName: repo.full_name,
    fullName: repo.full_name,
    private: repo.private,
  });

  // Kick off orgs fetch first (orgs are the slow part — multiple paginated fetches per org)
  const orgsPromise = fetchUserOrgsDevice(token);

  // Fetch user repos in parallel with orgs
  const userReposPromise = (async () => {
    const result: DeviceRepo[] = [];
    for (let page = 1; page <= 10; page++) {
      const response = await fetch(
        `${GITHUB_API_URL}/user/repos?per_page=100&page=${page}&sort=pushed&direction=desc`,
        { headers },
      );
      if (!response.ok) throw new Error('Failed to fetch repositories');
      const pageRepos = await response.json();
      if (pageRepos.length === 0) break;
      result.push(...pageRepos.map(mapRepo));
      if (pageRepos.length < 100) break;
    }
    return result;
  })();

  // Once orgs list is ready, fetch all org repos in parallel
  const orgs = await orgsPromise;
  const deniedOrgs: string[] = [];
  const orgReposPromises = orgs.map(async (org) => {
    const result = await fetchOrgReposDevice(token, org);
    if (result.accessDenied) {
      deniedOrgs.push(org);
      return [];
    }
    return result.repos;
  });

  // Wait for user repos + all org repos
  const [userRepos, ...orgReposArrays] = await Promise.all([userReposPromise, ...orgReposPromises]);
  const repos = [...userRepos, ...orgReposArrays.flat()];

  // Deduplicate repos by full name (user/repos may overlap with org repos)
  const seen = new Set<string>();
  const uniqueRepos = repos.filter(repo => {
    if (seen.has(repo.displayName)) return false;
    seen.add(repo.displayName);
    return true;
  });

  return { repos: uniqueRepos, deniedOrgs };
}

/**
 * Save auth state to localStorage
 */
export function saveAuthState(token: string, user: GitHubUser): void {
  if (typeof window === 'undefined') return;

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

/**
 * Load auth state from localStorage
 */
export function loadAuthState(): AuthState {
  if (typeof window === 'undefined') {
    return { isAuthenticated: false, user: null, token: null };
  }

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const userJson = localStorage.getItem(USER_STORAGE_KEY);

  if (!token || !userJson) {
    return { isAuthenticated: false, user: null, token: null };
  }

  try {
    const user = JSON.parse(userJson) as GitHubUser;
    return { isAuthenticated: true, user, token };
  } catch {
    clearAuthState();
    return { isAuthenticated: false, user: null, token: null };
  }
}

/**
 * Clear auth state (logout)
 */
export function clearAuthState(): void {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Validate that a stored token is still valid
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
