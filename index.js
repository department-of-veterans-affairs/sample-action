const core = require('@actions/core')

const {Octokit} = require('@octokit/rest')
const {retry} = require('@octokit/plugin-retry')
const {throttling} = require('@octokit/plugin-throttling')

const _Octokit = Octokit.plugin(retry, throttling)
const client = new _Octokit({
    auth: core.getInput('token', {required: true, trimWhitespace: true}),
    baseUrl: process.env.GITHUB_API_URL,
    throttle: {
        onRateLimit: (retryAfter, options) => {
            core.warning(`Request quota exhausted for request ${options.method} ${options.url}`)
            if (options.request.retryCount <= 0) {
                return true
            }
        },
        onSecondaryRateLimit: (retryAfter, options, octokit) => {
            core.warning(`Secondary quota detected for request ${options.method} ${options.url}`);
        },
    }
})

async function commentOnIssue(org, repo, issueNumber, title, body) {
    await client.issues.createComment({
        owner: org,
        repo: repo,
        issue_number: issueNumber,
        title: title,
        body: body
    })
}

async function main() {
    const org = core.getInput('org', {required: true, trimWhitespace: true})
    const repo = core.getInput('repo', {required: true, trimWhitespace: true})
    const issueNumber = core.getInput('issue', {required: true, trimWhitespace: true})

    const {data: analysis} = await client.codeScanning.listRecentAnalyses({
        owner: org,
        repo: repo,
        tool_name: 'codeql',
        per_page: 1
    })

    const created_at = new Date(analysis[0].created_at)
    const now = new Date()
    const diff = now - created_at
    const days = diff / (1000 * 60 * 60 * 24)
    if (days > 7) {
        await commentOnIssue(org, repo, issueNumber, 'CodeQL analysis is out of date', `The last analysis was ${days} days ago`)
        return core.setFailed(`The last analysis was ${days} days ago`)
    }
    core.info(`The last analysis was ${days} days ago`)
}

main()