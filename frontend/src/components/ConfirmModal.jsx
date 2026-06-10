import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Confirmation modal component.
 * Props:
 *   - isOpen: boolean to control visibility
 *   - title: modal title string
 *   - description: modal body string
 *   - onConfirm: called when user confirms
 *   - onCancel: called when user cancels or clicks outside
 */
const ConfirmModal = ({ isOpen, title, description, onConfirm, onCancel }) => {
  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-200"
      style={{ background: 'rgba(0,0,0,0.6)', opacity: isOpen ? 1 : 0 }}
      onClick={onCancel}
    >
      {/* Stop propagation to avoid closing when clicking inside */}
      <div
        className="bg-[#0A111C] rounded-xl shadow-xl p-6 w-80 transform transition-transform duration-200"
        style={{
          background: 'linear-gradient(135deg, #0A111C 0%, #151F2B 100%)',
          border: '1px solid rgba(242,194,26,0.2)',
          transform: isOpen ? 'scale(1)' : 'scale(0.95)',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
      >
        <h2 id="confirm-modal-title" className="text-lg font-bold text-white mb-2">
          {title}
        </h2>
        <p id="confirm-modal-desc" className="text-sm text-gray-300 mb-4">
          {description}
        </p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-1 text-sm rounded bg-gray-700 text-gray-200 hover:bg-gray-600 transition"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-1 text-sm rounded bg-[#F2C21A] text-black hover:bg-[#e5b113] transition"
            onClick={onConfirm}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
};

export default ConfirmModal;
