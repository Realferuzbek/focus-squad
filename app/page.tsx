import './globals.css';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <a href="/dashboard" className="btn-primary focus-ring">Go to Dashboard</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <img src="/logo.svg" alt="Focus Squad" className="w-12 h-12 opacity-80" />
      <h1 className="text-2xl font-bold">Focus Squad</h1>
      <p className="text-sm text-subtle">Study with Feruzbek — Escape distractions and stay consistent.</p>
      <a className="btn-primary focus-ring" href="/signin">Continue with Google</a>
    </div>
  );
}
