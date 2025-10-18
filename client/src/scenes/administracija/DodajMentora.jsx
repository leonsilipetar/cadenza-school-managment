import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import ApiConfig from '../../components/apiConfig';
import Notifikacija from '../../components/Notifikacija';
import Modal from '../../components/Modal';

const DodajMentora = ({ onDodajKorisnika, onCancel }) => {
  const [schools, setSchools] = useState([]);
  const [isDodajMentoraDisabled, setIsDodajMentoraDisabled] = useState(false);
  const [notification, setNotification] = useState(null);
  const [inputs, setInputs] = useState({
    korisnickoIme: '',
    email: '',
    ime: '',
    prezime: '',
    isAdmin: false,
    isMentor: true,
    isStudent: false,
    oib: '',
    program: '',
    brojMobitela: '',
    datumRodjenja: '',
    adresa: {
      ulica: '',
      kucniBroj: '',
      mjesto: '',
    },
    napomene: '',
    students: [],
    school: '',
  });

  const handleChange = (e) => {
    setInputs((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const dodajMentora = async () => {
    try {
      const res = await ApiConfig.api.post('/api/signup-mentori', {
        ...inputs,
        napomene: inputs.napomene ? [inputs.napomene] : []
      });
      return res.data;
    } catch (err) {
      console.error('Error adding mentor:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Greška pri dodavanju mentora'
      });
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsDodajMentoraDisabled(true);
    const result = await dodajMentora();

    if (result) {
      setNotification({
        type: 'success',
        message: 'Mentor je uspješno dodan!'
      });
      if (typeof onDodajKorisnika === 'function') {
        onDodajKorisnika();
      }
    } else {
      setTimeout(() => {
        setIsDodajMentoraDisabled(false);
      }, 3000);
    }
  };

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const res = await ApiConfig.api.get('/api/schools');
        setSchools(res.data);
      } catch (err) {
        console.error('Error fetching schools:', err);
        setNotification({
          type: 'error',
          message: 'Greška pri dohvaćanju škola'
        });
      }
    };

    fetchSchools();
  }, []);

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={
        <>
          <Icon icon="solar:user-speak-broken" />
          Dodaj novog mentora
        </>
      }
      maxWidth="900px"
      isFormModal={true}
    >
      <form onSubmit={handleSubmit}>
        <style>{`
          @media (max-width: 768px) {
            .dodaj-mentora-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Basic Information Section */}
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:user-id-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Osnovni podaci
            </h3>

            <div className="dodaj-mentora-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="kor-Korime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Korisničko ime <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.korisnickoIme}
                  onChange={handleChange}
                  type="text"
                  name="korisnickoIme"
                  id="kor-Korime"
                  placeholder="Unesite korisničko ime"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="kor-email" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Email <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.email}
                  onChange={handleChange}
                  type="email"
                  name="email"
                  id="kor-email"
                  placeholder="ime@primjer.hr"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="kor-ime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Ime <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.ime}
                  onChange={handleChange}
                  type="text"
                  name="ime"
                  id="kor-ime"
                  placeholder="Unesite ime"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="kor-prezime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Prezime <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.prezime}
                  onChange={handleChange}
                  type="text"
                  name="prezime"
                  id="kor-prezime"
                  placeholder="Unesite prezime"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="kor-oib" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  OIB <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.oib}
                  onChange={(e) => setInputs({ ...inputs, oib: e.target.value })}
                  type="text"
                  name="oib"
                  id="kor-oib"
                  placeholder="11 znamenki"
                  maxLength={11}
                  pattern="\d{11}"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="kor-datum-rodjenja" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Datum rođenja
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.datumRodjenja}
                  onChange={(e) => setInputs({ ...inputs, datumRodjenja: e.target.value })}
                  type="date"
                  name="datumRodjenja"
                  id="kor-datum-rodjenja"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="kor-brojMobitela" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Broj mobitela
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.brojMobitela}
                  onChange={handleChange}
                  type="text"
                  name="brojMobitela"
                  id="kor-brojMobitela"
                  placeholder="+385 91 234 5678"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="kor-skola" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Škola <span style={{ color: 'red' }}>*</span>
                </label>
                <select
                  className="input-login-signup"
                  value={inputs.school}
                  onChange={handleChange}
                  name="school"
                  id="kor-skola"
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Odaberi školu</option>
                  {schools.map((school) => (
                    <option key={school._id} value={school._id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Address Section */}
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:map-point-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Adresa
            </h3>

            <div className="dodaj-mentora-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label htmlFor="kor-ulica" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Ulica
                </label>
                <input
                  className="input-login-signup"
                  onChange={(e) => setInputs({ ...inputs, adresa: { ...inputs.adresa, ulica: e.target.value } })}
                  type="text"
                  name="ulica"
                  id="kor-ulica"
                  placeholder="Ulica"
                  value={inputs.adresa.ulica}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label htmlFor="kor-kucni-broj" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Kućni broj
                </label>
                <input
                  className="input-login-signup"
                  onChange={(e) => setInputs({ ...inputs, adresa: { ...inputs.adresa, kucniBroj: e.target.value } })}
                  type="text"
                  name="kucniBroj"
                  id="kor-kucni-broj"
                  placeholder="Broj"
                  value={inputs.adresa.kucniBroj}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="kor-mjesto" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                Mjesto
              </label>
              <input
                className="input-login-signup"
                onChange={(e) => setInputs({ ...inputs, adresa: { ...inputs.adresa, mjesto: e.target.value } })}
                type="text"
                name="mjesto"
                id="kor-mjesto"
                placeholder="Grad/mjesto"
                value={inputs.adresa.mjesto}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Additional Information Section */}
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:document-text-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Dodatne informacije
            </h3>

            <div
              className={`radio-item ${inputs.isAdmin ? 'checked' : ''}`}
              onClick={() => setInputs({ ...inputs, isAdmin: !inputs.isAdmin })}
              style={{
                padding: '1rem',
                border: '2px solid rgba(var(--isticanje), 0.3)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                background: inputs.isAdmin ? 'rgba(var(--isticanje), 0.1)' : 'transparent',
                transition: 'all 0.2s',
                marginBottom: '1rem',
                textAlign: 'center',
                fontWeight: 600
              }}
            >
              <input
                type="radio"
                id="isAdmin"
                checked={inputs.isAdmin}
                onChange={() => setInputs({ ...inputs, isAdmin: !inputs.isAdmin })}
                style={{ display: 'none' }}
              />
              <Icon
                icon={inputs.isAdmin ? "solar:shield-check-bold" : "solar:shield-broken"}
                style={{ verticalAlign: 'middle', marginRight: '0.5rem', fontSize: '1.2rem' }}
              />
              {inputs.isAdmin ? 'Administrator' : 'Nije administrator'}
            </div>

            <div>
              <label htmlFor="kor-napomene" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                Napomene
              </label>
              <textarea
                className="input-login-signup"
                value={inputs.napomene}
                onChange={(e) => setInputs({ ...inputs, napomene: e.target.value })}
                name="napomene"
                id="kor-napomene"
                placeholder="Unesite napomene o mentoru..."
                maxLength={5000}
                rows={4}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="div-radio">
            <button
              className="gumb action-btn zatvoriBtn"
              onClick={() => onCancel()}
              type="button"
            >
              <Icon icon="solar:close-circle-broken" /> Odustani
            </button>
            <button
              className="gumb action-btn spremiBtn"
              type="submit"
              disabled={isDodajMentoraDisabled}
            >
              {isDodajMentoraDisabled ? (
                <>
                  <Icon icon="solar:loading-bold-duotone" className="spin" /> Spremanje...
                </>
              ) : (
                <>
                  <Icon icon="solar:user-speak-broken" /> Dodaj mentora
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {notification && (
        <Notifikacija
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </Modal>
  );
};

export default DodajMentora;