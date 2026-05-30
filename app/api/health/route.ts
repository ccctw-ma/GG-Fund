import { json } from '../../../lib/http';

export const runtime = 'edge';

export async function GET() {
  return json({
    ok: true,
    service: 'gg-fund-next-api',
    runtime: 'edge',
    market: 'ready',
    portfolio: 'ready',
    ai: 'ready',
    auth: 'supabase-foundation',
  });
}
