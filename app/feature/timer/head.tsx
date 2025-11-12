// EFFECT: Preloads the flip countdown document so the iframe can paint sooner.
export default function TimerHead() {
  return (
    <>
      <link
        rel="preload"
        as="document"
        href="/timer/flip_countdown_new/index.html"
      />
    </>
  );
}
