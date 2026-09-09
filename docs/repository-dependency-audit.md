# Shoelotskey Repository Dependency Audit

**Date:** 2026-09-09  
**Scope:** Current local working copy of the Shoelotskey Service Management System  
**Method:** Read-only inspection of Git remotes, lockfiles, manifests, source imports, deployment files, scripts, and documentation  
**Actions taken:** None. No files were modified except this report. No commit, push, or deploy.

---

## Executive conclusion

**Only this repository is required.**

The application is a single monolith. React/Vite frontend and FastAPI backend live in the same Git repository. Production serves the Vite `dist/` build from this same backend. There are no Git submodules, no nested Git repositories, no `git+https` / `git@github.com` dependencies, no GitHub Actions, and no second application repository required at build or runtime.

The `heroku` remote is a **deployment destination** for this same codebase (`git.heroku.com`), not a separate source repository.

---

## Snapshot of the current Git workspace

| Item | Value |
|---|---|
| Working tree | `C:\Users\charm\Desktop\Shoelotskey Service Management System` |
| Git directory | `.git` at repository root only |
| `origin` | `https://github.com/crg-philsca/shoelotskey-service-management-system.git` (fetch and push) |
| `heroku` | `https://git.heroku.com/shoelotskey-villamor-pasay.git` (fetch and push) |
| Current branch | `capstone-fixes` |
| Current HEAD | `6dda508` — *Backup current Antigravity working state - 2026-09-07* |
| Upstream of current branch | **None.** `capstone-fixes` does not track a remote branch. `origin/capstone-fixes` does not exist. |
| GitHub `main` (`origin/main`) | `95b3a45` — *Fix historical API 404s, remove unused useNavigate, and disable autocomplete on customer name* |
| Local vs GitHub `main` | Local HEAD is **1 commit ahead** of `origin/main` (`6dda508`). `origin/main` has **0 commits** that local HEAD lacks. |
| Working tree vs HEAD | Many additional **uncommitted** modifications and untracked files (not on GitHub). |
| Submodules | **None.** No `.gitmodules`. `git submodule status` is empty. |
| Nested Git repositories | **None.** Recursive search found only the root `.git`. |

`git remote show origin` (local remote metadata, no fetch):

- Fetch/push URL: `https://github.com/crg-philsca/shoelotskey-service-management-system.git`
- Remote HEAD branch: `main`
- Tracked remote branches: `backup/aug-1-baseline`, `capstone-baseline`, `current-antigravity-backup`, `main`
- Local `main` and `capstone-baseline` are configured to merge with `origin/main`
- Local `current-antigravity-backup` merges with `origin/current-antigravity-backup`

`git remote show heroku` was attempted and hung contacting Heroku. Local facts below use the existing `heroku/main` tracking ref instead.

- `heroku/main` = `9878ca2` — *feat: implement offline auth resilience, mobile navigation fixes, and session security audit*
- `origin/main` is **17 commits ahead** of `heroku/main`
- Current HEAD is **18 commits ahead** of `heroku/main`

This audit did **not** fetch from GitHub or Heroku. Divergence figures are against already-fetched remote-tracking refs.

---

## Checklist results

| # | Check | Result |
|---|---|---|
| 1 | `git remote -v` | Two remotes: `origin` (GitHub) and `heroku` (Heroku Git). |
| 2 | `git branch -vv` | Current: `capstone-fixes` at `6dda508`, no upstream. `main` and `capstone-baseline` track `origin/main`. |
| 3 | `git remote show origin` | Points at `crg-philsca/shoelotskey-service-management-system`. Remote default branch is `main`. |
| 4 | `.gitmodules` | **Does not exist.** |
| 5 | Git submodules | **None.** |
| 6 | `package.json` | npm registry packages only. No `repository` field. No git URLs. `heroku-postbuild` runs `vite build` in this repo. |
| 7 | `package-lock.json` | All inspected `resolved` URLs are `https://registry.npmjs.org/...`. No `git+https`, `git@`, or `github:` package sources. GitHub URLs present are **sponsor** links only. |
| 8 | `requirements.txt` | PyPI version ranges only. No VCS / Git URLs. |
| 9 | `pyproject.toml` | Local type-checker paths only. No project dependencies and no Git URLs. |
| 10 | `Procfile` | `web: gunicorn ... --chdir backend main:app` — this repo only. |
| 11 | `app.json` | **Does not exist.** |
| 12 | `heroku.yml` | **Does not exist.** |
| 13 | Docker files | **None** (`Dockerfile`, `docker-compose*`, `.dockerignore` not present). |
| 14 | GitHub Actions / `.github/workflows` | **None.** No `.github` directory. |
| 15 | Vite configuration | Local `@` → `./src` alias only. No remote aliases or repo imports. |
| 16 | Frontend source imports | Local `@/` modules and npm packages. No `https://` imports, CDNs, iframes, or other-repo sources. |
| 17 | Backend imports | Local modules plus PyPI packages. No `git clone`, no GitHub downloads, no other-repo imports. |
| 18 | URLs containing `github.com` | Primary repo badge in `README.md`; shadcn license link in `docs/ATTRIBUTIONS.md`; npm sponsor URLs in `package-lock.json`. |
| 19 | `git+https` dependencies | **None.** |
| 20 | `git@github.com` dependencies | **None.** |
| 21 | Deployment configuration | Heroku via `Procfile` + `package.json` `heroku-postbuild`. Same repo. |
| 22 | README / documentation | README badge links to **this** GitHub repo. Attribution mentions shadcn/ui license only. |
| 23 | Scripts that clone / pull / fetch another repo | **None.** `run.bat` starts this repo's npm scripts. `run_etl.bat` is a stub. The only `clone` hit is `React.cloneElement`. |

