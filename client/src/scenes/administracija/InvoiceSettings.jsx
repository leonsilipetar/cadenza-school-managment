import React, { useState, useEffect } from 'react';
import ApiConfig from '../../components/apiConfig';
import { Icon } from '@iconify/react';
import Notifikacija from '../../components/Notifikacija';

const InvoiceSettings = ({ onClose, onSave, currentSettings }) => {
  const [formData, setFormData] = useState({
    nazivObrta: '',
    oib: '',
    iban: '',
    brojRacuna: '',
    dodatneInformacije: '',
    adresa: {
      ulica: '',
      kucniBroj: '',
      mjesto: '',
      postanskiBroj: ''
    }
  });
  const [notification, setNotification] = useState(null);
  const [metadata, setMetadata] = useState({
    createdAt: null,
    updatedAt: null
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        console.log('Fetching invoice settings...');
        const response = await ApiConfig.api.get('/api/invoice-settings');
        console.log('Response:', response.data);
        if (response.data) {
          // Split the address into components
          const [ulica, kucniBroj] = (response.data.address || '').split(/(?<=\D)\s*(\d.*)/).filter(Boolean);

          setFormData(prevData => ({
            ...prevData,
            ...response.data,
            adresa: {
              ulica: ulica || '',
              kucniBroj: kucniBroj || '',
              mjesto: response.data.city || '',
              postanskiBroj: response.data.postalCode || ''
            }
          }));
          
          setMetadata({
            createdAt: response.data.createdAt,
            updatedAt: response.data.updatedAt
          });
        }
      } catch (err) {
        console.error('Full error:', err);
        console.error('Error fetching invoice settings:', err);
        setNotification({
          type: 'error',
          message: `Greška pri dohvaćanju postavki računa: ${err.response?.data?.error || err.message}`
        });
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setNotification(null);

    // Format OIB and IBAN before sending
    const formattedData = {
      ...formData,
      oib: formData.oib.replace(/[^0-9]/g, '').slice(0, 11),
      iban: formData.iban.replace(/\s/g, '').slice(0, 22),
      // Transform address components back to the format expected by the server
      address: `${formData.adresa.ulica} ${formData.adresa.kucniBroj}`,
      city: formData.adresa.mjesto,
      postalCode: formData.adresa.postanskiBroj,
      // Remove the nested adresa object as we're sending flattened data
      adresa: undefined
    };

    try {
      const response = await ApiConfig.api.post('/api/invoice-settings', formattedData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data) {
        onSave(response.data);
        setNotification({
          type: 'success',
          message: 'Postavke računa uspješno spremljene'
        });
      }
    } catch (err) {
      console.error('Error saving invoice settings:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.details?.[0] || err.response?.data?.error || 'Greška pri spremanju postavki računa'
      });
    }
  };

  return (
    <div className="popup">
      <div className="div div-clmn" style={{ maxWidth: '800px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '1rem',
          borderBottom: '1px solid rgba(var(--isticanje2), 0.3)',
          marginBottom: '1rem'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'rgb(var(--isticanje))' }}>
            <Icon icon="solar:document-text-broken" style={{ marginRight: '0.5rem' }} />
            Postavke računa
          </h2>
          <button
            type="button"
            className="action-btn zatvoriBtn"
            onClick={onClose}
            style={{ padding: '0.5rem', minWidth: 'auto' }}
          >
            <Icon icon="solar:close-circle-broken" fontSize="1.5rem" />
          </button>
        </div>

        {/* Metadata section */}
        {(metadata.createdAt || metadata.updatedAt) && (
          <div style={{
            display: 'flex',
            gap: '1rem',
            padding: '0.75rem 1rem',
            background: 'rgba(var(--isticanje2), 0.1)',
            borderRadius: 'var(--radius)',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            flexWrap: 'wrap'
          }}>
            {metadata.createdAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon icon="solar:calendar-add-broken" style={{ color: 'rgb(var(--isticanje))' }} />
                <span style={{ opacity: 0.8 }}>Kreirano:</span>
                <strong>{new Date(metadata.createdAt).toLocaleDateString('hr-HR', { 
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}</strong>
              </div>
            )}
            {metadata.updatedAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Icon icon="solar:calendar-mark-broken" style={{ color: 'rgb(var(--isticanje))' }} />
                <span style={{ opacity: 0.8 }}>Ažurirano:</span>
                <strong>{new Date(metadata.updatedAt).toLocaleDateString('hr-HR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}</strong>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '0 1rem' }}>
          {/* Basic Information Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:buildings-2-broken" style={{ marginRight: '0.5rem' }} />
              Osnovni podaci
            </h3>
            
            <div className="div-clmn" style={{ gap: '0.75rem' }}>
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Naziv obrta <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  className="input-login-signup"
                  type="text"
                  value={formData.nazivObrta}
                  onChange={(e) => setFormData({ ...formData, nazivObrta: e.target.value })}
                  required
                  placeholder="Npr. Glazbena škola MAI"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    OIB <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    value={formData.oib}
                    onChange={(e) => setFormData({ ...formData, oib: e.target.value })}
                    required
                    placeholder="11 znamenki"
                    maxLength={11}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    IBAN <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    value={formData.iban}
                    onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
                    required
                    placeholder="HR..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:map-point-broken" style={{ marginRight: '0.5rem' }} />
              Adresa
            </h3>
            
            <div className="div-clmn" style={{ gap: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Ulica <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    value={formData.adresa.ulica}
                    onChange={(e) => setFormData({
                      ...formData,
                      adresa: { ...formData.adresa, ulica: e.target.value }
                    })}
                    required
                    placeholder="Naziv ulice"
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Broj <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    value={formData.adresa.kucniBroj}
                    onChange={(e) => setFormData({
                      ...formData,
                      adresa: { ...formData.adresa, kucniBroj: e.target.value }
                    })}
                    required
                    placeholder="Broj"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Mjesto <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    value={formData.adresa.mjesto}
                    onChange={(e) => setFormData({
                      ...formData,
                      adresa: { ...formData.adresa, mjesto: e.target.value }
                    })}
                    required
                    placeholder="Grad/Mjesto"
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Poštanski broj <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    value={formData.adresa.postanskiBroj}
                    onChange={(e) => setFormData({
                      ...formData,
                      adresa: { ...formData.adresa, postanskiBroj: e.target.value }
                    })}
                    required
                    placeholder="12345"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information Section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ 
              fontSize: '1rem', 
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:notes-broken" style={{ marginRight: '0.5rem' }} />
              Dodatne informacije
            </h3>
            
            <textarea
              className="input-login-signup"
              value={formData.dodatneInformacije}
              onChange={(e) => setFormData({ ...formData, dodatneInformacije: e.target.value })}
              rows={4}
              placeholder="Npr. Način plaćanja, rok plaćanja, napomene..."
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          {/* Action Buttons */}
          <div className="div-radio" style={{ 
            marginTop: '2rem',
            paddingTop: '1rem',
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
              <Icon icon="solar:disk-broken" /> Spremi postavke
            </button>
          </div>
        </form>

        {notification && (
          <Notifikacija
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .popup form div[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
          .popup form div[style*="display: flex"] {
            flex-direction: column !important;
          }
          .popup form input,
          .popup form textarea,
          .popup form select {
            width: 100% !important;
            box-sizing: border-box;
          }
        }
      `}} />
    </div>
  );
};

export default InvoiceSettings;