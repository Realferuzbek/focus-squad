'use client';
import { signIn } from 'next-auth/react';

export default function SignIn() {
  return (
    <div className="min-h-[60vh] grid place-items-center">
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white"
      >
        Continue with Google
      </button>
    </div>
  );
}