---

## A. PRIMARY REPOSITORY

The repository that contains this Shoelotskey application.

| Field | Value |
|---|---|
| Owner / repository | `crg-philsca/shoelotskey-service-management-system` |
| URL | https://github.com/crg-philsca/shoelotskey-service-management-system |
| Clone URL used by `origin` | https://github.com/crg-philsca/shoelotskey-service-management-system.git |
| Why it is connected | This **is** the application. Frontend (`src/`), backend (`backend/`), build (`vite.config.ts`, `package.json`), Python deps (`requirements.txt`), and Heroku process (`Procfile`) all live here. |
| File / config that references it | Git remote `origin`; `README.md` tech-stack badge |
| Required for build | **Yes** |
| Required for runtime | **Yes** (this is the runtime source) |
| Part of deployment | **Yes** (source pushed to Heroku) |
| Safe to leave independent | N/A — this **is** the independent application repository |

### What this repository contains

- React + TypeScript + Vite frontend (`src/`, `index.html`, `vite.config.ts`)
- FastAPI + SQLAlchemy backend (`backend/main.py` and related modules)
- Production SPA serving: FastAPI mounts `../dist/assets` and returns `../dist/index.html` for client routes
- Local development: `npm run monolith` / `run.bat` start Vite and uvicorn from this tree
- ML artifacts and historical OCR live under `backend/` in this same tree

No frontend or backend component is served from another Git repository.

---

## B. DIRECTLY CONNECTED REPOSITORIES

Repositories actually referenced or required by the application as **source Git repositories**.

**None.**

Evidence:

- `package.json` / `package-lock.json` install from the npm registry, not from Git.
- `requirements.txt` installs from PyPI, not from Git.
- Frontend `index.html` loads only `/src/main.tsx`.
- Frontend routes and lazy imports use `@/app/...` (this repo).
- Backend static mounts are local: `backend/static`, `backend/historical_data`, and repo-root `dist/`.
- `src/app/lib/apiBase.ts` points the UI at the **same** FastAPI origin in production (`/api`), or at local port `8000` in development. It does not call another repository.

npm and PyPI packages are **package-registry dependencies**, not connected Git repositories. Their upstream GitHub project pages are not cloned, submoduled, or required as repos.

---

## C. DEPLOYMENT SOURCE REPOSITORIES

Repositories used by Heroku, CI/CD, GitHub Actions, or other deployment mechanisms.

### C1. Heroku Git remote (same application, deploy target)

| Field | Value |
|---|---|
| Owner / repository | Not a GitHub repository. Heroku app slug: `shoelotskey-villamor-pasay` |
| URL | https://git.heroku.com/shoelotskey-villamor-pasay.git |
| Why it is connected | Local Git remote named `heroku`. Used to push **this** codebase to the Heroku app. Also referenced as a public app host in `README.md` and `backend/main.py` (logo / Host header fallback). |
| File / config | Git remote `heroku`; `Procfile`; `package.json` script `heroku-postbuild`; `README.md` deploy badge; `backend/main.py` Heroku host strings |
| Required for build | **No.** Local and CI-less builds use this repo only. |
| Required for runtime | **No** as a source repo. The running dyno is this same application after deploy. |
| Part of deployment | **Yes** — deploy destination, not a second source tree |
| Safe to leave independent | **Yes** as a GitHub-style “other repo.” It is not an independent application repository. It is Heroku’s receive Git endpoint for this app. |

How this app deploys (from files in this repo):

