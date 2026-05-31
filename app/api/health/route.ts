import { json } from '../../../lib/http';


export async function GET() {
  return json({
    ok: true,
    service: 'gg-fund-next-api',
    runtime: 'edge',
    market: 'ready',
    portfolio: 'ready',
    ai: 'ready',
    auth: 'resend-email-otp',
  });
}
