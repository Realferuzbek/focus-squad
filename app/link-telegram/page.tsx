// app/link-telegram/page.tsx
import LinkTelegram from '@/components/LinkTelegram';

export default function LinkTelegramPage() {
  return (
    <div className="max-w-2xl mx-auto py-16 space-y-6">
      <h1 className="text-2xl font-semibold">Almost there — link your Telegram</h1>
      <p>We use Telegram for announcements and live sessions. Tap the button below to connect your account.</p>
      <LinkTelegram />
      <p className="text-sm opacity-70">After linking, press “Open dashboard” in Telegram or just return here.</p>
    </div>
  );
}
