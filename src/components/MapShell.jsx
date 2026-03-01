import { COPY } from '../ui/microcopy.js';

function MapShell() {
  return (
    <section className="absolute inset-0">
      <div className="h-full w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="rounded-xl border border-slate-200/10 bg-slate-950/60 p-6 text-center text-slate-200">
          <p className="text-lg font-semibold">{COPY.map.placeholderTitle}</p>
          <p className="mt-2 text-sm text-slate-400">{COPY.map.placeholderSubtext}</p>
        </div>
      </div>
    </section>
  );
}

export default MapShell;
