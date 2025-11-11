// EFFECT: Keeps the signin route responsive by streaming a CSS-only skeleton during navigation.
export default function SignInLoading() {
  return (
    <div className="min-h-screen grid place-items-center bg-neutral-950 text-white">
      <div className="w-[520px] max-w-[92vw] rounded-3xl bg-neutral-900/70 px-8 pb-10 pt-9 shadow-[0_0_120px_40px_rgba(118,0,255,0.2)] backdrop-blur">
        <div className="mb-8 space-y-4 text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-white/10" />
          <div className="mx-auto h-6 w-48 rounded-full bg-white/10" />
        </div>
        <div className="h-32 rounded-2xl border border-white/15 bg-white/5" />
      </div>
    </div>
  );
}
