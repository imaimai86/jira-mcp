#!/usr/bin/env node

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getConfigPath() {
  if (process.env.JIRA_CONFIG) {
    return path.resolve(process.env.JIRA_CONFIG)
  }

  const repoConfigPath = path.join(__dirname, '.jira-mcp', 'config.json')
  if (fs.existsSync(repoConfigPath)) {
    return repoConfigPath
  }

  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  return path.join(homeDir, '.jira-mcp', 'config.json')
}

function resolveEnvOrValue(envVar, value) {
  if (envVar) {
    const envValue = process.env[envVar]
    if (envValue) return envValue
  }
  return value
}

async function testAuth() {
  try {
    const configPath = getConfigPath()
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

    const hosting = config.hosting || 'datacenter'
    if (!['cloud', 'datacenter', 'server'].includes(hosting)) {
      throw new Error(`Invalid hosting type "${hosting}". Use: cloud, datacenter, or server`)
    }

    const email = resolveEnvOrValue(config.emailEnvVar, config.email)
    const token = resolveEnvOrValue(config.tokenEnvVar, config.token)

    if (!token) {
      throw new Error('Missing token: provide either "token" in config file or set "tokenEnvVar" with a corresponding environment variable')
    }

    if (hosting === 'cloud' && !email) {
      throw new Error('Missing email: required for Jira Cloud authentication')
    }

    const isCloud = hosting === 'cloud'
    const apiVersion = isCloud ? '3' : '2'

    console.log('Testing Jira API authentication...')
    console.log('Config path:', configPath)
    console.log('Base URL:', config.baseUrl)
    console.log('Hosting:', hosting)
    console.log('API version:', apiVersion)
    console.log('Email:', email)
    console.log('Token length:', token?.length, 'chars')

    let authorization
    if (isCloud) {
      const auth = Buffer.from(`${email}:${token}`).toString('base64')
      authorization = `Basic ${auth}`
    } else {
      authorization = `Bearer ${token}`
    }

    const client = axios.create({
      baseURL: `${config.baseUrl}/rest/api/${apiVersion}`,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json'
      }
    })

    console.log('\n📡 Fetching STUDY-10817...')
    const response = await client.get('/issue/STUDY-10817')
    
    console.log('\n✅ Success! Ticket retrieved:')
    console.log('Key:', response.data.key)
    console.log('Summary:', response.data.fields.summary)
    console.log('Status:', response.data.fields.status.name)
    console.log('Assignee:', response.data.fields.assignee?.displayName || 'Unassigned')
    console.log('Created:', response.data.fields.created)
    console.log('Type:', response.data.fields.issuetype.name)
    
    if (response.data.fields.description?.content?.[0]?.content?.[0]?.text) {
      console.log('Description:', response.data.fields.description.content[0].content[0].text.substring(0, 300))
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.statusText)
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('Message:', error.message)
    }
  }
}

testAuth()
