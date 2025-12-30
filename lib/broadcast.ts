import { supabaseAdmin } from "./supabaseServer";
import { BROADCAST_CHANNEL_NAME } from "./broadcastChannel";

export async function broadcast(event: string, payload: unknown) {
  const sb = supabaseAdmin();
  // Broadcast via Realtime - using Realtime 'broadcast' feature
  const channel = sb.channel(BROADCAST_CHANNEL_NAME);
  try {
    await channel.httpSend(event, payload);
  } finally {
    sb.removeChannel(channel);
  }
}
export const channelName = BROADCAST_CHANNEL_NAME;
