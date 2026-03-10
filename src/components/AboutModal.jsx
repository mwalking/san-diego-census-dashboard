import Modal from './Modal.jsx';
import { COPY } from '../ui/microcopy.js';

function AboutModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} title={COPY.aboutModal.title} onClose={onClose}>
      <div className="space-y-2">
        {COPY.aboutModal.body.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </Modal>
  );
}

export default AboutModal;
