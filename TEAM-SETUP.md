# Team Setup Guide - Jira MCP Server

## For Each Team Member

### Step 1: Clone/Update the Project
```bash
# If you already have studio-extensions-fresh:
cd /path/to/root/jira-mcp-server
git pull origin main

# Note: jira-mcp-server is now at /path/to/root/jira-mcp-server
```

### Step 2: Generate Jira API Token (One-time setup)

1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Name it: `jira-mcp-server` (or similar)
4. Copy the generated token (save it temporarily)
5. **Keep this token private** - don't commit it or share it in chat

### Step 3: Run Setup Script

```bash
cd /path/to/root/jira-mcp-server
chmod +x setup.sh
./setup.sh
```

The script will:
- Check if Node.js is installed
- Ask for your Jira email and API token
- Save them to `./.jira-mcp/config.json` in the repo root (securely, with 600 permissions)
- Install dependencies
- Build the TypeScript code

Before filling in the config, choose the correct hosting mode:
- Atlassian Cloud (`*.atlassian.net`) -> `"hosting": "cloud"` and use email + token
- Self-hosted Jira Data Center / Server -> `"hosting": "datacenter"` or `"server"` and usually use a Jira personal access token

**Alternative (Using Environment Variables):**

Instead of storing the token in config, you can use an environment variable for better security:

1. Set the environment variable:
```bash
export JIRA_API_TOKEN="your-api-token"
```

2. Edit `./.jira-mcp/config.json` manually:
```json
{
  "baseUrl": "https://jira.custom.domain.com",
  "hosting": "cloud",
  "email": "your-email@domain.com",
  "tokenEnvVar": "JIRA_API_TOKEN"
}
```

3. The server will now read the token from the `JIRA_API_TOKEN` environment variable at runtime.

**Alternative (Jira Data Center / Server):**

For self-hosted Jira such as `https://jira.devops.medable.com`, use a config like:

```json
{
  "baseUrl": "https://jira.devops.medable.com",
  "hosting": "datacenter",
  "token": "your-jira-personal-access-token"
}
```

This mode uses `Bearer` authentication against `/rest/api/2`.

**Advanced (Both methods - flexible):**

You can also provide both `token` and `tokenEnvVar` in the same config. The server will use the environment variable if it exists, otherwise fall back to the hardcoded token:

```json
{
  "baseUrl": "https://jira.custom.domain.com",
  "hosting": "cloud",
  "email": "your-email@domain.com",
  "token": "fallback-token-if-env-not-set",
  "tokenEnvVar": "JIRA_API_TOKEN"
}
```

Priority: Environment variable > Hardcoded token

### Step 4: Test It Works

```bash
cd /path/to/root/jira-mcp-server
npm run build
```

Test with a proper MCP handshake:
```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | node dist/index.js
```

You should see the server info and a list of 7 available tools.

### Step 5: Configure VS Code (Optional - for AI agent integration)

1. Open `.vscode/settings.json` in your project
2. Merge in the configuration from `.vscode-settings.example.json`
3. Restart VS Code

## Tips for Team Leads

### Distributing to the Team

1. **Share this guide** with your team
2. **Ensure Git is up to date** - the MCP server is in `tools/jira-mcp-server`
3. **Security reminder**: Each person creates their own API token and local config
4. **No credentials in Git**: The `.gitignore` prevents accidental commits of credentials

### Troubleshooting Common Issues

**"Config file not found"**
```bash
# Create the directory structure
mkdir -p .jira-mcp
# Make sure config.json exists with your credentials
```

**"Error: EACCES: permission denied"**
```bash
# Check file permissions
ls -la ./.jira-mcp/config.json
# Should be: -rw------- (600 permissions)
chmod 600 ./.jira-mcp/config.json
```

**"npm: command not found"**
- Install Node.js from https://nodejs.org

**"Authentication failed"**
- Verify the API token hasn't expired
- Check your email matches your Jira account for Jira Cloud
- For self-hosted Jira, verify you are using a Jira Personal Access Token rather than an Atlassian Cloud API token
- Verify the baseUrl is correct

## Extending the MCP Server

To add new Jira functionality:

1. Edit `src/index.ts`
2. Add a new `server.tool()` call with name, description, zod schema, and handler
3. Run `npm run build`
4. Test and commit

Example adding a new tool:

```typescript
server.tool(
  'getIssueHistory',
  'Get the changelog/history of a Jira issue',
  { issueKey: z.string().describe('The Jira issue key, e.g. PROJ-123') },
  async ({ issueKey }) => {
    try {
      const response = await client.get(`/issue/${issueKey}/changelog`)
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Failed: ${error.message}` }], isError: true }
    }
  }
)
```

## Security Best Practices

✅ **DO:**
- Keep API tokens in `./.jira-mcp/config.json` and out of Git
- Use `chmod 600 ./.jira-mcp/config.json`
- Rotate tokens regularly
- Use personal API tokens (not shared accounts)

❌ **DON'T:**
- Commit `config.json` to Git
- Share API tokens via Slack/Email
- Use admin-level tokens for this tool
- Store tokens in environment variables visible in code

## Questions?

For issues or requests:
1. Check the main [README.md](./README.md) in the jira-mcp-server folder
2. Review Jira API documentation: https://developer.atlassian.com/cloud/jira/rest/v3
3. Open an issue on the team's internal tracker
