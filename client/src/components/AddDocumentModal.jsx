import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import Modal from './Modal';

const AddDocumentModal = ({ onAdd, onCancel, currentFolder }) => {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim() || !url.trim()) {
      return;
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (error) {
      alert('Molimo unesite valjan URL (npr. https://example.com)');
      return;
    }

    setIsSubmitting(true);

    try {
      const documentData = {
        name: name.trim(),
        type: 'url',
        content: url.trim(),
        isPublic,
        parentId: currentFolder || null
      };
      await onAdd(documentData);
    } catch (error) {
      console.error('Error adding document:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={
        <>
          <Icon icon="solar:link-circle-broken" />
          Dodaj novu poveznicu
        </>
      }
      maxWidth="600px"
      isFormModal={true}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Info Message */}
        <div style={{
          padding: '1rem',
          background: 'rgba(var(--isticanje), 0.1)',
          border: '1px solid rgba(var(--isticanje), 0.3)',
          borderRadius: 'var(--radius)',
          fontSize: '0.9rem'
        }}>
          <Icon icon="solar:info-circle-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          Dodajte poveznicu na vanjske datoteke (Google Drive, Dropbox, YouTube, itd.) i podijelite ih s drugima.
        </div>

        {/* Name Field */}
        <div>
          <label htmlFor="doc-name" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
            Naziv <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="doc-name"
            type="text"
            className="input-login-signup"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Unesite naziv dokumenta"
            required
            style={{ width: '100%' }}
          />
        </div>

        {/* URL Field */}
        <div>
          <label htmlFor="doc-url" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
            URL <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            id="doc-url"
            type="url"
            className="input-login-signup"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/document"
            required
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
            Unesite puni URL sa https://
          </div>
        </div>

        {/* Public/Private Toggle */}
        <div>
          <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Vidljivost
          </label>
          <div
            onClick={() => setIsPublic(!isPublic)}
            style={{
              padding: '1rem',
              border: `2px solid ${isPublic ? 'rgb(var(--isticanje))' : 'rgba(var(--isticanje2), 0.3)'}`,
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              background: isPublic ? 'rgba(var(--isticanje), 0.1)' : 'transparent',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <Icon
              icon={isPublic ? "solar:global-broken" : "solar:lock-keyhole-minimalistic-linear"}
              style={{ fontSize: '1.5rem', color: isPublic ? 'rgb(var(--isticanje))' : 'var(--tekst)' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                {isPublic ? 'Javno dostupno' : 'Privatno'}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                {isPublic
                  ? 'Svi korisnici mogu vidjeti ovaj dokument'
                  : 'Samo vi i osobe s kojima podijelite mogu vidjeti ovaj dokument'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="div-radio">
          <button
            type="button"
            className="gumb action-btn zatvoriBtn"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <Icon icon="solar:close-circle-broken" /> Odustani
          </button>
          <button
            type="submit"
            className="gumb action-btn spremiBtn"
            disabled={isSubmitting}
          >
            <Icon icon={isSubmitting ? "solar:loading-bold-duotone" : "solar:add-circle-broken"} className={isSubmitting ? "spin" : ""} />
            {isSubmitting ? 'Dodavanje...' : 'Dodaj poveznicu'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddDocumentModal;