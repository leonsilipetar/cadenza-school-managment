import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import ApiConfig from '../../components/apiConfig';
import Notifikacija from '../../components/Notifikacija';
import Modal from '../../components/Modal';

const DodajProgram = ({ onDodajProgram, onCancel, user }) => {
  const [formData, setFormData] = useState({
    naziv: '',
    tipovi: {
      grupno: '',
      individualno1: '',
      individualno2: '',
      none: ''
    }
  });
  const [notification, setNotification] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Transform data for API and include school
      const transformedData = {
        naziv: formData.naziv,
        tipovi: Object.entries(formData.tipovi)
          .filter(([_, cijena]) => cijena !== '' && parseFloat(cijena) > 0)
          .map(([tip, cijena]) => ({
            tip,
            cijena: parseFloat(cijena)
          })),
        schoolId: user.schoolId // Add school ID from user
      };

      await ApiConfig.api.post('/api/programs', transformedData);

      setNotification({
        type: 'success',
        message: 'Program uspješno dodan!'
      });

      setTimeout(() => {
        onDodajProgram();
      }, 1500);
    } catch (err) {
      console.error('Error adding program:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Greška pri dodavanju programa'
      });
    }
  };

  const handlePriceChange = (type, value) => {
    setFormData(prev => ({
      ...prev,
      tipovi: {
        ...prev.tipovi,
        [type]: value
      }
    }));
  };

  return (
    <Modal 
      isOpen={true} 
      onClose={onCancel} 
      title={
        <>
          <Icon icon="solar:add-circle-broken" />
          Dodaj novi program
        </>
      }
      maxWidth="600px"
      isFormModal={true}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Naziv programa */}
          <div>
            <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
              Naziv programa <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              className="input-login-signup"
              type="text"
              id='prog-Ime'
              value={formData.naziv}
              onChange={(e) => setFormData({ ...formData, naziv: e.target.value })}
              required
              placeholder="Npr. Gitara"
              style={{ width: '100%' }}
            />
          </div>

          {/* Price section */}
          <div style={{ 
            background: 'rgba(var(--isticanje2), 0.1)', 
            padding: '1rem', 
            borderRadius: 'var(--radius)',
            marginTop: '0.5rem'
          }}>
            <h3 style={{ 
              fontSize: '1rem', 
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Icon icon="solar:euro-broken" />
              Cijene po tipu programa
            </h3>
            <div style={{ fontSize: '0.85rem', opacity: 0.8, marginBottom: '1rem' }}>
              Unesite cijene samo za tipove programa koje želite omogućiti. Ostavite prazno za tipove koje ne nudite.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Grupno */}
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Grupno (€)
                </label>
                <input
                  className="input-login-signup"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tipovi.grupno}
                  onChange={(e) => handlePriceChange('grupno', e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Individualno 1x */}
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Individualno 1x tjedno (€)
                </label>
                <input
                  className="input-login-signup"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tipovi.individualno1}
                  onChange={(e) => handlePriceChange('individualno1', e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Individualno 2x */}
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Individualno 2x tjedno (€)
                </label>
                <input
                  className="input-login-signup"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tipovi.individualno2}
                  onChange={(e) => handlePriceChange('individualno2', e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%' }}
                />
              </div>

              {/* Poseban program */}
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Poseban program (€)
                </label>
                <input
                  className="input-login-signup"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tipovi.none}
                  onChange={(e) => handlePriceChange('none', e.target.value)}
                  placeholder="0.00"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="div-radio" style={{ 
            borderTop: '1px solid rgba(var(--isticanje2), 0.3)'
          }}>
            <button 
              type="button" 
              className="gumb action-btn zatvoriBtn" 
              onClick={onCancel}
            >
              <Icon icon="solar:close-circle-broken" /> Odustani
            </button>
            <button 
              type="submit" 
              className="gumb action-btn spremiBtn"
            >
              <Icon icon="solar:add-circle-broken" /> Dodaj program
            </button>
          </div>
        </div>
      </form>

      {notification && (
        <Notifikacija
          type={notification.type}
          message={notification.message}
        />
      )}
    </Modal>
  );
};

export default DodajProgram;
