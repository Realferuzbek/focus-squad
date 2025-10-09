// app/signin/page.tsx
import Image from "next/image";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function SignInPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-white">
      <div className="w-[520px] max-w-[92vw] rounded-3xl bg-neutral-900/70 px-8 pb-10 pt-9 shadow-[0_0_120px_40px_rgba(118,0,255,0.2)] backdrop-blur">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600/70 via-purple-500/70 to-fuchsia-500/80">
            <Image src="/logo.svg" alt="logo" width={28} height={28} priority />
          </div>
          <h1 className="text-2xl font-extrabold uppercase tracking-[0.22em]">
            Study With Feruzbek
          </h1>
        </div>

        <GoogleSignInButton callbackUrl="/dashboard" />

        <p className="mt-4 text-center text-sm text-neutral-300">
          We only support Google sign-in. You’ll be redirected back to your dashboard.
        </p>
      </div>
    </div>
  );
}
