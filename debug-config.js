#!/usr/bin/env node

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

const configPath = getConfigPath()

console.log('📋 Configuration Debug Info')
console.log('==========================')
console.log('Config path:', configPath)
console.log('Config exists:', fs.existsSync(configPath))

if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  const hosting = config.hosting || 'datacenter'
  const isCloud = hosting === 'cloud'
  const apiVersion = isCloud ? '3' : '2'

  console.log('\nConfig file contents:')
  console.log(JSON.stringify(config, null, 2))
  
  console.log('\nEnvironment variables:')
  console.log('JIRA_EMAIL:', process.env.JIRA_EMAIL || 'NOT SET')
  console.log('JIRA_API_TOKEN:', process.env.JIRA_API_TOKEN ? '✓ SET (' + process.env.JIRA_API_TOKEN.length + ' chars)' : 'NOT SET')
  
  console.log('\nResolved values:')
  const email = resolveEnvOrValue(config.emailEnvVar, config.email)
  if (config.emailEnvVar && process.env[config.emailEnvVar]) {
    console.log('Email (from', config.emailEnvVar + '):', email)
  } else if (config.email) {
    console.log('Email (from config):', email)
  }
  
  const token = resolveEnvOrValue(config.tokenEnvVar, config.token)
  if (config.tokenEnvVar && process.env[config.tokenEnvVar]) {
    console.log('Token (from', config.tokenEnvVar + '):', '✓ SET (' + token.length + ' chars)')
  } else if (config.token) {
    console.log('Token (from config):', '✓ SET (' + config.token.length + ' chars)')
  }

  console.log('\nResolved auth mode:')
  console.log('Hosting:', hosting)
  console.log('API version:', apiVersion)
  console.log('Authorization:', isCloud ? 'Basic email:token' : 'Bearer token')

  if (isCloud) {
    if (email && token) {
      const auth = Buffer.from(`${email}:${token}`).toString('base64')
      console.log('Basic Auth (first 30 chars):', auth.substring(0, 30) + '...')
    } else {
      console.log('Basic Auth preview: unavailable (missing email or token)')
    }
  } else {
    console.log('Bearer token preview:', token ? '✓ SET (' + token.length + ' chars)' : 'NOT SET')
  }
}
