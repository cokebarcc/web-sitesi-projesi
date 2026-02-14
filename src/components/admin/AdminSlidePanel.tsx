import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface AdminSlidePanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const AdminSlidePanel: React.FC<AdminSlidePanelProps> = ({ title, onClose, children, footer }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Trigger open animation after mount
    requestAnimationFrame(() => setIsOpen(true));

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  return ReactDOM.createPortal(
    <div className="admin-module">
      <div
        className={`a-slide-overlay ${isOpen ? 'a-slide-overlay--visible' : ''}`}
        onClick={handleClose}
      />
      <div className={`a-slide-panel ${isOpen ? 'a-slide-panel--open' : ''}`}>
        <div className="a-slide-header">
          <h2 className="a-slide-title">{title}</h2>
          <button className="a-slide-close" onClick={handleClose}>&times;</button>
        </div>
        {children}
        {footer && (
          <div className="a-slide-footer">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AdminSlidePanel;
