import Modal from './Modal.jsx';
import { COPY } from '../ui/microcopy.js';

function DataSourcesModal({ isOpen, onClose }) {
  const sections = Array.isArray(COPY.dataSourcesModal.sections)
    ? COPY.dataSourcesModal.sections
    : [];
  const fallbackBody = Array.isArray(COPY.dataSourcesModal.body) ? COPY.dataSourcesModal.body : [];

  return (
    <Modal isOpen={isOpen} title={COPY.dataSourcesModal.title} onClose={onClose}>
      {sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map((section) => (
            <section key={section.id ?? section.heading} className="space-y-2">
              {section.heading ? (
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {section.heading}
                </h3>
              ) : null}
              {Array.isArray(section.paragraphs)
                ? section.paragraphs.map((item) => <p key={item}>{item}</p>)
                : null}
              {Array.isArray(section.bullets) && section.bullets.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-slate-300">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {fallbackBody.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default DataSourcesModal;
