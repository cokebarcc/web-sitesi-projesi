import React from 'react';

interface AdminToastProps {
  notification: { type: 'success' | 'error' | 'info'; message: string } | null;
  onDismiss: () => void;
}

const AdminToast: React.FC<AdminToastProps> = ({ notification, onDismiss }) => {
  if (!notification) return null;

  const icons: Record<string, string> = {
    success: '\u2713',
    error: '\u2717',
    info: '\u2139',
  };

  return (
    <div className="a-toast-container">
      <div className={`a-toast a-toast--${notification.type}`}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[notification.type]}</span>
        <span style={{ flex: 1 }}>{notification.message}</span>
        <button className="a-toast-dismiss" onClick={onDismiss}>&times;</button>
      </div>
    </div>
  );
};

export default AdminToast;
