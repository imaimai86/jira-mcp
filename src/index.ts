#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import axios, { type AxiosInstance } from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { z } from 'zod'

type JiraHosting = 'cloud' | 'datacenter' | 'server'

interface JiraConfig {
  baseUrl: string
  hosting: JiraHosting
  token?: string
  tokenEnvVar?: string
  email?: string
  emailEnvVar?: string
}

function resolveEnvOrValue(envVar?: string, value?: string): string | undefined {
  if (envVar) {
    const envValue = process.env[envVar]
    if (envValue) return envValue
  }
  return value
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getConfigPath(): string {
  const envConfigPath = process.env.JIRA_CONFIG
  if (envConfigPath) {
    return path.resolve(envConfigPath)
  }

  const repoConfigPath = path.resolve(__dirname, '..', '.jira-mcp', 'config.json')
  if (fs.existsSync(repoConfigPath)) {
    return repoConfigPath
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  return path.join(homeDir, '.jira-mcp', 'config.json')
}

function loadConfig(configPath?: string): JiraConfig {
  const filePath = configPath || getConfigPath()

  if (!fs.existsSync(filePath)) {
    console.error(`Config file not found at ${filePath}`)
    console.error('Please create ./.jira-mcp/config.json in the repo root, or set JIRA_CONFIG to a custom config path')
    process.exit(1)
  }

  try {
    const fileConfig = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
    if (!fileConfig.baseUrl) {
      throw new Error('Missing required config field: baseUrl')
    }

    const hosting: JiraHosting = fileConfig.hosting || 'datacenter'
    if (!['cloud', 'datacenter', 'server'].includes(hosting)) {
      throw new Error(`Invalid hosting type "${hosting}". Use: cloud, datacenter, or server`)
    }

    const token = resolveEnvOrValue(fileConfig.tokenEnvVar, fileConfig.token)
    if (!token) {
      throw new Error('Missing token: provide either "token" in config file or set "tokenEnvVar" with a corresponding environment variable')
    }

    const email = resolveEnvOrValue(fileConfig.emailEnvVar, fileConfig.email)
    if (hosting === 'cloud' && !email) {
      throw new Error('Missing email: required for Jira Cloud. Provide "email" in config or set "emailEnvVar"')
    }

    return {
      baseUrl: fileConfig.baseUrl,
      hosting,
      email,
      token,
      tokenEnvVar: fileConfig.tokenEnvVar,
      emailEnvVar: fileConfig.emailEnvVar
    }
  } catch (error) {
    console.error('Failed to load config:', error)
    process.exit(1)
  }
}

function createClient(config: JiraConfig): AxiosInstance {
  if (!config.token) {
    throw new Error('Token not available. Check your configuration.')
  }

  const isCloud = config.hosting === 'cloud'
  const apiVersion = isCloud ? '3' : '2'

  let authorization: string
  if (isCloud) {
    const basicToken = Buffer.from(`${config.email}:${config.token}`).toString('base64')
    authorization = `Basic ${basicToken}`
  } else {
    authorization = `Bearer ${config.token}`
  }

  return axios.create({
    baseURL: `${config.baseUrl}/rest/api/${apiVersion}`,
    headers: {
      Authorization: authorization,
      'Content-Type': 'application/json'
    }
  })
}

function formatDescription(text: string, isCloud: boolean): any {
  if (isCloud) {
    return {
      version: 1,
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
    }
  }
  return text
}

function formatComment(text: string, isCloud: boolean): any {
  if (isCloud) {
    return {
      body: {
        version: 1,
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text }] }]
      }
    }
  }
  return { body: text }
}

function extractText(value: any): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => extractText(item))
      .filter((item): item is string => Boolean(item))
    return parts.length ? parts.join('\n').trim() : null
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text
    if (Array.isArray(value.content)) {
      const parts = value.content
        .map((item: any) => extractText(item))
        .filter((item: string | null): item is string => Boolean(item))
      return parts.length ? parts.join('\n').trim() : null
    }
  }
  return null
}

function mapUser(user: any) {
  if (!user) return null
  return {
    displayName: user.displayName || null,
    email: user.emailAddress || user.name || null,
    username: user.name || null
  }
}

function mapComment(comment: any) {
  if (!comment) return null
  return {
    id: comment.id || null,
    author: mapUser(comment.author),
    created: comment.created || null,
    updated: comment.updated || null,
    body: extractText(comment.body)
  }
}

