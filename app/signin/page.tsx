'use client';
import { signIn } from 'next-auth/react';

export default function SignIn() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <img src="/logo.svg" alt="Focus Squad" className="w-12 h-12" />
      <h1 className="text-xl font-bold">Continue with Google</h1>
      <button
        className="btn-primary focus-ring"
        aria-label="Continue with Google"
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
      >
        Continue with Google
      </button>
      <p className="text-xs text-subtle max-w-sm text-center">
        We only support Google sign-in. Your session persists, and you’ll auto-return to the dashboard on revisit.
      </p>
    </div>
  );
}
