# Jira MCP Server

A reusable JSON-RPC MCP Server for Jira integration. Share this across your team to connect with Jira without relying on third-party APIs.

## What This Repo Does

This repo implements a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that exposes Jira as a set of callable tools — `getIssue`, `searchIssues`, `createIssue`, `updateIssue`, `addComment`, `getIssueComments`, and `transitionIssue` — over JSON-RPC 2.0 on stdio. Any MCP-compatible client (Claude Code, VS Code, etc.) can load this server and let an AI assistant read and act on Jira tickets directly, using the requesting user's own Jira credentials, with no third-party middleware in between.

## How This Was Built

This project was built using an **AI-first, human-in-the-loop** methodology: Claude (via Claude Code) authored the bulk of the implementation — the MCP tool definitions, the Jira API client, auth handling for both Cloud and Data Center/Server hosting, and this documentation — while a human engineer drove the process by setting direction, reviewing each change, testing against real Jira instances, and approving or correcting the output before it was merged.

In practice, that meant:

- **AI-first drafting** — Claude proposed the architecture, wrote the TypeScript source, and generated setup/troubleshooting docs from the actual code behavior.
- **Human-in-the-loop review** — every generated change was read, tested, and either accepted, corrected, or sent back for revision by a human before being committed.
- **Iterative refinement** — issues found during manual verification (e.g., Cloud vs. Data Center auth differences) were fed back to the AI to fix at the source, rather than patched around.

The result is a small, auditable codebase where AI did the heavy lifting on implementation speed, and human judgment stayed the final gate on correctness, security, and what shipped.

## Features

- ✅ Fetch ticket details
- ✅ Search tickets with JQL
- ✅ Create tickets
- ✅ Update ticket fields
- ✅ Add comments
- ✅ Transition tickets (change status)

## Setup Instructions

### 1. Generate Jira API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name (e.g., "MCP Server")
4. Copy the token (you'll need it in the next step)

### 2. Create Configuration File

Create `./.jira-mcp/config.json` in the repo root:

```bash
mkdir -p .jira-mcp
```

Then create the config file with your credentials. You have several options:

Choose the correct `hosting` value first:

- Use `"cloud"` for Atlassian Cloud sites such as `https://your-company.atlassian.net`
- Use `"datacenter"` or `"server"` for self-hosted Jira instances such as `https://jira.devops.medable.com`
- Cloud uses `Basic email:token` on `/rest/api/3`
- Data Center/Server uses `Bearer token` on `/rest/api/2`

**Option A: Token in config (simple, less secure)**
```json
{
  "baseUrl": "https://jira.custom.domain.com",
  "hosting": "cloud",
  "email": "your-email@domain.com",
  "token": "your-jira-api-token-here"
}
```

**Option A2: Jira Data Center / Server**
```json
{
  "baseUrl": "https://jira.devops.medable.com",
  "hosting": "datacenter",
  "token": "your-jira-personal-access-token"
}
```

**Option B: Token from environment variable (recommended)**

First, set the environment variable:
```bash
export JIRA_API_TOKEN="your-jira-api-token-here"
```

Then use this config:
```json
{
  "baseUrl": "https://jira.custom.domain.com",
  "hosting": "cloud",
  "email": "your-email@domain.com",
  "tokenEnvVar": "JIRA_API_TOKEN"
}
```

**Option C: Both (flexible - env var takes priority)**

You can provide both `token` and `tokenEnvVar`. The server will:
1. Try to read from the environment variable first (if `tokenEnvVar` is specified)
2. Fall back to the hardcoded `token` if the environment variable is not set
3. Use the hardcoded token as a fallback in other environments

```json
{
  "baseUrl": "https://jira.custom.domain.com",
  "hosting": "cloud",
  "email": "your-email@domain.com",
  "token": "fallback-token-here",
  "tokenEnvVar": "JIRA_API_TOKEN"
}
```

The `tokenEnvVar` field can be any environment variable name you want.

Config lookup order:
1. `JIRA_CONFIG` environment variable, if set
2. `./.jira-mcp/config.json` in the repo root
3. `~/.jira-mcp/config.json` as a backwards-compatible fallback

For self-hosted Jira, do not assume an Atlassian Cloud API token from `id.atlassian.com` will work. Many organizations require a Jira Personal Access Token issued by the self-hosted Jira instance itself.

⚠️ **Security**: 
- If using Option A or C with a token in the file, keep the config file private. Add it to `.gitignore`.
- Option B or C with environment variables is more secure as it avoids storing tokens in files. Add the environment variable to your shell profile or CI/CD secrets.
- The environment variable takes priority when both are provided.

### 3. Install Dependencies

```bash
cd /path/to/root/jira-mcp-server
npm install
npm run build
```

### 4. Test the Server

MCP uses the JSON-RPC 2.0 protocol over stdio with a session lifecycle: the client must first initialize the connection before calling any tools. Tool names are not called as top-level methods — instead, use `tools/call` with the tool name and arguments.

```bash
cd /path/to/root/jira-mcp-server
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"getIssue","arguments":{"issueKey":"STUDY-11144"}}}\n' | node dist/index.js
```

You can also list all available tools:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | node dist/index.js
```

> **Note**: In practice, MCP servers are meant to be used by MCP clients (e.g., Claude Code, VS Code) that handle the protocol lifecycle automatically. The commands above are for manual verification only.

## Usage

### In Claude Code

Add the MCP server to your Claude Code configuration at `~/.claude.json` (global) or `.mcp.json` (per-project):

```json
{
  "mcpServers": {
    "jira": {
      "command": "/Users/<username>/.nvm/versions/node/v22.x.x/bin/node",
      "args": ["/path/to/root/jira-mcp-server/dist/index.js"]
    }
  }
}
```

> **Note**: Use the direct path to Node.js 22 instead of just `node` to ensure the correct version is used regardless of your shell's PATH or version manager (nvm, fnm, etc.). To find your Node 22 path, run `nvm which 22` or `which node` (if v22 is your default).

### In VS Code Settings

Add to your `.vscode/settings.json`:

```json
{
  "modelContext.servers": {
    "jira": {
      "command": "/Users/<username>/.nvm/versions/node/v22.x.x/bin/node",
      "args": ["/path/to/root/jira-mcp-server/dist/index.js"]
    }
  }
}
```

### Methods

#### getIssue
Fetch details for a specific ticket.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getIssue",
  "params": {
    "issueKey": "STUDY-11144"
  }
}
```

#### searchIssues
Search tickets using JQL.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "searchIssues",
  "params": {
    "jql": "project = STUDY AND status = 'To Do'",
    "maxResults": 50
  }
}
```

#### createIssue
Create a new ticket.

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "createIssue",
  "params": {
    "projectKey": "STUDY",
    "issueType": "Task",
    "summary": "New task title",
    "description": "Task description"
  }
}
```

