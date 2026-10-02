# Jira MCP Server - Development History

## Project Overview
**Goal:** Create a reusable, shareable Jira MCP Server to enable team-wide access to Jira API with flexible credential management.

**Location:** `/path/to/root/jira-mcp-server/`

**Technology:** TypeScript MCP Server (JSON-RPC 2.0 over stdin/stdout)

---

## Phase 1: Initial Architecture & Setup

### Steps Completed:
1. **Project Initialization**
   - Created `package.json` with dependencies: axios, typescript
   - Configured `tsconfig.json` for TypeScript compilation
   - Set up build system: `npm run build` compiles to `dist/index.js`

2. **Core MCP Server Implementation** (`src/index.ts`)
   - Implemented `JiraMCPServer` class
   - Implements JSON-RPC 2.0 protocol on stdin/stdout
   - Created 7 Jira API methods:
     - `getIssue(issueKey)` - Fetch issue details
     - `searchIssues(jql)` - JQL-based search
     - `createIssue(fields)` - Create new issue
     - `updateIssue(issueKey, fields)` - Update issue
     - `addComment(issueKey, comment)` - Add comment
     - `getIssueComments(issueKey)` - Fetch all comments
     - `transitionIssue(issueKey, transitionName)` - Move issue through workflow

3. **Authentication Layer**
   - Initially Basic Auth via `Authorization: Basic base64(email:token)`
   - Axios HTTP client configuration

---

## Phase 2: Credential Management Evolution

### Iteration 1: Hardcoded Credentials
- **Status:** Replaced - Not secure for team sharing

### Iteration 2: Environment Variables Only
- **Status:** Replaced - Inflexible for different deployments

### Iteration 3: Dual Support (Current)
- **Location:** `src/index.ts` - `loadConfig()` + `resolveEnvOrValue()`
- **Loading Priority:** Environment variables -> Hardcoded values -> Error
- **File:** `~/.jira-mcp/config.json`

---

## Phase 3: Build & Deployment

- **TypeScript Compilation:** `npm run build` -> `dist/index.js`
- **Execution:** `source ~/.zshrc && node dist/index.js`
- **Testing:** Stdin/stdout JSON-RPC communication

---

## Phase 4: Documentation

Files created: README.md, TEAM-SETUP.md, QUICK-REFERENCE.md, .env.example

---

## Phase 5: Testing & Debugging (Initial - Previous Session)

- `test-ticket.js`, `debug-config.js`, `test-auth.js` created
- Config loading verified working
- **Blocked** on 401 Unauthorized - Basic Auth was wrong approach for self-hosted Jira

---

## Phase 6: Bug Fixes & Multi-Hosting Support (Session 2 - 5 Mar 2026)

### Issue 1: Race Condition in stdin Handler
**Problem:** When piping input via stdin, the `end` event fired and called `process.exit(0)` before async HTTP requests completed. Server produced no output.

**Root Cause:** In `start()`, `process.stdin.on('end')` called `process.exit(0)` immediately, but the `data` handler was still awaiting async `handleRequest()` (which makes HTTP calls to Jira).

**Fix:** Added `pendingRequests` counter and `stdinEnded` flag with a `maybeExit()` function that only exits when both stdin has ended AND all pending requests are complete.

```typescript
let pendingRequests = 0
let stdinEnded = false
const maybeExit = () => {
  if (stdinEnded && pendingRequests === 0) process.exit(0)
}
// pendingRequests++ before handleRequest, -- in finally block
// stdinEnded = true in 'end' handler, then maybeExit()
```

**Status:** Fixed

### Issue 2: 401 Unauthorized - Wrong Auth Method
**Problem:** Server used `Basic` auth (email:token base64) which is for Jira Cloud. The target instance (`jira.devops.domain.com`) is self-hosted Jira Data Center using personal access tokens.

**Root Cause:** Jira Data Center uses `Bearer` token auth, not `Basic` auth. Also uses REST API v2, not v3.

**Fix:** Switched to `Authorization: Bearer <token>` and `/rest/api/2` for Data Center hosting.

**Status:** Fixed - `getIssue` for STUDY-11144 returned successfully

### Issue 3: Wrong API Endpoints & Formats for Data Center
**Problem:** Several endpoints and payload formats were Cloud-specific:
- Comment endpoint was `/issue/{key}/comments` (Cloud) instead of `/issue/{key}/comment` (v2)
- `getIssueComments` used wrong endpoint path
- `createIssue` used Atlassian Document Format (ADF) for description (Cloud-only)
- `addComment` used ADF for comment body (Cloud-only)

