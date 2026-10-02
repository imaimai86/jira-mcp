#!/usr/bin/env node

import { JiraMCPServer } from './dist/index.js'

async function testFetch() {
  try {
    const server = new JiraMCPServer()
    console.log('Fetching STUDY-11144...')
    const issue = await server.getIssue('STUDY-11144')
    console.log(JSON.stringify({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      created: issue.fields.created,
      updated: issue.fields.updated,
      description: (issue.fields.description?.content?.[0]?.content?.[0]?.text || 'N/A').substring(0, 200)
    }, null, 2))
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

testFetch()
