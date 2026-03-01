import Modal from './Modal.jsx';
import { COPY } from '../ui/microcopy.js';

function WelcomeModal({ isOpen, onDismiss }) {
  return (
    <Modal isOpen={isOpen} title={COPY.welcomeModal.title} onClose={onDismiss}>
      <ul className="space-y-2">
        {COPY.welcomeModal.body.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className="mt-4">
        <button
          type="button"
          className="rounded-md bg-emerald-400 px-3 py-2 text-sm font-semibold text-slate-900"
          onClick={onDismiss}
        >
          {COPY.welcomeModal.dismiss}
        </button>
      </div>
    </Modal>
  );
}

export default WelcomeModal;
