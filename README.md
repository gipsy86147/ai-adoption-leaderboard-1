# 🏆 AI Adoption Leaderboard

[![CI](https://github.com/cameronfleet-paxos/ai-adoption-leaderboard/actions/workflows/ci.yml/badge.svg)](https://github.com/cameronfleet-paxos/ai-adoption-leaderboard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Track and celebrate AI-enhanced development across your organization** 

A beautiful, modern web application that analyzes GitHub repositories to create leaderboards based on commits co-authored with Claude AI. Perfect for teams wanting to track AI adoption and celebrate developers embracing AI-assisted development.

## 🌟 Live Demo

**[🚀 Try it live: ai-adoption-leaderboard.vercel.app](https://ai-adoption-leaderboard.vercel.app/)**

![AI Adoption Leaderboard Example](example.png)

## ✨ Features

🔐 **Secure GitHub App Integration** - No personal tokens required; OAuth-based repository access  
📊 **Multi-Repository Analysis** - Analyze commits across multiple repositories simultaneously  
🤖 **Claude Co-Author Detection** - Automatically identifies commits with Claude as co-author  
🏅 **Interactive Leaderboard** - Beautiful rankings with achievement badges and detailed stats  
📅 **Flexible Date Ranges** - Analyze specific time periods with preset and custom ranges  
🎯 **Repository Selection** - Search and filter which repositories to include in analysis  
🌙 **Modern UI/UX** - Built with shadcn/ui components and responsive design  
🔒 **Privacy-First** - Secure session management with no persistent data storage  

## 🚀 Quick Start (Local Development)

```bash
# Clone the repository
git clone https://github.com/cameronfleet-paxos/ai-adoption-leaderboard.git
cd ai-adoption-leaderboard

# Install dependencies
npm install

# Copy environment template
cp .env.local.example .env.local
```

### ⚙️ Configure Environment (PAT Mode for Local Dev)

For local development, use a GitHub token. The easiest way is to use the **GitHub CLI** (`gh`), which you may already have authenticated:

#### Option A: Use GitHub CLI token (Recommended)

If you have the [GitHub CLI](https://cli.github.com/) installed and authenticated (`gh auth login`), you can use its token directly — no need to create a separate Personal Access Token:

```bash
# Copy your gh CLI token into .env.local
echo "GITHUB_TOKEN=$(gh auth token)" > .env.local
echo "GITHUB_REPOS=owner/repo1,owner/repo2" >> .env.local
echo "AUTH_MODE_OVERRIDE=pat" >> .env.local
```

Or as a one-liner to get started quickly:

```bash
echo "GITHUB_TOKEN=$(gh auth token)\nGITHUB_REPOS=owner/repo1,owner/repo2\nAUTH_MODE_OVERRIDE=pat" > .env.local
```

#### Option B: Create a Personal Access Token

1. Create a token at [GitHub Settings > Tokens](https://github.com/settings/tokens/new?scopes=repo,read:user)
2. Update `.env.local`:

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_REPOS=owner/repo1,owner/repo2
AUTH_MODE_OVERRIDE=pat
```

> **Note:** Replace `owner/repo1,owner/repo2` with the repositories you want to analyze (comma-separated).

### 🏁 Start Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start analyzing your AI adoption!

## 🌐 Deployment (Vercel)

### 1. Create GitHub OAuth App

1. Go to [GitHub Settings > Developer settings > OAuth Apps](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Configure:
   - **Application name**: `AI Adoption Leaderboard`
   - **Homepage URL**: `https://your-app.vercel.app`
   - **Authorization callback URL**: `https://your-app.vercel.app/api/auth/github/callback`
4. Click "Register application"
5. Generate a Client Secret

### 2. Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fcameronfleet-paxos%2Fai-adoption-leaderboard)

### 3. Add Environment Variables

In Vercel Project Settings > Environment Variables:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | Your OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | Your OAuth App Client Secret |

4. Redeploy to apply configuration

## 🏗️ How It Works

1. **🔐 Secure Authentication**: Users sign in with GitHub OAuth to grant repository access
2. **📂 Repository Selection**: Choose which repositories to analyze with search and filtering
3. **🔍 Commit Analysis**: The app scans commits looking for AI co-author signatures:
   - Claude: `Co-Authored-By: Claude <noreply@anthropic.com>`
   - GitHub Copilot: `Co-authored-by: Copilot <noreply@github.com>`
4. **📊 Statistical Analysis**: Calculates adoption rates, rankings, and detailed metrics
5. **🏆 Leaderboard Generation**: Creates beautiful, interactive leaderboards with achievements

## 🛡️ Security & Privacy

- ✅ **Secure OAuth flow** - Client secret stored server-side in Edge Functions
- ✅ **User-controlled access** - Users authorize which repositories to grant access to
- ✅ **httpOnly cookies** - Tokens stored securely, not accessible to JavaScript
- ✅ **No data persistence** - No user data stored on servers
- ✅ **Token expiration** - Access tokens expire after 8 hours

## 🚀 Technology Stack

- **Framework**: Next.js 16 with App Router
- **UI**: shadcn/ui + Radix UI primitives
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Authentication**: GitHub OAuth (Web Application Flow)
- **API**: Vercel Edge Functions
- **Deployment**: Vercel

## 📖 Documentation

- [📋 Deployment Guide](./DEPLOYMENT.md) - Step-by-step deployment instructions
- [🤝 Contributing](./CONTRIBUTING.md) - How to contribute to the project
- [📜 Code of Conduct](./CODE_OF_CONDUCT.md) - Community guidelines
- [🔒 Security Policy](./SECURITY.md) - Security guidelines and reporting

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Quick Contribution Steps

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test them
4. Commit with a descriptive message: `git commit -m 'Add amazing feature'`
5. Push to your branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [shadcn/ui](https://ui.shadcn.com/) for beautiful, accessible components
- Powered by [Radix UI](https://www.radix-ui.com/) primitives
- Icons by [Lucide](https://lucide.dev/)
- Deployed on [Vercel](https://vercel.com/)

## 🌟 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=cameronfleet-paxos/ai-adoption-leaderboard&type=Date)](https://star-history.com/#cameronfleet-paxos/ai-adoption-leaderboard&Date)

---

<div align="center">

**[🚀 Try the Live Demo](https://ai-adoption-leaderboard.vercel.app/)** | **[📖 Read the Docs](./DEPLOYMENT.md)** | **[🤝 Contribute](./CONTRIBUTING.md)**

Made with ❤️ for the AI-enhanced development community

</div>