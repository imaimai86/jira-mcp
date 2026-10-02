# Quick Reference - Jira MCP Server Commands

## Setup (First Time Only)

```bash
cd /path/to/root/jira-mcp-server
chmod +x setup.sh
./setup.sh
```

Or manual setup:
```bash
mkdir -p .jira-mcp
# Create ./.jira-mcp/config.json with your credentials
npm install
npm run build
```

Config examples:

```json
{
  "baseUrl": "https://your-company.atlassian.net",
  "hosting": "cloud",
  "email": "your-email@domain.com",
  "token": "your-api-token"
}
```

```json
{
  "baseUrl": "https://jira.devops.medable.com",
  "hosting": "datacenter",
  "token": "your-jira-personal-access-token"
}
```

## Start the Server

**Development mode:**
```bash
cd /path/to/root/jira-mcp-server
npm run dev
```

**Production mode:**
```bash
node tools/jira-mcp-server/dist/index.js
```

## Testing Commands

### Get Ticket Details
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"getIssue","params":{"issueKey":"STUDY-11144"}}' | node dist/index.js
```

### Search Tickets
```bash
echo '{"jsonrpc":"2.0","id":2,"method":"searchIssues","params":{"jql":"project = STUDY AND status = To Do","maxResults":10}}' | node dist/index.js
```

### Add Comment
```bash
echo '{"jsonrpc":"2.0","id":4,"method":"addComment","params":{"issueKey":"STUDY-11144","comment":"Your comment here"}}' | node dist/index.js
```

### Get Comments
```bash
echo '{"jsonrpc":"2.0","id":5,"method":"getIssueComments","params":{"issueKey":"STUDY-11144","maxResults":100}}' | node dist/index.js
```

### Transition Ticket
```bash
echo '{"jsonrpc":"2.0","id":6,"method":"transitionIssue","params":{"issueKey":"STUDY-11144","transitionName":"In Progress"}}' | node dist/index.js
```

### Create Ticket
```bash
echo '{"jsonrpc":"2.0","id":6,"method":"createIssue","params":{"projectKey":"STUDY","issueType":"Task","summary":"New feature","description":"Feature description"}}' | node dist/index.js
```

## Available Methods

| Method | Purpose | Required Params |
|--------|---------|-----------------|
| `getIssue` | Fetch ticket details | `issueKey` |
| `searchIssues` | Search with JQL | `jql`, optional `maxResults` |
| `createIssue` | Create new ticket | `projectKey`, `issueType`, `summary` |
| `updateIssue` | Update ticket fields | `issueKey`, `fields` |
| `addComment` | Add comment to ticket | `issueKey`, `comment` || `getIssueComments` | Fetch ticket comments | `issueKey`, optional `maxResults` || `transitionIssue` | Change ticket status | `issueKey`, `transitionName` |

## VS Code Integration

1. Copy config from `.vscode-settings.example.json` → `.vscode/settings.json`
2. Copy tasks from `.vscode-tasks.example.json` → `.vscode/tasks.json`
3. Run tasks via `Ctrl+Shift+P` → "Tasks: Run Task"

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Config not found | Run `mkdir -p .jira-mcp && ./setup.sh` |
| Auth failing | Verify email and API token in `./.jira-mcp/config.json` |
| Port already in use | Change port in config or kill existing process |
| TypeScript errors | Run `npm install && npm run build` |
| Can't find node | Install Node.js from https://nodejs.org |

## Security Reminders

🔒 Keep `./.jira-mcp/config.json` private  
🔒 Don't commit credentials to Git  
🔒 Rotate API tokens regularly  
🔒 Use `chmod 600 ./.jira-mcp/config.json`
