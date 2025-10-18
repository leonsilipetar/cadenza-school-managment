import React, { useState, useEffect } from 'react';
import ApiConfig from '../../components/apiConfig';
import Notification from '../../components/Notifikacija';
import Modal from '../../components/Modal';
import { Icon } from '@iconify/react';

const DodajKorisnika = ({ onDodajKorisnika, onCancel }) => {
  const [mentors, setMentors] = useState([]);
  const [schools, setSchools] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [notification, setNotification] = useState(null);
  const [emailExists, setEmailExists] = useState(null); // null | true | false
  const [emailCheckError, setEmailCheckError] = useState(null);
  const [programInput, setProgramInput] = useState('');
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [programToRemove, setProgramToRemove] = useState(null);
  const [programTypes, setProgramTypes] = useState({});
  const [formErrors, setFormErrors] = useState({});
  const [submitState, setSubmitState] = useState('idle'); // idle | validating | submitting | success | error
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [inputs, setInputs] = useState({
    email: '',
    ime: '',
    prezime: '',
    isAdmin: false,
    isMentor: false,
    isStudent: true,
    oib: '',
    brojMobitela: '',
    datumRodjenja: '',
    adresa: {
      ulica: '',
      kucniBroj: '',
      mjesto: '',
    },
    pohadjaTeoriju: false,
    napomene: '',
    maloljetniClan: false,
    roditelj1: {
      ime: '',
      prezime: '',
      brojMobitela: ''
    },
    roditelj2: {
      ime: '',
      prezime: '',
      brojMobitela: '',
    },
    schoolId: '',
  });

  const fetchPrograms = async (schoolId) => {
    try {
      if (!schoolId) {
        console.log('DodajKorisnika: No schoolId, clearing programs');
        setPrograms([]);
        return;
      }

      console.log('DodajKorisnika: Fetching programs for schoolId:', schoolId);
      const programsRes = await ApiConfig.api.get('/api/programs', {
        params: { schoolId }
      });
      console.log('DodajKorisnika: Programs fetched:', programsRes.data);

      if (Array.isArray(programsRes.data)) {
        setPrograms(programsRes.data);
      } else {
        console.error('Invalid programs data format:', programsRes.data);
        setPrograms([]);
      }
    } catch (err) {
      console.error('Error fetching programs:', err);
      setNotification({
        type: 'error',
        message: 'Greška pri učitavanju programa'
      });
      setPrograms([]);
    }
  };

  const handleAddProgram = async (programId) => {
    try {
      const program = programs.find(p => p.id === programId);
      if (!program) return;

      // Check for duplicate
      const isDuplicate = selectedPrograms.some(p => p.id === programId);
      if (isDuplicate) {
        setNotification({
          type: 'warning',
          message: 'Program je već dodan'
        });
        return;
      }

      setSelectedPrograms(prev => [...prev, program]);
      setProgramInput('');
      setNotification({
        type: 'success',
        message: 'Program uspješno dodan'
      });
    } catch (error) {
      console.error('Error adding program:', error);
      setNotification({
        type: 'error',
        message: 'Greška pri dodavanju programa'
      });
    }
  };

  const handleRemoveProgram = async (programId) => {
    try {
      setSelectedPrograms(prev => prev.filter(program => program.id !== programId));
      setNotification({
        type: 'success',
        message: 'Program uspješno uklonjen'
      });
    } catch (error) {
      console.error('Error removing program:', error);
      setNotification({
        type: 'error',
        message: 'Greška pri uklanjanju programa'
      });
    }
  };

  const handleProgramTypeChange = (programId, newType) => {
    setProgramTypes(prev => ({
      ...prev,
      [programId]: newType
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'email') {
      // Reset email existence hint when user edits email
      setEmailExists(null);
      setEmailCheckError(null);
    }
    if (name in inputs.adresa) {
      setInputs((prev) => ({
        ...prev,
        adresa: { ...prev.adresa, [name]: value },
      }));
    } else if (name.startsWith('roditelj1.')) {
      const field = name.split('.')[1];
      setInputs(prev => ({
        ...prev,
        roditelj1: { ...prev.roditelj1, [field]: value }
      }));
    } else if (name.startsWith('roditelj2.')) {
      const field = name.split('.')[1];
      setInputs(prev => ({
        ...prev,
        roditelj2: { ...prev.roditelj2, [field]: value }
      }));
    } else if (name === 'schoolId') {
      const newValue = value ? Number(value) : null;
      setInputs((prev) => ({
        ...prev,
        [name]: newValue,
      }));
      // Clear selected programs when school changes
      setSelectedPrograms([]);
      setProgramTypes({});
      if (newValue) {
        fetchPrograms(newValue);
      } else {
        setPrograms([]);
      }
    } else {
      setInputs((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleEmailBlur = async () => {
    try {
      const email = inputs.email?.trim();
      if (!email) return;
      const emailRegex = /^[\w\.-]+@[\w\.-]+\.[A-Za-z]{2,}$/;
      if (!emailRegex.test(String(email))) return;

      setEmailCheckError(null);
      const res = await ApiConfig.api.get(`/api/users/check-email/${encodeURIComponent(email)}`);
      if (typeof res.data?.exists === 'boolean') {
        setEmailExists(res.data.exists);
      }
    } catch (err) {
      console.error('Email check failed:', err);
      setEmailCheckError('Nije moguće provjeriti e‑mail trenutno.');
    }
  };

  const validateInputs = (data) => {
    const errors = {};
    // Required
    if (!data.email || !/^[\w\.-]+@[\w\.-]+\.[A-Za-z]{2,}$/.test(String(data.email))) {
      errors.email = 'Neispravan email';
    }
    if (!data.ime || String(data.ime).trim().length < 1) {
      errors.ime = 'Ime je obavezno';
    }
    if (!data.prezime || String(data.prezime).trim().length < 1) {
      errors.prezime = 'Prezime je obavezno';
    }
    // Optional but format-checked
    if (data.oib && !/^\d{11}$/.test(String(data.oib))) {
      errors.oib = 'OIB mora imati 11 znamenki';
    }
    if (data.brojMobitela && !/^\+?\d{8,15}$/.test(String(data.brojMobitela))) {
      errors.brojMobitela = 'Unesite ispravan broj (min 8 znamenki)';
    }
    return errors;
  };

  const buildPayload = () => {
    const payload = {
      ...inputs,
      schoolId: inputs.schoolId || 1,
      adresa: inputs.adresa || {},
      datumRodjenja: inputs.datumRodjenja || null,
      brojMobitela: inputs.brojMobitela || '',
      roditelj1: inputs.roditelj1 || {},
      roditelj2: inputs.roditelj2 || {},
      napomene: typeof inputs.napomene === 'string' ? [inputs.napomene] : (inputs.napomene || []),
      programId: selectedPrograms.map(program => program.id),
      programType: programTypes
    };
    console.log('DodajKorisnika: Building payload with programs:', {
      selectedPrograms,
      programTypes,
      programId: payload.programId,
      programType: payload.programType
    });
    return payload;
  };

  const dodajKorisnika = async () => {
    try {
      const cleanedInputs = buildPayload();
      console.log('DodajKorisnika: Sending to API:', cleanedInputs);

      const res = await ApiConfig.api.post('/api/signup', cleanedInputs);
      console.log('DodajKorisnika: Response from API:', res.data);
      return res.data;
    } catch (err) {
      console.error('Error adding student:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.response?.data?.error || 'Greška pri dodavanju učenika'
      });
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Debounce: 3 seconds between submits
    const now = Date.now();
    if (now - lastSubmitTime < 3000) {
      setNotification({ type: 'warning', message: 'Molimo pričekajte prije ponovnog slanja.' });
      return;
    }

    setSubmitState('validating');
    const errors = validateInputs(inputs);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitState('error');
      setNotification({ type: 'error', message: 'Provjerite označena polja.' });
      return;
    }

    setSubmitState('submitting');
    const result = await dodajKorisnika();
    setLastSubmitTime(Date.now());
    if (result) {
      setSubmitState('success');
      setNotification({ type: 'success', message: 'Učenik uspješno dodan!' });
      if (typeof onDodajKorisnika === 'function') {
        onDodajKorisnika();
      }
      // Optionally reset after success
      // setInputs(prev => ({ ...prev, email: '', ime: '', prezime: '' }));
    } else {
      setSubmitState('error');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [mentorsRes, schoolsRes] = await Promise.all([
          ApiConfig.api.get('/api/mentori'),
          ApiConfig.api.get('/api/schools')
        ]);

        setMentors(mentorsRes.data);
        setSchools(schoolsRes.data);
      } catch (err) {
        console.error('Error fetching data:', err);
        setNotification({
          type: 'error',
          message: 'Greška pri dohvaćanju podataka'
        });
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (inputs.schoolId) {
      fetchPrograms(inputs.schoolId);
    }
  }, [inputs.schoolId]);

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={
        <>
          <Icon icon="solar:user-plus-broken" />
          Dodaj novog učenika
        </>
      }
      maxWidth="900px"
      isFormModal={true}
    >
      <form onSubmit={handleSubmit}>
        <style>{`
          @media (max-width: 768px) {
            .dodaj-korisnika-grid {
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label htmlFor="kor-email" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Email <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.email}
                  onChange={handleChange}
                  onBlur={handleEmailBlur}
                  type="email"
                  name="email"
                  id="kor-email"
                  placeholder="primjer@email.com"
                  required
                  style={{ width: '100%' }}
                />
                {formErrors.email && (
                  <div style={{ color: 'rgb(220, 53, 69)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{formErrors.email}</div>
                )}
                {emailExists === true && !formErrors.email && (
                  <div style={{ color: 'rgb(13, 110, 253)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    ⓘ Ova e‑mail adresa već postoji u sustavu. Dodavanje je dozvoljeno (npr. braća/sestre).
                    Za prijavu će se koristiti korisničko ime koje će biti poslano na ovu e‑mail adresu.
                  </div>
                )}
                {emailCheckError && (
                  <div style={{ color: 'rgb(255, 193, 7)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{emailCheckError}</div>
                )}
              </div>

              <div>
                <label htmlFor="kor-oib" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  OIB
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.oib}
                  onChange={handleChange}
                  type="text"
                  name="oib"
                  id="kor-oib"
                  placeholder="11 znamenki"
                  maxLength={11}
                  pattern="\d{11}"
                  style={{ width: '100%' }}
                />
                {formErrors.oib && (
                  <div style={{ color: 'rgb(220, 53, 69)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{formErrors.oib}</div>
                )}
              </div>

              <div className="dodaj-korisnika-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                    placeholder="Ime"
                    style={{ width: '100%' }}
                  />
                  {formErrors.ime && (
                    <div style={{ color: 'rgb(220, 53, 69)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{formErrors.ime}</div>
                  )}
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
                    placeholder="Prezime"
                    style={{ width: '100%' }}
                  />
                  {formErrors.prezime && (
                    <div style={{ color: 'rgb(220, 53, 69)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{formErrors.prezime}</div>
                  )}
                </div>
              </div>

              <div className="dodaj-korisnika-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label htmlFor="kor-datum-rodjenja" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Datum rođenja
                  </label>
                  <input
                    className="input-login-signup"
                    value={inputs.datumRodjenja}
                    onChange={handleChange}
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
                    placeholder="+385..."
                    style={{ width: '100%' }}
                  />
                  {formErrors.brojMobitela && (
                    <div style={{ color: 'rgb(220, 53, 69)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{formErrors.brojMobitela}</div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="kor-skola" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Škola
                </label>
                <select
                  className="input-login-signup"
                  value={inputs.schoolId || ''}
                  onChange={handleChange}
                  name="schoolId"
                  id="kor-skola"
                  style={{ width: '100%' }}
                >
                  <option value="">Odaberi školu</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="dodaj-korisnika-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label htmlFor="kor-ulica" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Ulica
                  </label>
                  <input
                    className="input-login-signup"
                    onChange={handleChange}
                    type="text"
                    name="ulica"
                    id="kor-ulica"
                    placeholder="Naziv ulice"
                    value={inputs.adresa.ulica}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label htmlFor="kor-kucni-broj" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Broj
                  </label>
                  <input
                    className="input-login-signup"
                    onChange={handleChange}
                    type="text"
                    name="kucniBroj"
                    id="kor-kucni-broj"
                    placeholder="Broj"
                    value={inputs.adresa.kucniBroj}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="kor-mjesto" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Mjesto
                </label>
                <input
                  className="input-login-signup"
                  onChange={handleChange}
                  type="text"
                  name="mjesto"
                  id="kor-mjesto"
                  placeholder="Grad/Mjesto"
                  value={inputs.adresa.mjesto}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Parent 1 Section */}
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:users-group-rounded-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Roditelj/Skrbnik 1
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="dodaj-korisnika-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label htmlFor="roditelj1-ime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Ime
                  </label>
                  <input
                    className="input-login-signup"
                    onChange={handleChange}
                    type="text"
                    name="roditelj1.ime"
                    id="roditelj1-ime"
                    placeholder="Ime roditelja/skrbnika"
                    value={inputs.roditelj1.ime || ''}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label htmlFor="roditelj1-prezime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Prezime
                  </label>
                  <input
                    className="input-login-signup"
                    onChange={handleChange}
                    type="text"
                    name="roditelj1.prezime"
                    id="roditelj1-prezime"
                    placeholder="Prezime roditelja/skrbnika"
                    value={inputs.roditelj1.prezime || ''}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="roditelj1-brojMobitela" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Broj mobitela
                </label>
                <input
                  className="input-login-signup"
                  onChange={handleChange}
                  type="text"
                  name="roditelj1.brojMobitela"
                  id="roditelj1-brojMobitela"
                  placeholder="Broj mobitela roditelja/skrbnika"
                  value={inputs.roditelj1.brojMobitela || ''}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Parent 2 Section */}
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:users-group-rounded-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Roditelj/Skrbnik 2 (opcionalno)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="dodaj-korisnika-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label htmlFor="roditelj2-ime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Ime
                  </label>
                  <input
                    className="input-login-signup"
                    onChange={handleChange}
                    type="text"
                    name="roditelj2.ime"
                    id="roditelj2-ime"
                    placeholder="Ime roditelja/skrbnika"
                    value={inputs.roditelj2.ime || ''}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label htmlFor="roditelj2-prezime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Prezime
                  </label>
                  <input
                    className="input-login-signup"
                    onChange={handleChange}
                    type="text"
                    name="roditelj2.prezime"
                    id="roditelj2-prezime"
                    placeholder="Prezime roditelja/skrbnika"
                    value={inputs.roditelj2.prezime || ''}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="roditelj2-brojMobitela" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Broj mobitela
                </label>
                <input
                  className="input-login-signup"
                  onChange={handleChange}
                  type="text"
                  name="roditelj2.brojMobitela"
                  id="roditelj2-brojMobitela"
                  placeholder="Broj mobitela roditelja/skrbnika"
                  value={inputs.roditelj2.brojMobitela || ''}
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Additional Info Section */}
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:notes-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Dodatne informacije
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{
                background: 'rgba(var(--isticanje2), 0.1)',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <label style={{ fontWeight: 600, flex: 1 }}>
                  Pohađa teoriju
                </label>
                <div className={`checkbox-item ${inputs.pohadjaTeoriju ? 'checked' : ''}`}
                     onClick={() => setInputs((prev) => ({ ...prev, pohadjaTeoriju: !prev.pohadjaTeoriju }))}
                     style={{ margin: 0, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    id="pohadjaTeoriju"
                    checked={inputs.pohadjaTeoriju}
                    onChange={() => setInputs((prev) => ({ ...prev, pohadjaTeoriju: !prev.pohadjaTeoriju }))}
                    style={{ display: 'none' }}
                  />
                  {inputs.pohadjaTeoriju ? '✓ Da' : '✗ Ne'}
                </div>
              </div>

              <div>
                <label htmlFor="kor-napomene" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Napomene
                </label>
                <textarea
                  className="input-login-signup"
                  value={inputs.napomene}
                  onChange={handleChange}
                  name="napomene"
                  id="kor-napomene"
                  placeholder="Unesite napomene o korisniku"
                  maxLength={5000}
                  rows={4}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Programs Section */}
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:diploma-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Programi
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {!inputs.schoolId && (
                <div style={{
                  background: 'rgba(255, 193, 7, 0.1)',
                  border: '1px solid rgba(255, 193, 7, 0.3)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.9rem',
                  color: 'var(--tekst)'
                }}>
                  <Icon icon="solar:info-circle-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                  Prvo odaberite školu da biste vidjeli dostupne programe
                </div>
              )}

              <div>
                <label htmlFor="kor-program" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Pretraži i dodaj programe
                </label>
                <input
                  className="input-login-signup"
                  type="text"
                  value={programInput}
                  onChange={(e) => setProgramInput(e.target.value)}
                  placeholder={inputs.schoolId ? "Počni tipkati za pretragu programa..." : "Prvo odaberi školu"}
                  disabled={!inputs.schoolId}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Program search results */}
              {programInput.length > 0 && (
                <div className="tablica" style={{ width: '100%' }}>
                  <div className="tr naziv">
                    <div className="th">Rezultati pretrage</div>
                    <div className="th"></div>
                  </div>
                  {programs
                    .filter(program =>
                      program.naziv.toLowerCase().includes(programInput.toLowerCase()) &&
                      !selectedPrograms.some(sp => sp.id === program.id)
                    )
                    .map(program => (
                      <div key={program.id} className="tr redak">
                        <div className="th">{program.naziv}</div>
                        <div className="th">
                          <button
                            className="action-btn abEdit"
                            onClick={() => handleAddProgram(program.id)}
                            type="button"
                          >
                            <Icon icon="solar:add-circle-broken" /> Dodaj
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Selected programs */}
              {selectedPrograms.length > 0 && (
                <div className="tablica" style={{ width: '100%' }}>
                  <div className="tr naziv">
                    <div className="th">Dodani programi</div>
                    <div className="th">Tip programa</div>
                    <div className="th"></div>
                  </div>
                  {selectedPrograms.map((program) => (
                    <div key={program.id} className="tr redak">
                      <div className="th">{program.naziv}</div>
                      <div className="th">
                        <select
                          value={programTypes[program.id] || ''}
                          onChange={(e) => handleProgramTypeChange(program.id, e.target.value)}
                          className="input-login-signup"
                          style={{ width: 'auto', minWidth: '200px' }}
                        >
                          <option value="">Odaberi tip</option>
                          {program.tipovi?.map(tip => (
                            <option key={tip.tip} value={tip.tip}>
                              {tip.tip === 'grupno' ? 'Grupno' :
                               tip.tip === 'individualno1' ? 'Individualno 1x tjedno' :
                               tip.tip === 'individualno2' ? 'Individualno 2x tjedno' :
                               'Poseban program'} - {tip.cijena} EUR
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="th">
                        {programToRemove?.id === program.id ? (
                          <>
                            <button
                              className="gumb action-btn abDelete"
                              type="button"
                              onClick={() => handleRemoveProgram(program.id)}
                            >
                              Ukloni
                            </button>
                            <button
                              className="gumb action-btn abEdit"
                              type="button"
                              onClick={() => setProgramToRemove(null)}
                            >
                              Odustani
                            </button>
                          </>
                        ) : (
                          <button
                            className="action-btn abDelete"
                            onClick={() => setProgramToRemove(program)}
                            type="button"
                          >
                            <Icon icon="solar:trash-bin-trash-broken" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Debug Preview (Dev Tool) */}
          <div style={{
            background: 'rgba(var(--isticanje2), 0.1)',
            padding: '1rem',
            borderRadius: 'var(--radius)'
          }}>
            <button
              type="button"
              className="gumb action-btn abExpand"
              onClick={() => setShowPreview(p => !p)}
              style={{ width: '100%' }}
            >
              <Icon icon="solar:code-broken" />
              {showPreview ? 'Sakrij podatke za slanje' : 'Prikaži podatke za slanje'}
            </button>
            {showPreview && (
              <div style={{
                marginTop: '0.5rem',
                background: 'var(--nav-top)',
                color: 'var(--tekst)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '0.5rem',
                maxHeight: '300px',
                overflow: 'auto'
              }}>
                <pre style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--tekst)', fontSize: '0.75rem' }}>
                  {JSON.stringify(buildPayload(), null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="div-radio" style={{
            borderTop: '1px solid rgba(var(--isticanje2), 0.3)'
          }}>
            <button
              className="gumb action-btn zatvoriBtn"
              onClick={onCancel}
              type="button"
            >
              <Icon icon="solar:close-circle-broken" /> Odustani
            </button>
            <button
              className="gumb action-btn spremiBtn"
              type="submit"
              disabled={submitState === 'submitting'}
            >
              {submitState === 'submitting' ? (
                <>
                  <Icon icon="solar:loading-bold-duotone" className="spin" /> Spremanje...
                </>
              ) : submitState === 'success' ? (
                <>
                  <Icon icon="solar:check-circle-broken" /> Spremljeno
                </>
              ) : submitState === 'error' ? (
                <>
                  <Icon icon="solar:danger-triangle-broken" /> Ispravite greške
                </>
              ) : (
                <>
                  <Icon icon="solar:user-plus-broken" /> Dodaj učenika
                </>
              )}
            </button>
          </div>

        </div>
        {notification && (
          <Notification
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification(null)}
          />
        )}
      </form>
    </Modal>
  );
};

export default DodajKorisnika;
