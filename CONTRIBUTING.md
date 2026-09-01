# Contributing to BazionWeb

Thank you for your interest in contributing! This document outlines the process for contributing to the BazionWeb platform.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Branching Strategy](#branching-strategy)
- [Development Workflow](#development-workflow)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Reporting Bugs](#reporting-bugs)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

## Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/bazionwebsites/bazionweb.git
   cd bazionweb
   ```

2. **Set up your environment**
   ```bash
   cp .env.example .env.local
   # Fill in your local values
   ```

3. **Start infrastructure**
   ```bash
   docker compose -f infrastructure/docker/docker-compose.dev.yml up -d
   ```

4. **Install dependencies and run**
   ```bash
   cd apps/api && npm install && npm run start:dev
   cd apps/web && npm install && npm run dev
   ```

---

## Branching Strategy

We use **GitFlow**:

| Branch | Purpose |
|--------|---------|
| `main` | Production-ready code only. Protected. Requires 1 review + passing CI. |
| `staging` | Pre-production integration branch. Auto-deploys to staging. |
| `develop` | Main integration branch. All feature branches merge here. |
| `feature/<name>` | New features. Branch from `develop`. |
| `fix/<name>` | Bug fixes. Branch from `develop` (or `main` for hotfixes). |
| `hotfix/<name>` | Critical prod fixes. Branch from `main`. Merge back to `main` + `develop`. |
| `chore/<name>` | CI, tooling, dependency updates. |

**Never commit directly to `main` or `staging`.**

---

## Development Workflow

1. Pick an issue from the backlog or create one
2. Branch from `develop`:
   ```bash
   git checkout develop && git pull origin develop
   git checkout -b feature/your-feature-name
   ```
3. Write your code with tests
4. Ensure everything passes:
   ```bash
   npm run lint --prefix apps/api
   npm run lint --prefix apps/web
   npm run test --prefix apps/api -- --passWithNoTests
   npm run test --prefix apps/web -- --passWithNoTests
   ```
5. Commit (see commit message format below)
6. Push and open a PR against `develop`

---

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(scope): <short description>

[optional body]

[optional footer(s)]
```

**Types:**

| Type | When to use |
|------|------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, missing semicolons (no logic change) |
| `refactor` | Code restructure (no feature/fix) |
| `test` | Adding or updating tests |
| `chore` | Build process, CI, dependencies |
| `perf` | Performance improvement |
| `security` | Security fix |

**Examples:**
```
feat(billing): add M-Pesa STK Push integration via IntaSend
fix(auth): resolve JWT refresh token race condition
chore(ci): replace npm ci with conditional install fallback
docs(readme): update quick start guide for new billing system
```

---

## Pull Request Process

1. Fill out the [PR template](.github/PULL_REQUEST_TEMPLATE.md) completely
2. Ensure all CI checks pass (lint, tests, build)
3. Request review from at least **1 team member**
4. Address all review comments before merging
5. Use **Squash and Merge** for feature branches, **Merge Commit** for releases

---

## Coding Standards

- **TypeScript strict mode** — no `any`, no implicit returns, no unused variables
- **NestJS conventions** — services handle business logic, controllers handle HTTP only
- **Next.js App Router** — use server components by default, client components only when needed
- **Prisma** — always use typed queries; never use raw SQL without a documented reason
- **Error handling** — all async functions must handle errors; use NestJS `HttpException` in controllers
- **Environment variables** — never hardcode secrets; always add to `.env.example` with description

---

## Testing Requirements

| Layer | Tool | Minimum |
|-------|------|---------|
| API Unit Tests | Jest | All service methods |
| API Integration | Jest + supertest | All controller endpoints |
| Frontend | Jest + React Testing Library | All page components |
| E2E | Playwright | Critical user flows |

Run all tests:
```bash
npm run test:cov --prefix apps/api
npm run test --prefix apps/web -- --coverage
```

Coverage threshold: **70%** statements (enforced in CI).

---

## Reporting Bugs

Use the [Bug Report template](https://github.com/bazionwebsites/bazionweb/issues/new?template=bug_report.md).

For **security vulnerabilities**, do **not** open a public issue — see [SECURITY.md](SECURITY.md).
