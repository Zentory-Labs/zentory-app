import { createClient } from '@supabase/supabase-js';
import { setLeaderboard, setMarketsSignals } from '@/lib/cache';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const HEARTBEAT_INTERVAL_HOURS = 5;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const KEEPER_ADDRESS = process.env.KEEPER_ADDRESS?.toLowerCase();
  if (!KEEPER_ADDRESS) {
    return Response.json({ error: 'KEEPER_ADDRESS not configured' }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log(`[${new Date().toISOString()}] [heartbeat cron] Checking keeper ${KEEPER_ADDRESS}...`);

  const { data: keepers, error } = await supabase
    .from('keeper_heartbeats')
    .select('*')
    .eq('keeper_address', KEEPER_ADDRESS)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Supabase error:', error);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }

  const lastHeartbeat = keepers?.[0];

  if (!lastHeartbeat) {
    console.warn('No heartbeat record found. Keeper may not be registered.');
    await supabase.from('keeper_heartbeats').insert({
      keeper_address: KEEPER_ADDRESS,
      status: 'missed_heartbeat',
      missed_heartbeats: 1,
    });
    await sendAlert('Keeper not registered — no heartbeat record found');
    return Response.json({ status: 'no_record', alertSent: true }, { status: 200 });
  }

  const lastSeen = new Date(lastHeartbeat.last_heartbeat);
  const hoursSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);

  if (hoursSince > HEARTBEAT_INTERVAL_HOURS) {
    const missedCount = (lastHeartbeat.missed_heartbeats ?? 0) + 1;
    const newStatus = missedCount >= 3 ? 'failed' : 'missed_heartbeat';

    await supabase
      .from('keeper_heartbeats')
      .update({
        status: newStatus,
        missed_heartbeats: missedCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lastHeartbeat.id);

    const alertMsg =
      missedCount >= 3
        ? `CRITICAL: Keeper failed! Missed ${missedCount} consecutive heartbeats. Last epoch settled: ${lastHeartbeat.last_epoch_settled}. Immediate intervention required.`
        : `Keeper missed heartbeat #${missedCount}. Last seen ${hoursSince.toFixed(1)} hours ago.`;

    await sendAlert(alertMsg);
    return Response.json({ status: newStatus, missedCount, alertSent: true }, { status: 200 });
  }

  // Healthy — mark recovered if it was previously missed
  if (lastHeartbeat.status !== 'active') {
    await supabase
      .from('keeper_heartbeats')
      .update({ status: 'recovered', updated_at: new Date().toISOString() })
      .eq('id', lastHeartbeat.id);
  }

  // Warm caches proactively on healthy heartbeat
  try {
    const { data: leaderboard } = await supabase
      .from('provider_stats')
      .select('provider, total_signals, resolved_signals, avg_accuracy_bps, total_payout_zent, current_rank, last_signal_at, zent_staked')
      .order('current_rank', { ascending: true })
      .limit(50);
    if (leaderboard) {
      await setLeaderboard({ providers: leaderboard, count: leaderboard.length });
    }
  } catch (e) {
    console.warn('[cache warm] leaderboard error:', e);
  }

  try {
    const { data: signals } = await supabase
      .from('signals')
      .select('id, provider, asset, direction, price, created_at')
      .order('created_at', { ascending: false })
      .limit(20);
    if (signals) {
      await setMarketsSignals({ signals, count: signals.length });
    }
  } catch (e) {
    console.warn('[cache warm] markets signals error:', e);
  }

  return Response.json({ status: 'ok', hoursSince: hoursSince.toFixed(1) }, { status: 200 });
}

async function sendAlert(message: string) {
  console.error(`[heartbeat cron] ALERT: ${message}`);

  if (DISCORD_WEBHOOK_URL) {
    try {
      await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `[ZENTORY KEEPER] ${message}`,
          components: [
            {
              type: 1,
              components: [
                {
                  type: 2,
                  style: 4,
                  label: 'View UptimeRobot',
                  url: 'https://uptimerobot.com/dashboard',
                },
              ],
            },
          ],
        }),
      });
    } catch (e) {
      console.error('Failed to send Discord alert:', e);
    }
  }
}
