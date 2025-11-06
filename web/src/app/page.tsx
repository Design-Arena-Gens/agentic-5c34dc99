import Dashboard from "@/components/dashboard";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-violet-950 via-slate-950 to-slate-900">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 pb-8 pt-16 sm:px-10 sm:pt-24 lg:px-12 lg:pt-28">
          <div className="max-w-3xl">
            <span className="mb-4 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-slate-200/80 backdrop-blur">
              Instagram Intelligence
            </span>
            <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Compare Instagram accounts in seconds.
            </h1>
            <p className="mt-4 text-lg text-slate-200/80 sm:text-xl">
              Paste one or more handles and instantly pull public follower,
              engagement, and content performance metrics into a sortable
              dashboard.
            </p>
          </div>
          <div>
            <Dashboard />
          </div>
        </div>
      </section>
    </main>
  );
}
