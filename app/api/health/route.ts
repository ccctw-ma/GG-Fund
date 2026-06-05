import { getCloudflareContext } from '@opennextjs/cloudflare';
import { json } from '../../../lib/http';

async function readAiStatus() {
  try {
    const context = await getCloudflareContext({ async: true });
    const cloudflareEnv = (context.env ?? {}) as { DEEPSEEK_API_KEY?: string };
    return cloudflareEnv.DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY ? 'deepseek-ready' : 'local-fallback';
  } catch {
    return process.env.DEEPSEEK_API_KEY ? 'deepseek-ready' : 'local-fallback';
  }
}

export async function GET() {
  return json({
    ok: true,
    service: 'gg-fund-next-api',
    runtime: 'edge',
    market: 'ready',
    portfolio: 'ready',
    ai: await readAiStatus(),
    auth: 'resend-email-otp',
  });
}
