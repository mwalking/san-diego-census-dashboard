import Modal from './Modal.jsx';
import { COPY } from '../ui/microcopy.js';

function DataSourcesModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} title={COPY.dataSourcesModal.title} onClose={onClose}>
      <div className="space-y-2">
        {COPY.dataSourcesModal.body.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </Modal>
  );
}

export default DataSourcesModal;
