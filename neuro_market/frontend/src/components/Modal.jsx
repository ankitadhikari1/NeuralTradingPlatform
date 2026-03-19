import React from 'react';

const Modal = ({ open, title, children, onClose, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', tone = 'primary' }) => {
  if (!open) return null;

  const confirmClass =
    tone === 'danger'
      ? 'btn-danger'
      : tone === 'secondary'
        ? 'btn-secondary'
        : 'btn-primary';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-[92vw] max-w-lg card p-6 border border-slate-700">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h3 className="text-xl font-bold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">×</button>
        </div>
        <div className="text-slate-200 text-sm leading-relaxed">{children}</div>
        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary bg-slate-700 hover:bg-slate-600">{cancelText}</button>
          <button onClick={onConfirm} className={confirmClass}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