**Fix:**
- Fixed comment endpoints to `/issue/{key}/comment`
- Added `formatDescription()` - returns ADF for Cloud, plain string for Data Center
- Added `formatComment()` - returns ADF body for Cloud, plain string body for Data Center

**Status:** Fixed

### Issue 4: tsconfig Missing Node Types
**Problem:** IDE showed `Cannot find name 'process'` / `Cannot find name 'Buffer'` errors despite `@types/node` being installed.

**Fix:** Added `"types": ["node"]` to `tsconfig.json` compilerOptions.

**Status:** Fixed

### Feature: Multi-Hosting Support
**Goal:** Support all Jira hosting types in a single codebase.

**Implementation:**
- Added `hosting` config field: `"cloud"` | `"datacenter"` | `"server"`
- Default: `"datacenter"` (self-hosted is the primary use case)
- `isCloud` getter determines behavior branching
- `apiVersion` getter: Cloud -> `"3"`, Data Center/Server -> `"2"`

**Auth differences:**
| Hosting | Auth Header | API Version | Description Format | Email Required |
|---------|-------------|-------------|-------------------|----------------|
| `cloud` | `Basic base64(email:token)` | v3 | Atlassian Document Format (ADF) | Yes |
| `datacenter` | `Bearer <token>` | v2 | Plain text | No |
| `server` | `Bearer <token>` | v2 | Plain text | No |

**Config example (Data Center - current):**
```json
{
  "baseUrl": "https://jira.devops.domain.com",
  "tokenEnvVar": "JIRA_API_TOKEN",
  "emailEnvVar": "JIRA_EMAIL"
}
```

**Config example (Cloud):**
```json
{
  "baseUrl": "https://yourorg.atlassian.net",
  "hosting": "cloud",
  "emailEnvVar": "JIRA_EMAIL",
  "tokenEnvVar": "JIRA_API_TOKEN"
}
```

### Testing Results (Session 2)
- `getIssue("STUDY-11144")` - Successfully returned full issue data (38KB response)
- `getIssueComments("STUDY-11144")` - Successfully returned 5 comments
- Both methods verified working with Bearer auth on Data Center

---

## Configuration Status

### Current Setup:
- **Jira Instance:** https://jira.devops.domain.com (self-hosted Data Center)
- **Hosting Mode:** `datacenter` (default)
- **User Email:** your-email@domain.com
- **Auth:** Bearer token (personal access token)
- **Config Location:** `~/.jira-mcp/config.json`
- **Environment Variables:**
  - `JIRA_EMAIL` - set in `~/.zshrc`
  - `JIRA_API_TOKEN` - set in `~/.zshrc` (personal access token, working)

---

## Development Timeline

| Phase | Date | Status | Notes |
|-------|------|--------|-------|
| Architecture & Setup | 5 Mar 2026 | Complete | MCP server structure, 7 methods |
| Credential Management | 5 Mar 2026 | Complete | Dual support (env vars + hardcoded) |
| Build System | 5 Mar 2026 | Complete | TypeScript -> JavaScript |
| Documentation | 5 Mar 2026 | Complete | README, TEAM-SETUP, QUICK-REF |
| Initial Testing | 5 Mar 2026 | Complete | Config loading verified |
| Race Condition Fix | 5 Mar 2026 | Complete | stdin/async exit handling |
| Auth Fix (Bearer) | 5 Mar 2026 | Complete | Data Center uses Bearer, not Basic |
| Multi-Hosting Support | 5 Mar 2026 | Complete | cloud/datacenter/server |
| API Format Fixes | 5 Mar 2026 | Complete | ADF vs plain text, endpoint paths |
| tsconfig Fix | 5 Mar 2026 | Complete | Added types: ["node"] |
| Integration Testing | 5 Mar 2026 | Complete | getIssue, getIssueComments verified |

---

## File Structure
```
jira-mcp-server/
├── src/
│   ├── index.ts                    # Core implementation
│   └── examples.ts                 # Usage examples
├── dist/                           # Compiled output
├── AGENT/
│   └── History.md                  # This file
├── package.json
├── tsconfig.json
├── setup.sh                        # Interactive setup script
├── QUICK-REFERENCE.md
├── .vscode-settings.example.json
└── .vscode-tasks.example.json
```

---

## Commands Reference

### Build
```bash
npm run build
```

### Test (pipe JSON-RPC via stdin)
```bash
source ~/.zshrc
printf '{"jsonrpc":"2.0","id":1,"method":"getIssue","params":{"issueKey":"STUDY-11144"}}\n' | node dist/index.js
```

### Test Comments
```bash
printf '{"jsonrpc":"2.0","id":1,"method":"getIssueComments","params":{"issueKey":"STUDY-11144"}}\n' | node dist/index.js
```