1. Source is this Git repository.
2. `Procfile` starts gunicorn on `backend.main:app`.
3. `package.json` `heroku-postbuild` runs `vite build` in this repo, producing `dist/`.
4. FastAPI serves that `dist/` at runtime.

There is no `heroku.yml`, no `app.json`, no Docker image from another repo, and no documented GitHub Actions deploy.

`git remote show heroku` could not be completed in this session (network hang). Local `heroku/main` exists and is behind `origin/main`. That does **not** introduce another source repository.

### C2. GitHub Actions / other CI

**None.** No `.github/workflows`, no `netlify.toml`, `vercel.json`, `render.yaml`, or `fly.toml`.

No other GitHub repository is configured as a deployment source.

---

## D. EXTERNAL / OPTIONAL REPOSITORIES

Mentioned in documentation or leftover scaffolding. **Not required** to build, run, or deploy this application.

### D1. `shadcn-ui/ui` (license attribution only)

| Field | Value |
|---|---|
| Owner / repository | `shadcn-ui/ui` |
| URL | https://github.com/shadcn-ui/ui/blob/main/LICENSE.md (linked from docs) |
| Why mentioned | `docs/ATTRIBUTIONS.md` credits shadcn/ui MIT license and the Figma Make starting point. |
| File / config | `docs/ATTRIBUTIONS.md` |
| Required for build | **No.** UI primitives are already copied into `src/app/components/ui/` in this repo. |
| Required for runtime | **No.** |
| Part of deployment | **No.** |
| Safe to leave independent | **Yes.** |

There is no `components.json`, no shadcn CLI git dependency, and no submodule.

### D2. npm package upstream GitHub pages (sponsor / homepage URLs)

`package-lock.json` contains many `https://github.com/sponsors/...` and similar sponsor URLs (chalk, vite, sindresorhus, etc.). These are funding metadata for registry packages.

They are **not** Git dependencies. Packages resolve from `https://registry.npmjs.org/...`.

Safe to leave independent: **Yes.**

### D3. Figma Make package name (not a repository)

`package.json` and `package-lock.json` still use the leftover name `@figma/my-make-file`. That is an npm package **name**, not a Git remote and not a required external repository.

Safe to leave independent: **Yes.**

### D4. Local Antigravity / Gemini file paths in HTML docs

`docs/capstone_manuscript_chapter_1_to_4.html` embeds `file:///C:/Users/charm/.gemini/antigravity/brain/...` image paths. Those are local files on one machine, not Git repositories, and are not used by the running application.

Safe to leave independent: **Yes.**

---

## Build and runtime: is another repository required?

| Question | Answer |
|---|---|
| Is the frontend served from another repository? | **No.** Dev: Vite in this repo. Prod: FastAPI serves `dist/` from this repo (`backend/main.py` mounts `/assets` and falls back to `dist/index.html`). |
| Is the backend served from another repository? | **No.** `Procfile` and `npm run server` run `backend/main.py` in this tree. |
| Is another repository required at build time? | **No.** `npm install` + `vite build` + `pip install -r requirements.txt` use npm and PyPI only. |
| Is another repository required at runtime? | **No.** Same-origin `/api` in production. Optional `VITE_API_URL` would still be a URL, not a Git repo. |
| Does Heroku pull a different GitHub repo? | **No evidence in this project.** Local deploy remote is Heroku Git for this app. No GitHub Actions mapping. |

---

## Answers to the required Git questions

| Question | Answer |
|---|---|
| Which repository does `origin` point to? | `crg-philsca/shoelotskey-service-management-system` at https://github.com/crg-philsca/shoelotskey-service-management-system.git |
| Which branch is currently checked out? | `capstone-fixes` |
| Upstream branch | **None** for `capstone-fixes` |
| Do current local commits differ from GitHub `main`? | **Yes.** HEAD `6dda508` is 1 commit ahead of `origin/main` (`95b3a45`). The working tree also has many uncommitted changes that are not on GitHub. |
| Do any submodules exist? | **No.** |
| Does the project contain nested Git repositories? | **No.** |

---

## Classification rule applied

A repository is listed as connected only when this project actually remotes it, submodules it, depends on it via Git URL, clones/fetches it, or requires it at build/deploy time.

Name similarity alone was not used. No other GitHub repository was classified as connected merely because it might contain “Shoelotskey” in its name.

---

## Conclusion

**Only this repository is required.**

The sole application source repository is:

**`crg-philsca/shoelotskey-service-management-system`**  
https://github.com/crg-philsca/shoelotskey-service-management-system

The Heroku Git remote is a deploy target for this same application, not a second source repository. shadcn/ui and npm GitHub sponsor URLs are documentation or package metadata only.
