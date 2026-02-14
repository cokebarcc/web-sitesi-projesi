import React from 'react';

interface AdminConfirmDialogProps {
  title: string;
  message: string;
  variant: 'danger' | 'warning' | 'info';
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const AdminConfirmDialog: React.FC<AdminConfirmDialogProps> = ({
  title,
  message,
  variant,
  confirmLabel,
  onConfirm,
  onCancel,
}) => {
  const icons: Record<string, string> = {
    danger: '\u26A0',
    warning: '\u26A0',
    info: '\u2139',
  };

  const confirmBtnClass = variant === 'danger' ? 'a-btn a-btn-danger' : variant === 'warning' ? 'a-btn a-btn-cyan' : 'a-btn a-btn-primary';

  return (
    <div className="a-confirm-overlay" onClick={onCancel}>
      <div className="a-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className={`a-confirm-icon a-confirm-icon--${variant}`}>
          {icons[variant]}
        </div>
        <div className="a-confirm-title">{title}</div>
        <div className="a-confirm-message">{message}</div>
        <div className="a-confirm-actions">
          <button className="a-btn a-btn-secondary" onClick={onCancel}>
            Iptal
          </button>
          <button className={confirmBtnClass} onClick={onConfirm}>
            {confirmLabel || 'Onayla'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminConfirmDialog;