function mapIssueLinks(links: any[]) {
  if (!Array.isArray(links)) return []

  return links.map((link: any) => {
    const linkedIssue = link.outwardIssue || link.inwardIssue
    const direction = link.outwardIssue ? 'outward' : 'inward'

    return {
      id: link.id || null,
      relationship: direction === 'outward' ? link.type?.outward || null : link.type?.inward || null,
      direction,
      linkType: link.type?.name || null,
      issue: linkedIssue ? {
        id: linkedIssue.id || null,
        key: linkedIssue.key || null,
        summary: linkedIssue.fields?.summary || null,
        issueType: linkedIssue.fields?.issuetype ? {
          name: linkedIssue.fields.issuetype.name || null,
          description: linkedIssue.fields.issuetype.description || null
        } : null,
        status: linkedIssue.fields?.status?.name || null,
        priority: linkedIssue.fields?.priority?.name || null
      } : null
    }
  })
}

function summarizeIssue(issue: any) {
  const comments = Array.isArray(issue.fields?.comment?.comments)
    ? issue.fields.comment.comments.map((comment: any) => mapComment(comment))
    : []

  const attachments = Array.isArray(issue.fields?.attachment)
    ? issue.fields.attachment.map((attachment: any) => ({
        id: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType || null,
        size: attachment.size || null
      }))
    : []

  const issueLinks = mapIssueLinks(issue.fields?.issuelinks)

  return {
    id: issue.id,
    key: issue.key,
    summary: issue.fields?.summary || null,
    description: extractText(issue.fields?.description),
    details: {
      project: issue.fields?.project?.name || null,
      issueType: issue.fields?.issuetype?.name || null,
      status: issue.fields?.status?.name || null,
      priority: issue.fields?.priority?.name || null,
      dueDate: issue.fields?.duedate || null,
      created: issue.fields?.created || null,
      updated: issue.fields?.updated || null
    },
    people: {
      assignee: mapUser(issue.fields?.assignee),
      reporter: mapUser(issue.fields?.reporter),
      creator: mapUser(issue.fields?.creator)
    },
    issueLinks,
    comments,
    attachments
  }
}

function formatJiraError(error: any): string {
  const code = error.code as string | undefined
  const status = error.response?.status as number | undefined
  const baseUrl = config?.baseUrl || 'unknown'

  if (code === 'ENETUNREACH' || code === 'EHOSTUNREACH') {
    return `Network unreachable — cannot connect to Jira at ${baseUrl}. Check your network connection or VPN.`
  }
  if (code === 'ECONNREFUSED') {
    return `Connection refused by Jira at ${baseUrl}. Verify the server is running and the baseUrl in your Jira MCP config is correct.`
  }
  if (code === 'ENOTFOUND') {
    return `DNS lookup failed for Jira host. Verify the baseUrl "${baseUrl}" in your Jira MCP config is correct.`
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
    return `Connection to Jira at ${baseUrl} timed out. The server may be down or unreachable. Check your network/VPN.`
  }
  if (code === 'ECONNRESET') {
    return `Connection to Jira was reset. This may be a transient network issue — try again.`
  }
  if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
    return `TLS/SSL certificate error connecting to ${baseUrl}: ${code}. Check the server's certificate or your system's trust store.`
  }
  if (status === 401) {
    return `Authentication failed (401). Your API token may be expired or invalid. Regenerate it and update your Jira MCP config.`
  }
  if (status === 403) {
    return `Permission denied (403). Your API token does not have access to this resource. Check your Jira permissions.`
  }
  if (status === 404) {
    return `Not found (404). The requested resource does not exist in Jira — verify the issue key or project key is correct.`
  }
  if (status && status >= 500) {
    return `Jira server error (${status}). The Jira instance at ${baseUrl} returned an internal error. Try again later.`
  }

  return error.message || 'Unknown error'
}

// --- Main ---

const config = loadConfig()
const client = createClient(config)
const isCloud = config.hosting === 'cloud'

const server = new McpServer({
  name: 'jira-mcp-server',
  version: '1.0.0'
})