#### updateIssue
Update ticket fields.

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "updateIssue",
  "params": {
    "issueKey": "STUDY-11144",
    "fields": {
      "summary": "Updated title",
      "labels": ["urgent", "backend"]
    }
  }
}
```

#### addComment
Add a comment to a ticket.

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "addComment",
  "params": {
    "issueKey": "STUDY-11144",
    "comment": "Your comment text here"
  }
}
```

#### getIssueComments
Fetch all comments from a ticket.

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "getIssueComments",
  "params": {
    "issueKey": "STUDY-11144",
    "maxResults": 100
  }
}
```

#### transitionIssue
Change ticket status.

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "transitionIssue",
  "params": {
    "issueKey": "STUDY-11144",
    "transitionName": "In Progress"
  }
}
```

## Sharing with Colleagues

1. **Commit to Git** (excluding `.jira-mcp/config.json`)
2. **Each teammate** creates their own local `./.jira-mcp/config.json` with their Jira API token
3. **Share the setup link** to this README
4. **Update VS Code settings** to point to their local copy

## Troubleshooting

### "Config file not found"
Ensure `./.jira-mcp/config.json` exists with valid credentials, or set `JIRA_CONFIG` to a custom path.

### "Authentication failed"
Check that your:
- Email matches your Jira account email
- API token is valid (not expired)
- Base URL is correct

### "Failed to transition issue"
Use `getIssue` first to see available transitions for that ticket.

## Architecture

- **Standard MCP Format**: Uses JSON-RPC 2.0 for compatibility
- **No Dependencies on Third-Party Services**: Direct Jira API calls
- **TypeScript**: Type-safe and easy to extend
- **Shared Configuration**: Team members use their own credentials

## Future Enhancements

- [ ] Add webhook support for issue events
- [ ] Implement caching for performance
- [ ] Add batch operations
- [ ] Support for Jira automation rules
