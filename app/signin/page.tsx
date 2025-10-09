// app/signin/page.tsx
import Image from "next/image";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default function SignInPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-white">
      <div className="w-[520px] max-w-[92vw] rounded-3xl bg-neutral-900/60 p-8 shadow-[0_0_120px_40px_rgba(118,0,255,0.15)]">
        <div className="flex items-center gap-3 mb-6">
          <Image src="/logo.svg" alt="logo" width={28} height={28} priority />
          <h1 className="text-2xl font-semibold">Studywithferuzbek</h1>
        </div>

        <GoogleSignInButton className="btn-primary w-full" callbackUrl="/dashboard" />

        <p className="mt-4 text-center text-sm text-neutral-300">
          We only support Google sign-in. You’ll be redirected back
          to your dashboard.
        </p>
      </div>
    </div>
  );
}