server.tool(
  'getIssue',
  'Get a Jira issue by its key (e.g. PROJ-123)',
  {
    issueKey: z.string().describe('The Jira issue key, e.g. PROJ-123'),
    raw: z.boolean().optional().default(false).describe('Return the full raw Jira issue payload instead of the summarized response')
  },
  async ({ issueKey, raw }) => {
    try {
      const response = await client.get(`/issue/${issueKey}`, raw ? undefined : {
        params: {
          fields: 'summary,description,status,priority,duedate,assignee,reporter,creator,attachment,comment,created,updated,issuetype,project,issuelinks'
        }
      })

      const result = raw ? response.data : summarizeIssue(response.data)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Failed to fetch issue ${issueKey}: ${formatJiraError(error)}` }], isError: true }
    }
  }
)

server.tool(
  'searchIssues',
  'Search Jira issues using JQL (Jira Query Language)',
  {
    jql: z.string().describe('JQL query string'),
    maxResults: z.number().optional().default(50).describe('Maximum number of results to return')
  },
  async ({ jql, maxResults }) => {
    try {
      const response = await client.get('/search', { params: { jql, maxResults } })
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Failed to search issues: ${formatJiraError(error)}` }], isError: true }
    }
  }
)

server.tool(
  'createIssue',
  'Create a new Jira issue',
  {
    projectKey: z.string().describe('The project key, e.g. PROJ'),
    issueType: z.string().describe('The issue type name, e.g. Bug, Story, Task'),
    summary: z.string().describe('Issue summary/title'),
    description: z.string().optional().describe('Issue description')
  },
  async ({ projectKey, issueType, summary, description }) => {
    try {
      const response = await client.post('/issue', {
        fields: {
          project: { key: projectKey },
          issuetype: { name: issueType },
          summary,
          ...(description && { description: formatDescription(description, isCloud) })
        }
      })
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Failed to create issue: ${formatJiraError(error)}` }], isError: true }
    }
  }
)

server.tool(
  'updateIssue',
  'Update fields on an existing Jira issue',
  {
    issueKey: z.string().describe('The Jira issue key, e.g. PROJ-123'),
    fields: z.record(z.string(), z.any()).describe('Object of fields to update, e.g. {"summary": "New title"}')
  },
  async ({ issueKey, fields }) => {
    try {
      await client.put(`/issue/${issueKey}`, { fields })
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Issue ${issueKey} updated` }) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Failed to update issue ${issueKey}: ${formatJiraError(error)}` }], isError: true }
    }
  }
)

server.tool(
  'addComment',
  'Add a comment to a Jira issue',
  {
    issueKey: z.string().describe('The Jira issue key, e.g. PROJ-123'),
    comment: z.string().describe('The comment text to add')
  },
  async ({ issueKey, comment }) => {
    try {
      const response = await client.post(
        `/issue/${issueKey}/comment`,
        formatComment(comment, isCloud)
      )
      return { content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Failed to add comment to ${issueKey}: ${formatJiraError(error)}` }], isError: true }
    }
  }
)

server.tool(
  'getIssueComments',
  'Get comments on a Jira issue',
  {
    issueKey: z.string().describe('The Jira issue key, e.g. PROJ-123'),
    maxResults: z.number().optional().default(100).describe('Maximum number of comments to return')
  },
  async ({ issueKey, maxResults }) => {
    try {
      const response = await client.get(`/issue/${issueKey}/comment`, { params: { maxResults } })
      const comments = Array.isArray(response.data.comments)
        ? response.data.comments.map((comment: any) => mapComment(comment))
        : []
      return { content: [{ type: 'text', text: JSON.stringify(comments, null, 2) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Failed to fetch comments for ${issueKey}: ${formatJiraError(error)}` }], isError: true }
    }
  }
)

server.tool(
  'transitionIssue',
  'Transition a Jira issue to a new status (e.g. In Progress, Done)',
  {
    issueKey: z.string().describe('The Jira issue key, e.g. PROJ-123'),
    transitionName: z.string().describe('The name of the transition/status to move to')
  },
  async ({ issueKey, transitionName }) => {
    try {
      const transitions = await client.get(`/issue/${issueKey}/transitions`)
      const transition = transitions.data.transitions.find((t: any) => t.name === transitionName)

      if (!transition) {
        const available = transitions.data.transitions.map((t: any) => t.name).join(', ')
        return {
          content: [{ type: 'text', text: `Transition "${transitionName}" not found for issue ${issueKey}. Available transitions: ${available}` }],
          isError: true
        }
      }

      await client.post(`/issue/${issueKey}/transitions`, {
        transition: { id: transition.id }
      })

      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: `Issue ${issueKey} transitioned to ${transitionName}` }) }] }
    } catch (error: any) {
      return { content: [{ type: 'text', text: `Failed to transition issue: ${formatJiraError(error)}` }], isError: true }
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(console.error)
