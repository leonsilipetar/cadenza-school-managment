import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import ApiConfig from '../../components/apiConfig';
import Notification from '../../components/Notifikacija';
import Modal from '../../components/Modal';

const ProgramDetalji = ({ program, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    naziv: '',
    tipovi: {
      grupno: '',
      individualno1: '',
      individualno2: '',
      none: ''
    },
    showInSignup: true
  });
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (program) {
      const transformedTipovi = {};
      if (Array.isArray(program.tipovi)) {
        program.tipovi.forEach(({ tip, cijena }) => {
          transformedTipovi[tip] = cijena.toString();
        });
      }

      setFormData({
        naziv: program.naziv,
        tipovi: {
          grupno: transformedTipovi.grupno || '',
          individualno1: transformedTipovi.individualno1 || '',
          individualno2: transformedTipovi.individualno2 || '',
          none: transformedTipovi.none || ''
        },
        showInSignup: typeof program.showInSignup === 'boolean' ? program.showInSignup : true
      });
    }
  }, [program]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const transformedData = {
        naziv: formData.naziv,
        tipovi: Object.entries(formData.tipovi)
          .filter(([_, cijena]) => cijena !== '' && parseFloat(cijena) > 0)
          .map(([tip, cijena]) => ({
            tip,
            cijena: parseFloat(cijena)
          })),
        showInSignup: !!formData.showInSignup
      };

      const response = await ApiConfig.api.put(
        `/api/programs/${program.id}`,
        transformedData
      );

      setNotification({
        type: 'success',
        message: 'Program uspješno ažuriran!'
      });

      setTimeout(() => {
        onUpdate(response.data);
      }, 1500);
    } catch (err) {
      console.error('Error updating program:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Greška pri ažuriranju programa'
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
      onClose={onClose}
      title={
        <>
          <Icon icon="solar:pen-broken" />
          Uredi program
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
              value={formData.naziv}
              onChange={(e) => setFormData({ ...formData, naziv: e.target.value })}
              required
              placeholder="Npr. Gitara"
              style={{ width: '100%' }}
            />
          </div>

          {/* Show in signup toggle */}
          <div style={{
            background: 'rgba(var(--isticanje2), 0.1)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                <Icon icon="solar:eye-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                Vidljivost programa
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                Prikaži program u formi za prijavu novih učenika
              </div>
            </div>
            <div
              className={`checkbox-item ${formData.showInSignup ? 'checked' : ''}`}
              onClick={() => setFormData(prev => ({ ...prev, showInSignup: !prev.showInSignup }))}
              style={{ margin: 0, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={formData.showInSignup}
                onChange={() => setFormData(prev => ({ ...prev, showInSignup: !prev.showInSignup }))}
                style={{ display: 'none' }}
              />
              {formData.showInSignup ? '✓ Prikazano' : '✗ Sakriveno'}
            </div>
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
              onClick={onClose}
            >
              <Icon icon="solar:close-circle-broken" /> Odustani
            </button>
            <button
              type="submit"
              className="gumb action-btn spremiBtn"
            >
              <Icon icon="solar:disk-broken" /> Spremi promjene
            </button>
          </div>
        </div>
      </form>

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
        />
      )}
    </Modal>
  );
};

export default ProgramDetalji;