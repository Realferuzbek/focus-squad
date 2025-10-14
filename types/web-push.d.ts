declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };

  export type SendOptions = {
    TTL?: number;
    timeout?: number;
    headers?: Record<string, string>;
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
  };

  export function setVapidDetails(
    subject: string,
    publicKey: string,
    privateKey: string,
  ): void;

  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | Uint8Array,
    options?: SendOptions,
  ): Promise<void>;

  const webPush: {
    setVapidDetails: typeof setVapidDetails;
    sendNotification: typeof sendNotification;
  };

  export default webPush;
}
