#!/usr/bin/env node
import { request } from 'node:https';
import process from 'node:process';

const DEFAULT_REPO = 'ccctw-ma/GG-Fund';
const DEFAULT_WORKFLOW = 'cloudflare-deploy.yml';
const USER_AGENT = 'GG-Fund-deploy-check';

function usage() {
  console.log(`Usage:
  node scripts/github-actions.js list [--repo owner/repo] [--workflow workflow.yml] [--branch branch] [--limit 5]
  node scripts/github-actions.js watch <run-id> [--repo owner/repo] [--exit-status]
  node scripts/github-actions.js view <run-id> [--repo owner/repo] [--log-failed]

Set GH_TOKEN or GITHUB_TOKEN to avoid GitHub anonymous API rate limits.`);
}

function parseFlags(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const [rawKey, inlineValue] = arg.slice(2).split('=', 2);
    const key = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    if (inlineValue !== undefined) {
      flags[key] = inlineValue;
    } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
      flags[key] = argv[i + 1];
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return { flags, positionals };
}

function githubApi(pathname) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': USER_AGENT,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  return new Promise((resolve, reject) => {
    const req = request({ hostname: 'api.github.com', path: pathname, method: 'GET', headers }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if ((res.statusCode ?? 500) >= 400) {
          const reset = Number(res.headers['x-ratelimit-reset'] ?? 0);
          const resetText = reset ? new Date(reset * 1000).toISOString() : 'unknown';
          let message;
          try {
            message = JSON.parse(body).message ?? body;
          } catch {
            message = body;
          }
          reject(new Error(`GitHub API ${res.statusCode}: ${message}\nrate-limit remaining=${res.headers['x-ratelimit-remaining'] ?? 'unknown'}, reset=${resetText}\nSet GH_TOKEN or GITHUB_TOKEN for authenticated requests.`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('GitHub API request timed out')));
    req.end();
  });
}

function repoFromFlags(flags) {
  return flags.repo || DEFAULT_REPO;
}

function workflowFromFlags(flags) {
  return flags.workflow || DEFAULT_WORKFLOW;
}

async function listRuns(argv) {
  const { flags } = parseFlags(argv);
  const repo = repoFromFlags(flags);
  const workflow = workflowFromFlags(flags);
  const limit = Number(flags.limit || 5);
  const params = new URLSearchParams({ per_page: String(Math.min(Math.max(limit, 1), 100)) });
  if (flags.branch) params.set('branch', flags.branch);
  const data = await githubApi(`/repos/${repo}/actions/workflows/${encodeURIComponent(workflow)}/runs?${params}`);
  const runs = data.workflow_runs ?? [];
  if (!runs.length) {
    console.log('No workflow runs found.');
    return;
  }
  for (const run of runs.slice(0, limit)) {
    const state = run.conclusion ? `${run.status}/${run.conclusion}` : run.status;
    console.log(`${run.database_id ?? run.id}\t${state}\t${run.head_branch}\t${run.head_sha?.slice(0, 7)}\t${run.display_title || run.name}\t${run.html_url}`);
  }
}

async function getRun(repo, runId) {
  return githubApi(`/repos/${repo}/actions/runs/${runId}`);
}

async function watchRun(argv) {
  const { flags, positionals } = parseFlags(argv);
  const runId = positionals[0];
  if (!runId) throw new Error('Missing run id: watch <run-id>');
  const repo = repoFromFlags(flags);
  const exitStatus = Boolean(flags.exitStatus);
  let lastLine = '';
  while (true) {
    const run = await getRun(repo, runId);
    const line = `${run.database_id ?? run.id}\t${run.status}${run.conclusion ? `/${run.conclusion}` : ''}\t${run.head_sha?.slice(0, 7)}\t${run.html_url}`;
    if (line !== lastLine) {
      console.log(line);
      lastLine = line;
    }
    if (run.status === 'completed') {
      if (exitStatus && run.conclusion !== 'success') process.exit(1);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

async function viewRun(argv) {
  const { flags, positionals } = parseFlags(argv);
  const runId = positionals[0];
  if (!runId) throw new Error('Missing run id: view <run-id>');
  const repo = repoFromFlags(flags);
  const run = await getRun(repo, runId);
  console.log(`${run.name} #${run.run_number}`);
  console.log(`${run.status}${run.conclusion ? `/${run.conclusion}` : ''} ${run.html_url}`);
  if (!flags.logFailed) return;
  const jobs = await githubApi(`/repos/${repo}/actions/runs/${runId}/jobs?per_page=100`);
  for (const job of jobs.jobs ?? []) {
    if (job.conclusion === 'success' || job.conclusion === 'skipped') continue;
    console.log(`\n[${job.status}/${job.conclusion ?? 'pending'}] ${job.name}`);
    for (const step of job.steps ?? []) {
      if (step.conclusion && step.conclusion !== 'success' && step.conclusion !== 'skipped') {
        console.log(`  - ${step.name}: ${step.status}/${step.conclusion}`);
      }
    }
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }
  if (command === 'list') return listRuns(rest);
  if (command === 'watch') return watchRun(rest);
  if (command === 'view') return viewRun(rest);
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
