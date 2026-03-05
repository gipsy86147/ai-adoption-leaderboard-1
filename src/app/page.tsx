'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Leaderboard } from '@/components/Leaderboard';
import { StatsCards } from '@/components/StatsCards';
import { OverallActivityChart } from '@/components/OverallActivityChart';
import { AnalyticsSection } from '@/components/AnalyticsSection';
import { Header } from '@/components/Header';
import { DateRangeSelector } from '@/components/DateRangeSelector';
import { RepositorySelector } from '@/components/RepositorySelector';
import { PRLabelConfig } from '@/components/PRLabelConfig';
import { DeviceFlowAuth } from '@/components/DeviceFlowAuth';
import {
  type Repository,
  type AIToolBreakdown,
  type AITool,
  type ClaudeModelBreakdown,
  type ClaudeModel,
  type FetchProgress,
  type PRLabelConfig as PRLabelConfigType,
  fetchCommitDataClient,
  getDefaultPRLabelConfig,
} from '@/lib/github-client';
import {
  loadAuthState,
  clearAuthState,
  fetchUserRepos,
  validateToken,
  type GitHubUser,
} from '@/lib/github-device-auth';

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);

  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{ login: string; avatar_url: string } | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Repository state
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);

  const emptyToolBreakdown = useMemo<AIToolBreakdown>(() => ({
    'claude-coauthor': 0,
    'claude-generated': 0,
    'copilot': 0,
    'cursor': 0,
    'codex': 0,
    'gemini': 0,
    'agent': 0,
  }), []);

  const emptyModelBreakdown = useMemo<ClaudeModelBreakdown>(() => ({
    opus: 0,
    sonnet: 0,
    haiku: 0,
    unknown: 0,
  }), []);

  const [data, setData] = useState({
    totalCommits: 0,
    aiCommits: 0,
    aiToolBreakdown: emptyToolBreakdown,
    claudeModelBreakdown: emptyModelBreakdown,
    activeUsers: 0,
    leaderboard: [] as Array<{
      rank: number;
      username: string;
      commits: number;
      totalCommits: number;
      aiPercentage: number;
      avatar: string;
      commitDetails: Array<{
        sha: string;
        message: string;
        date: string;
        url: string;
        repository: string;
        aiTool: AITool;
        claudeModel?: ClaudeModel;
      }>;
      allCommitDates: string[];
      aiToolBreakdown: AIToolBreakdown;
      claudeModelBreakdown: ClaudeModelBreakdown;
    }>
  });

  // Initialize date range to past week (inclusive of today)
  const getDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();

    // Set end to tomorrow to include all of today
    end.setDate(end.getDate() + 1);
    // Set start to 6 days ago (7 days total including today)
    start.setDate(start.getDate() - 6);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());

  // PR label config state with localStorage persistence
  const [labelConfig, setLabelConfig] = useState<PRLabelConfigType>(() => {
    if (typeof window === 'undefined') return getDefaultPRLabelConfig([]);
    try {
      const stored = localStorage.getItem('prLabelConfig');
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return getDefaultPRLabelConfig([]);
  });

  const handleLabelConfigChange = useCallback((config: PRLabelConfigType) => {
    setLabelConfig(config);
    try {
      localStorage.setItem('prLabelConfig', JSON.stringify(config));
    } catch { /* ignore */ }
  }, []);

  // Prune stale repos from label scan config when selectedRepos changes
  useEffect(() => {
    const validScanRepos = labelConfig.labelScanRepos.filter(r => selectedRepos.includes(r));
    if (validScanRepos.length !== labelConfig.labelScanRepos.length) {
      handleLabelConfigChange({ ...labelConfig, labelScanRepos: validScanRepos });
    }
  }, [selectedRepos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update URL when selected repos change
  const updateUrlWithRepos = useCallback((repos: string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (repos.length > 0) {
      params.set('repos', encodeURIComponent(JSON.stringify(repos)));
    } else {
      params.delete('repos');
    }

    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });
  }, [searchParams, pathname, router]);

  const handleRepoChange = useCallback((newSelectedRepos: string[]) => {
    setSelectedRepos(newSelectedRepos);
    updateUrlWithRepos(newSelectedRepos);
  }, [updateUrlWithRepos]);

  // Complete auth setup: fetch repos and restore URL state
  const completeAuthSetup = useCallback(async (authToken: string, authUser: { login: string; avatar_url: string }) => {
    setToken(authToken);
    setUser(authUser);
    setIsAuthenticated(true);

    try {
      const { repos } = await fetchUserRepos(authToken);
      const mappedRepos: Repository[] = repos.map(r => ({
        owner: r.owner,
        name: r.name,
        displayName: r.displayName,
      }));
      setRepositories(mappedRepos);

      // Restore selected repos from URL
      const reposFromUrl = searchParams.get('repos');
      if (reposFromUrl) {
        try {
          const decodedRepos = JSON.parse(decodeURIComponent(reposFromUrl));
          const validRepos = decodedRepos.filter((repoName: string) =>
            mappedRepos.some((repo: Repository) => repo.name === repoName)
          );
          setSelectedRepos(validRepos);

          // Init label scan repos if no stored config
          if (!localStorage.getItem('prLabelConfig') && validRepos.length > 0) {
            const defaultConfig = getDefaultPRLabelConfig(validRepos);
            setLabelConfig(defaultConfig);
            localStorage.setItem('prLabelConfig', JSON.stringify(defaultConfig));
          }
        } catch {
          setSelectedRepos([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch repositories:', err);
      setError('Failed to load repositories. Please try logging in again.');
    }
  }, [searchParams]);

  // Load auth state from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      const authState = loadAuthState();

      if (authState.isAuthenticated && authState.token && authState.user) {
        // Validate the stored token is still valid
        const isValid = await validateToken(authState.token);
        if (isValid) {
          await completeAuthSetup(authState.token, authState.user);
        } else {
          // Token expired — clear and show login
          clearAuthState();
        }
      }

      setIsInitializing(false);
    };

    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle successful Device Flow authentication
  const handleAuthenticated = useCallback(async (authToken: string, authUser: GitHubUser) => {
    await completeAuthSetup(authToken, {
      login: authUser.login,
      avatar_url: authUser.avatar_url,
    });
  }, [completeAuthSetup]);

  // Fetch commit data
  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !token || selectedRepos.length === 0) {
      setData({
        totalCommits: 0,
        aiCommits: 0,
        aiToolBreakdown: emptyToolBreakdown,
        claudeModelBreakdown: emptyModelBreakdown,
        activeUsers: 0,
        leaderboard: []
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const reposToFetch = repositories.filter(repo => selectedRepos.includes(repo.name));

      const result = await fetchCommitDataClient(
        token,
        reposToFetch,
        {
          start: new Date(dateRange.startDate),
          end: new Date(dateRange.endDate)
        },
        setProgress,
        labelConfig,
      );

      setData(result);
      setProgress(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch commit data');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange.startDate, dateRange.endDate, selectedRepos, isAuthenticated, token, repositories, emptyToolBreakdown, emptyModelBreakdown, labelConfig]);

  const handleDateChange = (startDate: string, endDate: string) => {
    setDateRange({ startDate, endDate });
  };

  // Fetch data when dependencies change
  useEffect(() => {
    if (isAuthenticated && selectedRepos.length > 0) {
      fetchData();
    }
  }, [fetchData, isAuthenticated, selectedRepos.length]);

  const handleLogout = useCallback(() => {
    clearAuthState();
    setIsAuthenticated(false);
    setToken(null);
    setUser(null);
    setRepositories([]);
    setSelectedRepos([]);
    setError(null);
  }, []);

  // Show loading while initializing
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Header />
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Header />
          <div className="flex items-center justify-center py-16">
            <div className="max-w-md text-center">
              <p className="text-destructive mb-4">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show auth prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Header />
          <div className="flex items-center justify-center py-16">
            <DeviceFlowAuth onAuthenticated={handleAuthenticated} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Header
          repositoryCount={repositories.length}
          onLogout={handleLogout}
          isAuthenticated={isAuthenticated}
          username={user?.login}
          avatarUrl={user?.avatar_url}
        />


        <RepositorySelector
          selectedRepos={selectedRepos}
          onRepoChange={handleRepoChange}
          availableRepos={repositories}
          token={token}
        />

        <PRLabelConfig
          labelConfig={labelConfig}
          onLabelConfigChange={handleLabelConfigChange}
          selectedRepos={selectedRepos}
        />

        <DateRangeSelector
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onDateChange={handleDateChange}
          onRefresh={fetchData}
          isLoading={isLoading}
        />

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        {progress ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-full max-w-md space-y-6">
              {/* Big commit counter */}
              <div className="text-center">
                {progress.phase === 'counting' ? (
                  <>
                    <div className="text-5xl font-bold tracking-tight tabular-nums text-muted-foreground/50">...</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Counting commits across {progress.totalRepos} {progress.totalRepos === 1 ? 'repo' : 'repos'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-5xl font-bold tracking-tight tabular-nums">
                      {progress.commitsFetched.toLocaleString()}
                      {progress.totalCommitsEstimate != null && progress.phase === 'fetching' && (
                        <span className="text-2xl font-normal text-muted-foreground">
                          {' / '}{progress.totalCommitsEstimate.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {progress.phase === 'analyzing' ? 'commits being analyzed' : progress.phase === 'fetching-prs' ? 'Scanning PR labels for AI tool usage' : 'commits fetched'}
                    </div>
                  </>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  {progress.phase === 'counting' || progress.phase === 'analyzing' || progress.phase === 'fetching-prs' ? (
                    <div className="h-full w-full progress-bar-shimmer rounded-full" />
                  ) : progress.totalCommitsEstimate != null && progress.totalCommitsEstimate > 0 ? (
                    <div
                      className="h-full progress-bar-shimmer rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.max(2, (progress.commitsFetched / progress.totalCommitsEstimate) * 100)}%` }}
                    />
                  ) : (
                    <div className="h-full w-full progress-bar-shimmer rounded-full" />
                  )}
                </div>

                {/* Status text */}
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary pulse-glow" />
                  {progress.phase === 'counting' ? (
                    <span>Preparing...</span>
                  ) : progress.phase === 'analyzing' ? (
                    <span>Scanning for AI-assisted commits...</span>
                  ) : progress.phase === 'fetching-prs' ? (
                    <span>
                      {progress.activeRepos.length > 0 ? (
                        <span className="font-medium text-foreground">{progress.activeRepos[0]}</span>
                      ) : (
                        'Scanning PR labels for AI tools...'
                      )}
                    </span>
                  ) : (
                    <span>
                      Fetching from {progress.activeRepos.map((name, i) => (
                        <span key={name}>
                          {i > 0 && ', '}
                          <span className="font-medium text-foreground">{name}</span>
                        </span>
                      ))}
                      {progress.totalRepos > 1 && (
                        <span className="text-muted-foreground"> ({progress.completedRepos}/{progress.totalRepos} done)</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <StatsCards
              totalCommits={data.totalCommits}
              aiCommits={data.aiCommits}
              aiToolBreakdown={data.aiToolBreakdown}
              claudeModelBreakdown={data.claudeModelBreakdown}
              activeUsers={data.activeUsers}
              isLoading={isLoading}
              hasSelectedRepos={selectedRepos.length > 0}
            />

            <OverallActivityChart
              leaderboard={data.leaderboard}
              isLoading={isLoading}
              hasSelectedRepos={selectedRepos.length > 0}
            />

            <AnalyticsSection
              aiToolBreakdown={data.aiToolBreakdown}
              totalAICommits={data.aiCommits}
              leaderboard={data.leaderboard}
              isLoading={isLoading}
              hasSelectedRepos={selectedRepos.length > 0}
            />

            <Leaderboard
              data={data.leaderboard}
              isLoading={isLoading}
              hasSelectedRepos={selectedRepos.length > 0}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
