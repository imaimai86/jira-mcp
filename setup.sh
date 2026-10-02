#!/bin/bash
# Quick setup script for the Jira MCP Server

set -e

echo "🔧 Jira MCP Server Setup"
echo "========================"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Create config directory inside the repo
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/.jira-mcp"
CONFIG_FILE="$CONFIG_DIR/config.json"

mkdir -p "$CONFIG_DIR"

if [ -f "$CONFIG_FILE" ]; then
    echo "⚠️  Config file already exists at $CONFIG_FILE"
    read -p "Do you want to update it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Skipping configuration..."
    else
        create_config=true
    fi
else
    create_config=true
fi

if [ "$create_config" = true ]; then
    echo ""
    echo "📝 Setting up Jira API credentials"
    echo "======================================"
    echo ""
    echo "Before proceeding, generate a Jira API token:"
    echo "1. Go to https://id.atlassian.com/manage-profile/security/api-tokens"
    echo "2. Click 'Create API token'"
    echo "3. Copy the token"
    echo ""
    
    read -p "Enter your Jira email address: " jira_email
    read -sp "Enter your Jira API token: " jira_token
    echo ""
    
    cat > "$CONFIG_FILE" << EOF
{
  "baseUrl": "https://jira.custom.domain.com",
  "email": "$jira_email",
  "token": "$jira_token"
}
EOF
    
    chmod 600 "$CONFIG_FILE"
    echo "✅ Config saved to $CONFIG_FILE (permissions: 600)"
fi

# Install and build
echo ""
echo "📦 Installing dependencies..."
cd "$SCRIPT_DIR"
npm install --quiet

echo "🔨 Building TypeScript..."
npm run build --quiet

echo ""
echo "✅ Setup complete!"
echo ""
echo "Test the server with:"
echo "  npm run dev"
echo ""
echo "In another terminal:"
echo '  echo '"'"'{"jsonrpc":"2.0","id":1,"method":"getIssue","params":{"issueKey":"STUDY-11144"}}'"'"' | node dist/index.js'
