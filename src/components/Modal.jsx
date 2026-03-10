import { COPY } from '../ui/microcopy.js';

function Modal({ isOpen, title, onClose, children }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label={COPY.modal.close}
        className="absolute inset-0 bg-slate-950/80"
        onClick={onClose}
      />
      <section className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200/10 bg-slate-900 p-5 shadow-2xl">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
            onClick={onClose}
          >
            {COPY.modal.close}
          </button>
        </header>
        <div className="mt-3 max-h-[68vh] overflow-y-auto pr-1 text-sm text-slate-300">
          {children}
        </div>
      </section>
    </div>
  );
}

export default Modal;
