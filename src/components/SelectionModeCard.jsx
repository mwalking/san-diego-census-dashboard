import { COPY } from '../ui/microcopy.js';

function SelectionModeCard({ selectionMode, onSelectionModeChange }) {
  return (
    <section className="w-full rounded-xl border border-slate-200/10 bg-slate-900/85 p-4 shadow-xl backdrop-blur">
      <h2 className="text-sm font-semibold text-slate-100">{COPY.selectionMode.title}</h2>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-800/70 p-1">
        {COPY.selectionMode.options.map((option) => {
          const isActive = selectionMode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`rounded-md px-3 py-2 text-sm transition ${
                isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:bg-slate-700'
              }`}
              onClick={() => onSelectionModeChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-300">{COPY.selectionMode.helperText[selectionMode]}</p>
    </section>
  );
}

export default SelectionModeCard;
