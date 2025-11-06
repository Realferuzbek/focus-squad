import type { Metadata } from 'next';

const TIMER_APP_SRC = '/timer/flip_countdown_new/index.html';

export const metadata: Metadata = {
  title: 'Timer',
  description: 'Focus Squad timer with Pomodoro, short, and long break modes.',
};

export default function TimerFeaturePage() {
  return (
    <main className="bg-[#07070b]">
      <iframe
        src={TIMER_APP_SRC}
        title="Focus Squad Timer"
        className="block h-[100dvh] w-full border-0"
        loading="eager"
      />
    </main>
  );
}
