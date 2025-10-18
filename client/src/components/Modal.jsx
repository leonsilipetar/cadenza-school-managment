import React, { useEffect } from 'react';
import { Icon } from '@iconify/react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '800px',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  isFormModal = false // If true, hides X button (form modals should have explicit Cancel/Save buttons)
}) => {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="popup modal-overlay"
      onClick={handleBackdropClick}
      style={{
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        className="div div-clmn modal-content"
        style={{
          maxWidth,
          animation: 'slideUp 0.3s ease-out',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || (showCloseButton && !isFormModal)) && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
            borderBottom: '1px solid rgba(var(--isticanje2), 0.3)',
            marginBottom: '1rem'
          }}>
            {title && (
              <h2 style={{
                margin: 0,
                fontSize: '1.5rem',
                color: 'rgb(var(--isticanje))',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {title}
              </h2>
            )}
            {showCloseButton && !isFormModal && (
              <button
                type="button"
                className="action-btn zatvoriBtn"
                onClick={onClose}
                style={{
                  padding: '0.5rem',
                  minWidth: 'auto',
                  marginLeft: '1rem'
                }}
                aria-label="Close modal"
              >
                <Icon icon="solar:close-circle-broken" fontSize="1.5rem" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div style={{
          padding: '0 1rem 1rem 1rem',
          overflowY: 'auto',
          maxHeight: 'calc(90vh - 140px)'

        }}>
          {children}
        </div>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes slideUp {
            from {
              transform: translateY(20px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }

          .modal-content .input-login-signup {
            margin: 0 0 0.5rem 0 !important;
            width: 100% !important;
          }

          .modal-content input[type="text"],
          .modal-content input[type="number"],
          .modal-content input[type="email"],
          .modal-content input[type="password"],
          .modal-content input[type="date"],
          .modal-content input[type="time"],
          .modal-content textarea,
          .modal-content select {
            margin: 0 0 0.5rem 0 !important;
          }

          .modal-content .div-radio {
            width: 100% !important;
            margin: 1.5rem 0 0 0 !important;
            padding: 1.5rem 0 0 0 !important;
            background-color: transparent !important;
            justify-content: center !important;
            gap: 1rem !important;
          }

          @media (max-width: 768px) {
            .modal-content {
              max-width: 95% !important;
              max-height: 95vh;
              margin: 0 auto;
            }
          }
        `}} />
      </div>
    </div>
  );
};

export default Modal;

