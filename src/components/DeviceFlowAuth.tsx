'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  requestDeviceCode,
  pollForToken,
  fetchUser,
  saveAuthState,
  type DeviceCodeResponse,
  type GitHubUser,
} from '@/lib/github-device-auth';

const hasDeviceFlow = !!process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

interface DeviceFlowAuthProps {
  onAuthenticated: (token: string, user: GitHubUser) => void;
}

type AuthMode = 'choose' | 'pat' | 'device';
type DeviceStep = 'idle' | 'requesting' | 'waiting' | 'polling' | 'success' | 'error';

export function DeviceFlowAuth({ onAuthenticated }: DeviceFlowAuthProps) {
  const [mode, setMode] = useState<AuthMode>('choose');

  // PAT state
  const [patValue, setPatValue] = useState('');
  const [patError, setPatError] = useState<string | null>(null);
  const [patValidating, setPatValidating] = useState(false);

  // Device Flow state
  const [deviceStep, setDeviceStep] = useState<DeviceStep>('idle');
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [includePrivate, setIncludePrivate] = useState(false);

  // --- PAT handlers ---
  const handlePatSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = patValue.trim();
    if (!trimmed) {
      setPatError('Please enter a token');
      return;
    }

    setPatValidating(true);
    setPatError(null);

    try {
      const user = await fetchUser(trimmed);
      saveAuthState(trimmed, user);
      onAuthenticated(trimmed, user);
    } catch {
      setPatError('Invalid token. Please check and try again.');
    } finally {
      setPatValidating(false);
    }
  }, [patValue, onAuthenticated]);

  // --- Device Flow handlers ---
  const startDeviceAuth = useCallback(async () => {
    setDeviceStep('requesting');
    setDeviceError(null);

    try {
      const code = await requestDeviceCode(includePrivate);
      setDeviceCode(code);
      setDeviceStep('waiting');

      const token = await pollForToken(
        code.device_code,
        code.interval,
        code.expires_in,
        () => setDeviceStep('polling')
      );

      const user = await fetchUser(token);
      saveAuthState(token, user);
      setDeviceStep('success');
      onAuthenticated(token, user);
    } catch (err) {
      setDeviceError(err instanceof Error ? err.message : 'Authentication failed');
      setDeviceStep('error');
    }
  }, [onAuthenticated, includePrivate]);

  const copyCode = useCallback(async () => {
    if (!deviceCode?.user_code) return;
    try {
      await navigator.clipboard.writeText(deviceCode.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = deviceCode.user_code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [deviceCode?.user_code]);

  const openGitHub = useCallback(() => {
    if (deviceCode?.verification_uri) {
      window.open(deviceCode.verification_uri, '_blank');
    }
  }, [deviceCode?.verification_uri]);

  // --- Choose mode (default screen) ---
  if (mode === 'choose') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Connect GitHub</CardTitle>
          <CardDescription className="text-base">
            Analyze AI-assisted commits across your repositories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => setMode('pat')} size="lg" className="w-full">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Connect with Personal Access Token
          </Button>

          {hasDeviceFlow && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button onClick={() => setMode('device')} variant="outline" size="lg" className="w-full">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Sign in with GitHub Device Flow
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // --- PAT input mode ---
  if (mode === 'pat') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Personal Access Token</CardTitle>
          <CardDescription className="text-base">
            Paste a GitHub token to get started. Your token stays in your browser only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePatSubmit} className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium mb-2">
                Token
              </label>
              <input
                id="token"
                type="password"
                value={patValue}
                onChange={(e) => setPatValue(e.target.value)}
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="off"
              />
            </div>

            {patError && (
              <p className="text-sm text-destructive">{patError}</p>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={patValidating}>
              {patValidating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Validating...
                </>
              ) : (
                'Connect'
              )}
            </Button>

            <div className="text-center space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Token is stored in <code className="bg-muted px-1 rounded">localStorage</code> and never sent to any server.
              </p>
              <div className="space-y-1">
                <a
                  href="https://github.com/settings/tokens/new?scopes=public_repo,read:org&description=AI%20Adoption%20Leaderboard%20(public%20repos)"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Create token (public repos only)
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <span className="text-xs text-muted-foreground block">or</span>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,read:org&description=AI%20Adoption%20Leaderboard%20(all%20repos)"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Create token (include private repos)
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum scopes: <code className="bg-muted px-1 rounded">public_repo</code> and <code className="bg-muted px-1 rounded">read:org</code>
              </p>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => { setMode('choose'); setPatError(null); }}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                Back
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // --- Device Flow: requesting ---
  if (deviceStep === 'requesting') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Connecting...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  // --- Device Flow: waiting/polling ---
  if (deviceStep === 'waiting' || deviceStep === 'polling') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Enter Code on GitHub</CardTitle>
          <CardDescription className="text-base">
            Copy this code and enter it on GitHub to complete sign in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-6 text-center">
            <div className="font-mono text-4xl font-bold tracking-widest text-primary mb-4">
              {deviceCode?.user_code}
            </div>
            <Button variant="outline" size="sm" onClick={copyCode}>
              {copied ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Code
                </>
              )}
            </Button>
          </div>

          <Button onClick={openGitHub} size="lg" className="w-full">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Open GitHub to Enter Code
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {deviceStep === 'polling' ? (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                Waiting for authorization...
              </div>
            ) : (
              'Click the button above after copying the code'
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Device Flow: error ---
  if (deviceStep === 'error') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-destructive">Authentication Failed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">{deviceError}</p>
          <Button onClick={() => setDeviceStep('idle')} size="lg" className="w-full">
            Try Again
          </Button>
          <div className="text-center">
            <button
              onClick={() => { setMode('choose'); setDeviceStep('idle'); setDeviceError(null); }}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Back
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Device Flow: idle (with private repo option) ---
  if (mode === 'device' && deviceStep === 'idle') {
    return (
      <Card className="max-w-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">GitHub Device Flow</CardTitle>
          <CardDescription className="text-base">
            Sign in via GitHub without pasting a token.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includePrivate}
                onChange={(e) => setIncludePrivate(e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <div className="text-sm">
                <span className="font-medium">Include private repositories</span>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Requires full repository access. Leave unchecked for read-only public repo access.
                </p>
              </div>
            </label>
          </div>

          <Button onClick={startDeviceAuth} size="lg" className="w-full">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            Continue
          </Button>

          <div className="text-center">
            <button
              onClick={() => setMode('choose')}
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Back
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Device Flow: success (brief) ---
  return (
    <Card className="max-w-lg">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <CardTitle className="text-2xl">Connected!</CardTitle>
        <CardDescription>Loading your repositories...</CardDescription>
      </CardHeader>
    </Card>
  );
}
