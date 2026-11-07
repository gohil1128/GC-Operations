// Route-level skeleton. Navigation previously froze the old page with no
// feedback while the server rendered; this gives the shell shape immediately.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] animate-pulse px-4 pb-10 pt-5 sm:px-6 lg:px-8">
      <div className="h-3 w-40 rounded-full bg-muted" />
      <div className="mt-3 h-8 w-64 rounded-full bg-muted" />
      <div className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-3.5 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[86px] rounded-bento border border-border bg-card" />
        ))}
      </div>
      <div className="mt-4 h-[420px] rounded-bento border border-border bg-card" />
      <span className="sr-only" role="status">Loading…</span>
    </div>
  );
}
