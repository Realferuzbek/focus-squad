import { supabaseAdmin } from './supabaseServer';
const CHANNEL = 'focus_squad_updates';
export async function broadcast(event: string, payload: unknown) {
  const sb = supabaseAdmin();
  // Broadcast via Realtime - using Realtime 'broadcast' feature
  await sb.channel(CHANNEL).send({ type: 'broadcast', event, payload });
}
export const channelName = CHANNEL;
