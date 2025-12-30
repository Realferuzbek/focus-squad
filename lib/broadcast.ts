import { supabaseAdmin } from "./supabaseServer";
import { BROADCAST_CHANNEL_NAME } from "./broadcastChannel";

export async function broadcast(event: string, payload: unknown) {
  const sb = supabaseAdmin();
  // Broadcast via Realtime - using Realtime 'broadcast' feature
  await sb
    .channel(BROADCAST_CHANNEL_NAME)
    .send({ type: "broadcast", event, payload });
}
export const channelName = BROADCAST_CHANNEL_NAME;
