import React, { useEffect, useState, useRef } from 'react';
import ApiConfig from '../components/apiConfig';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authActions } from '../store';
import { Icon } from '@iconify/react';
import '../scenes/SignUpForm.css';
import '../components/auth-pages.css';

const EnrollmentConfirm = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [enrollment, setEnrollment] = useState(null);
  const [agreementText, setAgreementText] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(null);
  const [lastSubmitTime, setLastSubmitTime] = useState(0);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingEnrollment, setPendingEnrollment] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [updatingProgram, setUpdatingProgram] = useState(false);
  const [selectedLessonFrequency, setSelectedLessonFrequency] = useState('');
  const [schools, setSchools] = useState([]);
  const [showProgramChooser, setShowProgramChooser] = useState(false);
  const [detailedUser, setDetailedUser] = useState(null);
  const [details, setDetails] = useState({
    oib: '',
    datumRodjenja: '',
    brojMobitela: '',
    adresa: { ulica: '', kucniBroj: '', mjesto: '' },
    roditelj1: { ime: '', prezime: '', brojMobitela: '' },
    roditelj2: { ime: '', prezime: '', brojMobitela: '' }
  });
  const [touched, setTouched] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [isUnderAge, setIsUnderAge] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const timeoutRef = useRef(null);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch(authActions.logout());
    navigate('/login');
  };

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      // Check for pending enrollment when coming back online
      if (pendingEnrollment) {
        handleConfirm();
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingEnrollment]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [enrollRes, agreementRes, userRes] = await Promise.all([
          ApiConfig.cachedApi.get('/api/enrollment/current'),
          ApiConfig.cachedApi.get('/api/enrollment/agreement'),
          ApiConfig.api.get(`/api/korisnik/${user.id}`)
        ]);
        setEnrollment(enrollRes.enrollment);
        setAgreementText(agreementRes.agreementText);
        const u = userRes.user || userRes.data?.user || null;
        setDetailedUser(u);
        // Prefill editable details
        const dob = u?.datumRodjenja ? new Date(u.datumRodjenja).toISOString().split('T')[0] : '';
        setDetails({
          oib: u?.oib || '',
          datumRodjenja: dob,
          brojMobitela: u?.brojMobitela || '',
          adresa: {
            ulica: u?.adresa?.ulica || '',
            kucniBroj: u?.adresa?.kucniBroj || '',
            mjesto: u?.adresa?.mjesto || ''
          },
          roditelj1: {
            ime: u?.roditelj1?.ime || '',
            prezime: u?.roditelj1?.prezime || '',
            brojMobitela: u?.roditelj1?.brojMobitela || ''
          },
          roditelj2: {
            ime: u?.roditelj2?.ime || '',
            prezime: u?.roditelj2?.prezime || '',
            brojMobitela: u?.roditelj2?.brojMobitela || ''
          }
        });

        // Set initial selected program from enrollment or user's current programs
        if (enrollRes.enrollment?.programId) {
          setSelectedProgramId(enrollRes.enrollment.programId);
        } else if (user?.programs && user.programs.length > 0) {
          // If no enrollment program but user has programs, use the first one
          setSelectedProgramId(user.programs[0].id);
        }
        // If user has no programs at all, selectedProgramId remains null and they must choose

        if (enrollRes.enrollment?.agreementAccepted) {
          navigate('/user');
        }
      } catch (err) {
        setError('Greška pri dohvaćanju podataka.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  // Fetch available programs for the user's school
  useEffect(() => {
    const fetchPrograms = async () => {

      if (!user?.schoolId) {
        console.log('❌ No schoolId in user object, cannot fetch programs');
        setPrograms([]);
        return;
      }

      try {
        console.log('✅ Have schoolId, fetching programs directly...');
        // Use the same endpoint as SignUpForm
        const response = await ApiConfig.api.get(`/api/programs/public/${user.schoolId}`);
        console.log('Programs response:', response);

        if (response?.data && Array.isArray(response.data)) {
          console.log('✅ Programs set successfully:', response.data.length, 'programs');
          setPrograms(response.data);
        } else {
          console.error('❌ Unexpected programs data format:', response);
          setPrograms([]);
        }
      } catch (err) {
        console.error('❌ Error fetching programs:', err);
        setPrograms([]);
      }
    };

    fetchPrograms();
  }, [user?.schoolId]);

  // Fetch schools to display school name instead of ID
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const response = await ApiConfig.cachedApi.get('/api/schools/public');
        if (Array.isArray(response.data)) {
          setSchools(response.data);
        }
      } catch (err) {
        // non-fatal, fallback to showing ID
      }
    };
    fetchSchools();
  }, []);

  // Helper: derive lesson frequency options from selected program
  const getLessonFrequencyOptions = () => {
    if (!selectedProgramId || !programs.length) return [];
    const selectedProgram = programs.find(p => p.id === parseInt(selectedProgramId));
    if (!selectedProgram) return [];

    if (selectedProgram.tipovi && Array.isArray(selectedProgram.tipovi)) {
      return selectedProgram.tipovi;
    }
    if (selectedProgram.cijena) {
      return [
        { tip: 'individualno1', cijena: selectedProgram.cijena },
        { tip: 'individualno2', cijena: selectedProgram.cijena },
        { tip: 'grupno', cijena: selectedProgram.cijena }
      ];
    }
    return [];
  };

  // Auto-select single option when program changes
  useEffect(() => {
    const options = getLessonFrequencyOptions();
    if (options.length === 1) {
      setSelectedLessonFrequency(options[0].tip);
    } else if (!selectedProgramId) {
      setSelectedLessonFrequency('');
    }
  }, [selectedProgramId, programs]);

  // Auto-open chooser if user has no assigned program
  useEffect(() => {
    const hasUserPrograms = Array.isArray(user?.programs) && user.programs.length > 0;
    if (!hasUserPrograms && !enrollment?.programId) {
      setShowProgramChooser(true);
    }
  }, [user?.programs, enrollment?.programId]);

  const handleProgramChange = async (newProgramId) => {
    if (!newProgramId || newProgramId === '' || newProgramId === selectedProgramId) return;

    setUpdatingProgram(true);
    setError(null);

    try {
      // Update user's program
      await ApiConfig.cachedApi.put(`/api/update-korisnik/${user.id}`, {
        programId: newProgramId
      });

      setSelectedProgramId(newProgramId);
      // reset lesson frequency on program change, then auto-pick if single
      const program = programs.find(p => p.id === parseInt(newProgramId));
      if (program) {
        if (program.tipovi && Array.isArray(program.tipovi) && program.tipovi.length === 1) {
          setSelectedLessonFrequency(program.tipovi[0].tip);
        } else if (program.cijena) {
          // default to none selected for multi options
          setSelectedLessonFrequency('');
        } else {
          setSelectedLessonFrequency('');
        }
      } else {
        setSelectedLessonFrequency('');
      }

      // Update enrollment with new program
      if (enrollment) {
        setEnrollment(prev => ({
          ...prev,
          programId: newProgramId
        }));
      }

    } catch (err) {
      console.error('Error updating program:', err);
      setError('Greška pri promjeni programa. Molimo pokušajte ponovno.');
    } finally {
      setUpdatingProgram(false);
    }
  };

  // Helpers for legal fields
  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  useEffect(() => {
    const age = calculateAge(details.datumRodjenja);
    setIsUnderAge(age !== null && age < 18);
  }, [details.datumRodjenja]);

  const validateField = (name, value) => {
    switch (name) {
      case 'oib':
        return value && value.length === 11 ? '' : 'OIB mora imati 11 znamenki';
      case 'datumRodjenja':
        return value ? '' : 'Obavezan unos';
      case 'brojMobitela':
        return value && /^\+?\d{8,15}$/.test(value) ? '' : 'Unesite ispravan broj (min 8 znamenki)';
      default:
        return '';
    }
  };

  const validateParentsIfNeeded = () => {
    if (!isUnderAge) return true;
    const r1 = details.roditelj1;
    const r2 = details.roditelj2;
    const ok = r1.ime && r1.prezime && /^\+?\d{8,15}$/.test(r1.brojMobitela)
           && r2.ime && r2.prezime && /^\+?\d{8,15}$/.test(r2.brojMobitela);
    return !!ok;
  };

  const saveUserDetails = async () => {
    // Build payload preserving mentorId and schoolId to avoid wiping them
    const payload = {
      oib: details.oib || null,
      datumRodjenja: details.datumRodjenja || null,
      brojMobitela: details.brojMobitela || '',
      adresa: {
        ulica: details.adresa.ulica || '',
        kucniBroj: details.adresa.kucniBroj || '',
        mjesto: details.adresa.mjesto || ''
      },
      roditelj1: {
        ime: details.roditelj1.ime || '',
        prezime: details.roditelj1.prezime || '',
        brojMobitela: details.roditelj1.brojMobitela || ''
      },
      roditelj2: {
        ime: details.roditelj2.ime || '',
        prezime: details.roditelj2.prezime || '',
        brojMobitela: details.roditelj2.brojMobitela || ''
      },
      // Preserve existing values
      mentorId: Array.isArray(detailedUser?.mentorId) ? detailedUser.mentorId : [],
      schoolId: detailedUser?.school?.id || detailedUser?.schoolId || user?.schoolId || null
    };
    await ApiConfig.api.put(`/api/update-korisnik/${user.id}`, payload);
  };

  const handleConfirm = async () => {
    setError(null);
    // Debounce: onemogući klik na 1 minutu
    const now = Date.now();
    if (now - lastSubmitTime < 60000) {
      setError('Već ste poslali zahtjev. Pričekajte minutu prije ponovnog pokušaja.');
      return;
    }
    // Validate required legal fields
    const errs = {};
    errs.oib = validateField('oib', details.oib);
    errs.datumRodjenja = validateField('datumRodjenja', details.datumRodjenja);
    errs.brojMobitela = validateField('brojMobitela', details.brojMobitela);
    setFieldErrors(errs);
    const hasFieldErrors = Object.values(errs).some(Boolean);
    if (hasFieldErrors || !validateParentsIfNeeded()) {
      setError('Molimo ispunite obavezna polja za potvrdu upisa.');
      return;
    }
    setLastSubmitTime(now);
    setLoading(true);

    try {
      // Save user details first
      await saveUserDetails();
      // Use cachedApi for better offline support
      const response = await ApiConfig.cachedApi.post('/api/enrollment/accept', {
        agreementText,
        programId: selectedProgramId, // Include selected program
        schoolId: user?.schoolId,
        pohadanjeNastave: selectedLessonFrequency
      });

      if (response.offline) {
        // Request was queued for later
        setPendingEnrollment(true);
        setError('Nema internetske veze. Zahtjev će biti poslan kada se vratite online.');
        setLoading(false);
        return;
      }

      setAccepted(true);
      setPendingEnrollment(false);
      // Debounce: onemogući ponovno slanje
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setLastSubmitTime(0), 60000);
      navigate('/user');
    } catch (err) {
      if (err.response?.status === 429) {
        // Rate limit exceeded
        setError('Previše pokušaja upisa. Molimo pričekajte sat vremena prije ponovnog pokušaja.');
        // Reset the debounce timer to prevent immediate retry
        setLastSubmitTime(Date.now());
      } else if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else {
        setError('Greška pri potvrdi upisa.');
      }
      setPendingEnrollment(false);
    } finally {
      setLoading(false);
    }
  };

  // Helper za izračun školske godine ako nije dostupno iz enrollment
  function getCurrentSchoolYear() {
    const now = new Date();
    const year = now.getFullYear();
    return `${year}/${year + 1}`;
  }
  const schoolYear = enrollment?.schoolYear || getCurrentSchoolYear();
  const lessonOptions = getLessonFrequencyOptions();
  const selectedProgram = programs.find(p => p.id === parseInt(selectedProgramId || 0));
  const schoolDisplayName = schools.find(s => String(s.id) === String(user?.schoolId))?.name || user?.school?.name || user?.schoolId;
  const currentUserProgramName = (() => {
    if (selectedProgramId) {
      const fromUser = Array.isArray(user?.programs) ? user.programs.find(p => p.id === parseInt(selectedProgramId)) : null;
      return fromUser?.naziv || selectedProgram?.naziv || '';
    }
    const firstUserProgram = Array.isArray(user?.programs) && user.programs.length > 0 ? user.programs[0] : null;
    return firstUserProgram?.naziv || '';
  })();

  if (loading) return (
    <div className="signup-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div className="auth-loading-spinner" style={{ marginRight: 12 }}></div>
      <span>Učitavanje...</span>
    </div>
  );

  return (
    <div className="signup-container" style={{ maxWidth: 600, margin: '2rem auto', background: 'var(--iznad)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', padding: '2rem 2.5rem' }}>
      <h2 style={{ textAlign: 'center', color: 'rgb(var(--isticanje))', marginBottom: 8 }}>Potvrda upisa u školsku godinu</h2>
      <div style={{ textAlign: 'center', color: 'var(--tekst)', fontWeight: 600, marginBottom: 24, fontSize: 18 }}>
        Šk. godina: {schoolYear}
      </div>

      {/* Offline indicator */}
      {isOffline && (
        <div style={{
          background: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          textAlign: 'center',
          color: '#856404'
        }}>
          <strong>Offline mod</strong> - Nema internetske veze. Možete potvrditi upis, a zahtjev će biti poslan kada se vratite online.
        </div>
      )}

      {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="form-section" style={{ marginBottom: 32 }}>
        <h3 style={{ color: 'var(--tekst)', marginBottom: 12 }}>Vaši podaci</h3>
        <div className="form-row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
            <label>Ime i prezime</label>
            <input value={user?.ime + ' ' + user?.prezime} disabled />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
            <label>Email</label>
            <input value={user?.email} disabled />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
            <label>Škola</label>
            <input value={schoolDisplayName} disabled />
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
            <label>Program</label>
            <input value={currentUserProgramName || 'Nije dodijeljen'} disabled />
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            onClick={() => setShowProgramChooser((s) => !s)}
            className="submit-btn"
            style={{
              background: 'transparent',
              color: 'rgb(var(--isticanje))',
              border: '1px solid rgba(var(--isticanje), 0.5)',
              padding: '0.4rem 0.9rem',
              borderRadius: 8,
              fontWeight: 700
            }}
          >
            {showProgramChooser ? 'Sakrij odabir programa' : 'Promijeni program'}
          </button>
        </div>
      </div>

      {/* Program Selection Section */}
      {showProgramChooser && (
      <div className="form-section" style={{ marginBottom: 32 }}>
        <h3 style={{ color: 'var(--tekst)', marginBottom: 12 }}>Odabir programa</h3>

        {/* Current program info if one is selected */}
        {selectedProgramId && programs.length > 0 && (
          <div style={{
            background: 'rgba(var(--isticanje), 0.1)',
            border: '1px solid rgba(var(--isticanje), 0.3)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Icon icon="solar:bookmark-broken" style={{ color: 'rgb(var(--isticanje))' }} />
              <strong style={{ color: 'rgb(var(--isticanje))' }}>Trenutno odabrani program:</strong>
            </div>
            {programs.find(p => p.id === parseInt(selectedProgramId)) && (
              <div style={{ fontSize: '16px', fontWeight: '600' }}>
                {programs.find(p => p.id === parseInt(selectedProgramId)).naziv}
                {(() => {
                  const prog = programs.find(p => p.id === parseInt(selectedProgramId));
                  if (!prog) return null;
                  if (prog.tipovi && Array.isArray(prog.tipovi) && selectedLessonFrequency) {
                    const opt = prog.tipovi.find(t => t.tip === selectedLessonFrequency);
                    if (opt) {
                      return (
                        <span style={{ color: 'rgb(var(--isticanje))', marginLeft: '8px', fontWeight: 700 }}>
                          - {selectedLessonFrequency} • {opt.cijena}€/mjesec
                        </span>
                      );
                    }
                  }
                  if (prog.cijena) {
                    return (
                      <span style={{ color: 'rgb(var(--isticanje))', marginLeft: '8px' }}>
                        - {prog.cijena}€/mjesec
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        )}

        <div className="form-row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 250 }}>
            <label>
              Program <span style={{ color: 'red' }}>*</span>
              {!selectedProgramId && (
                <span style={{ color: '#888', fontWeight: 'normal', marginLeft: '8px' }}>
                  - Molimo odaberite program
                </span>
              )}
            </label>
            <select
              value={selectedProgramId || ''}
              onChange={(e) => handleProgramChange(e.target.value || '')}
              disabled={updatingProgram}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: selectedProgramId ? '1px solid rgba(var(--isticanje), 0.5)' : '1px solid #ddd',
                fontSize: '16px',
                borderWidth: selectedProgramId ? '2px' : '1px',
                color: 'var(--tekst)'
              }}
            >
              <option value="">Odaberite program koji želite pohađati</option>
              {programs.map(program => (
                <option key={program.id} value={program.id}>
                  {program.naziv}
                  {program.tipovi && Array.isArray(program.tipovi) && program.tipovi.length > 0
                    ? (() => {
                        const count = program.tipovi.length;
                        if (count === 1) return ' - 1 opcija';
                        if (count === 2) return ' - 2 opcije';
                        if (count === 3) return ' - 3 opcije';
                        if (count === 4) return ' - 4 opcije';
                        if (count === 5) return ' - 5 opcija';
                        return ` - ${count} opcija`;
                      })()
                    : (program.cijena ? ` - ${program.cijena}€/mjesec` : '')}
                </option>
              ))}
            </select>

            {/* Loading state */}
            {updatingProgram && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '8px',
                color: 'rgb(var(--isticanje))',
                fontSize: '14px'
              }}>
                <div className="auth-loading-spinner" style={{ width: '16px', height: '16px' }}></div>
                Ažuriranje programa...
              </div>
            )}

            {/* Program info */}
            <div style={{ marginTop: '8px' }}>
              {!selectedProgramId ? (
                <small style={{ color: 'var(--tekst)', display: 'block' }}>
                  <Icon icon="solar:info-circle-broken" style={{ marginRight: '4px' }} />
                  Potrebno je odabrati program prije potvrde upisa. Cijena je navedena po mjesecu.
                </small>
              ) : (
                <small style={{ color: 'rgb(var(--isticanje))', display: 'block' }}>
                  <Icon icon="solar:check-circle-broken" style={{ marginRight: '4px' }} />
                  Možete promijeniti program prije potvrde upisa. Promjena će se automatski ažurirati.
                </small>
              )}
            </div>

            {/* Lesson frequency options (tipovi) */}
            {selectedProgramId && lessonOptions.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: 'var(--tekst)' }}>
                  Način pohađanja nastave <span style={{ color: 'red' }}>*</span>
                  {selectedProgram && (
                    <span style={{ color: 'var(--tekst)', fontWeight: 'normal', marginLeft: 8, fontSize: 14 }}>
                      - {selectedProgram.naziv}
                    </span>
                  )}
                </label>
                <div className="auth-radio-group styled-radio-group">
                  {lessonOptions.map((option) => (
                    <label
                      key={option.tip}
                      className={`styled-radio${selectedLessonFrequency === option.tip ? ' selected' : ''}`}
                    >
                      <div className="radio-content">
                        <input
                          type="radio"
                          name="pohadanjeNastave"
                          value={option.tip}
                          checked={selectedLessonFrequency === option.tip}
                          onChange={(e) => setSelectedLessonFrequency(e.target.value)}
                          required
                        />
                        <span className="styled-radio-custom"></span>
                        <span>
                          {option.tip === 'individualno1' && 'Individualno 1x tjedno'}
                          {option.tip === 'individualno2' && 'Individualno 2x tjedno'}
                          {option.tip === 'grupno' && 'Grupno'}
                          {option.tip === 'none' && '1x tjedno'}
                          {!['individualno1', 'individualno2', 'grupno', 'none'].includes(option.tip) && option.tip}
                        </span>
                      </div>
                      <span className="radio-price">{option.cijena}€</span>
                    </label>
                  ))}
                </div>
                {selectedProgramId && !selectedLessonFrequency && (
                  <small style={{ color: 'var(--tekst)', display: 'block', marginTop: 8 }}>
                    <Icon icon="solar:info-circle-broken" style={{ marginRight: '4px' }} />
                    Odaberite način pohađanja nastave koji vam odgovara
                  </small>
                )}
              </div>
            )}

            {/* Programs list preview */}
            {programs.length > 0 && !selectedProgramId && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: 'var(--nav-top)',
                borderRadius: '6px',
                border: '1px solid #e9ecef'
              }}>
                <small style={{ fontWeight: '600', color: 'var(--tekst)', marginBottom: '8px', display: 'block' }}>
                  Dostupni programi u vašoj školi:
                </small>
                {programs.slice(0, 3).map((program, index) => (
                  <div key={program.id} style={{
                    fontSize: '13px',
                    color: 'var(--tekst)',
                    marginBottom: '4px'
                  }}>
                    • {program.naziv}
                    {program.cijena && <span style={{ color: 'rgb(var(--isticanje))' }}> - {program.cijena}€/mjesec</span>}
                  </div>
                ))}
                {programs.length > 3 && (
                  <small style={{ color: 'var(--tekst)', fontStyle: 'italic' }}>
                    ...i još {programs.length - 3} programa
                  </small>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Legal details section */}
      <div className="auth-signup-section" style={{ marginBottom: 24 }}>
        <div className="auth-section-header">
          <Icon icon="solar:id-card-broken" />
          <h4>Podaci potrebni za upis</h4>
        </div>
        <div className="auth-signup-row">
          <div className="auth-signup-group">
            <label className="auth-signup-label">OIB <span className="auth-required">*</span></label>
            <div className="auth-input-wrapper">
              <Icon icon="solar:user-circle-broken" className="auth-input-icon" />
              <input
                type="text"
                className={`input-login-signup ${touched.oib && fieldErrors.oib ? 'auth-signup-input-error' : ''}`}
                value={details.oib}
                onChange={(e) => setDetails(prev => ({ ...prev, oib: e.target.value.slice(0, 11) }))}
                onBlur={() => setTouched(prev => ({ ...prev, oib: true }))}
                placeholder="OIB"
                maxLength={11}
                style={{ paddingLeft: '36px' }}
              />
            </div>
            {touched.oib && fieldErrors.oib && <span className="auth-field-error">{fieldErrors.oib}</span>}
          </div>
          <div className="auth-signup-group">
            <label className="auth-signup-label">Datum rođenja <span className="auth-required">*</span></label>
            <div className="auth-input-wrapper">
              <Icon icon="solar:calendar-broken" className="auth-input-icon" />
              <input
                type="date"
                className={`input-login-signup ${touched.datumRodjenja && fieldErrors.datumRodjenja ? 'auth-signup-input-error' : ''}`}
                value={details.datumRodjenja}
                onChange={(e) => setDetails(prev => ({ ...prev, datumRodjenja: e.target.value }))}
                onBlur={() => setTouched(prev => ({ ...prev, datumRodjenja: true }))}
                style={{ paddingLeft: '36px' }}
              />
            </div>
            {touched.datumRodjenja && fieldErrors.datumRodjenja && <span className="auth-field-error">{fieldErrors.datumRodjenja}</span>}
          </div>
          <div className="auth-signup-group">
            <label className="auth-signup-label">Broj mobitela <span className="auth-required">*</span></label>
            <div className="auth-input-wrapper">
              <Icon icon="solar:phone-broken" className="auth-input-icon" />
              <input
                type="tel"
                className={`input-login-signup ${touched.brojMobitela && fieldErrors.brojMobitela ? 'auth-signup-input-error' : ''}`}
                value={details.brojMobitela}
                onChange={(e) => setDetails(prev => ({ ...prev, brojMobitela: e.target.value }))}
                onBlur={() => setTouched(prev => ({ ...prev, brojMobitela: true }))}
                placeholder="Unesite broj mobitela"
                style={{ paddingLeft: '36px' }}
              />
            </div>
            {touched.brojMobitela && fieldErrors.brojMobitela && <span className="auth-field-error">{fieldErrors.brojMobitela}</span>}
          </div>
        </div>

        <div className="auth-signup-row">
          <div className="auth-signup-group">
            <label className="auth-signup-label">Ulica</label>
            <div className="auth-input-wrapper">
              <Icon icon="solar:map-point-broken" className="auth-input-icon" />
              <input
                type="text"
                className="input-login-signup"
                value={details.adresa.ulica}
                onChange={(e) => setDetails(prev => ({ ...prev, adresa: { ...prev.adresa, ulica: e.target.value } }))}
                placeholder="Ulica"
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>
          <div className="auth-signup-group">
            <label className="auth-signup-label">Kućni broj</label>
            <div className="auth-input-wrapper">
              <Icon icon="solar:home-broken" className="auth-input-icon" />
              <input
                type="text"
                className="input-login-signup"
                value={details.adresa.kucniBroj}
                onChange={(e) => setDetails(prev => ({ ...prev, adresa: { ...prev.adresa, kucniBroj: e.target.value } }))}
                placeholder="Kućni broj"
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>
          <div className="auth-signup-group">
            <label className="auth-signup-label">Mjesto</label>
            <div className="auth-input-wrapper">
              <Icon icon="solar:map-point-broken" className="auth-input-icon" />
              <input
                type="text"
                className="input-login-signup"
                value={details.adresa.mjesto}
                onChange={(e) => setDetails(prev => ({ ...prev, adresa: { ...prev.adresa, mjesto: e.target.value } }))}
                placeholder="Mjesto"
                style={{ paddingLeft: '36px' }}
              />
            </div>
          </div>
        </div>

        {isUnderAge && (
          <div className="auth-signup-section" style={{ marginTop: 12 }}>
            <div className="auth-section-header">
              <Icon icon="solar:users-group-broken" />
              <h4>Podaci o roditelju/skrbniku</h4>
            </div>
            <div className="auth-signup-row">
              <div className="auth-signup-group">
                <label className="auth-signup-label">R1 Ime</label>
                <div className="auth-input-wrapper">
                  <Icon icon="solar:user-broken" className="auth-input-icon" />
                  <input
                    type="text"
                    className="input-login-signup"
                    value={details.roditelj1.ime}
                    onChange={(e) => setDetails(prev => ({ ...prev, roditelj1: { ...prev.roditelj1, ime: e.target.value } }))}
                    placeholder="Ime roditelja/skrbnika"
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>
              <div className="auth-signup-group">
                <label className="auth-signup-label">R1 Prezime</label>
                <div className="auth-input-wrapper">
                  <Icon icon="solar:user-broken" className="auth-input-icon" />
                  <input
                    type="text"
                    className="input-login-signup"
                    value={details.roditelj1.prezime}
                    onChange={(e) => setDetails(prev => ({ ...prev, roditelj1: { ...prev.roditelj1, prezime: e.target.value } }))}
                    placeholder="Prezime roditelja/skrbnika"
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>
              <div className="auth-signup-group">
                <label className="auth-signup-label">R1 Broj mobitela</label>
                <div className="auth-input-wrapper">
                  <Icon icon="solar:phone-broken" className="auth-input-icon" />
                  <input
                    type="tel"
                    className="input-login-signup"
                    value={details.roditelj1.brojMobitela}
                    onChange={(e) => setDetails(prev => ({ ...prev, roditelj1: { ...prev.roditelj1, brojMobitela: e.target.value } }))}
                    placeholder="Broj roditelja/skrbnika"
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>
            </div>
            <div className="auth-signup-row">
              <div className="auth-signup-group">
                <label className="auth-signup-label">R2 Ime</label>
                <div className="auth-input-wrapper">
                  <Icon icon="solar:user-broken" className="auth-input-icon" />
                  <input
                    type="text"
                    className="input-login-signup"
                    value={details.roditelj2.ime}
                    onChange={(e) => setDetails(prev => ({ ...prev, roditelj2: { ...prev.roditelj2, ime: e.target.value } }))}
                    placeholder="Ime roditelja/skrbnika"
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>
              <div className="auth-signup-group">
                <label className="auth-signup-label">R2 Prezime</label>
                <div className="auth-input-wrapper">
                  <Icon icon="solar:user-broken" className="auth-input-icon" />
                  <input
                    type="text"
                    className="input-login-signup"
                    value={details.roditelj2.prezime}
                    onChange={(e) => setDetails(prev => ({ ...prev, roditelj2: { ...prev.roditelj2, prezime: e.target.value } }))}
                    placeholder="Prezime roditelja/skrbnika"
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>
              <div className="auth-signup-group">
                <label className="auth-signup-label">R2 Broj mobitela</label>
                <div className="auth-input-wrapper">
                  <Icon icon="solar:phone-broken" className="auth-input-icon" />
                  <input
                    type="tel"
                    className="input-login-signup"
                    value={details.roditelj2.brojMobitela}
                    onChange={(e) => setDetails(prev => ({ ...prev, roditelj2: { ...prev.roditelj2, brojMobitela: e.target.value } }))}
                    placeholder="Broj roditelja/skrbnika"
                    style={{ paddingLeft: '36px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="auth-signup-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className={`auth-submit-button ${saveStatus === 'saving' ? 'auth-submit-button-loading' : ''}`}
            onClick={async () => {
              try {
                setError(null);
                setSaveStatus('saving');
                await saveUserDetails();
                // Refresh detailed user
                const ur = await ApiConfig.api.get(`/api/korisnik/${user.id}`);
                setDetailedUser(ur.user || ur.data?.user || null);
                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
              } catch (e) {
                setError(e?.response?.data?.message || 'Greška pri spremanju podataka.');
                setSaveStatus('idle');
              }
            }}
            disabled={saveStatus === 'saving'}
          >
            <Icon icon={saveStatus === 'saving' ? 'solar:loading-bold-duotone' : (saveStatus === 'saved' ? 'solar:check-circle-broken' : 'solar:save-broken')} className={saveStatus === 'saving' ? 'spin' : ''} /> {saveStatus === 'saving' ? 'Spremanje...' : (saveStatus === 'saved' ? 'Spremljeno' : 'Spremi podatke')}
          </button>
        </div>
      </div>

      <div className="form-section" style={{ marginBottom: 32 }}>
        <h3 style={{ color: 'var(--tekst)', marginBottom: 12 }}>Ugovor i suglasnost</h3>
        <div className="agreement-modal-body" style={{ minHeight: 200, background: 'var(--iznad)', border: '1px solid #eee', borderRadius: 8, marginBottom: 12 }}>
          <div style={{ padding: 16, width: '100%' }} dangerouslySetInnerHTML={{ __html: agreementText }} />
        </div>
        <div style={{ marginTop: 8, marginBottom: 16, textAlign: 'center' }}>
          <a
            href="https://cadenza.com.hr/UGOVOR-SUGLASNOST-UPISNICA-2025.-2026-Music-Art-Incubator.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline', color: 'rgb(255, 155, 0)', fontWeight: 600 }}
          >
            Preuzmi ugovor i suglasnost (PDF)
          </a>
        </div>
        <div className="checkbox-group" style={{ marginTop: 16, marginBottom: 16, justifyContent: 'center' }}>
          <label className="checkbox-label" style={{ fontSize: 16 }}>
            <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} disabled={loading} />
            <span className="checkbox-custom"></span>
            <span className="checkbox-text">Prihvaćam uvjete ugovora i suglasnosti</span>
          </label>
        </div>
        <div className="form-actions" style={{ textAlign: 'center' }}>
          <button
            className="submit-btn"
            disabled={
              !accepted ||
              loading ||
              (Date.now() - lastSubmitTime < 60000) ||
              (!selectedProgramId && showProgramChooser) ||
              (showProgramChooser && lessonOptions.length > 0 && !selectedLessonFrequency) ||
              // Disable if OIB missing/invalid or address entirely empty
              (!details.oib || String(details.oib).trim().length !== 11) ||
              (!details.adresa?.ulica && !details.adresa?.kucniBroj && !details.adresa?.mjesto)
            }
            onClick={handleConfirm}
            style={{ minWidth: 180, fontSize: 18, padding: '0.8rem 2.5rem', borderRadius: 8, background: 'rgb(var(--isticanje))', color: 'white', fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}
          >
            {loading ? 'Slanje...' : pendingEnrollment ? 'Čekanje na vezu...' : 'Potvrdi upis'}
          </button>
        </div>
        {/* Removed cooldown countdown UI to avoid confusion after successful confirm */}
        {showProgramChooser && !selectedProgramId && programs.length > 0 && (
          <div style={{
            color: 'rgb(var(--isticanje))',
            marginTop: 8,
            textAlign: 'center',
            fontSize: 14,
            background: 'rgba(var(--isticanje), 0.1)',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(var(--isticanje), 0.3)'
          }}>
            <Icon icon="solar:info-circle-broken" style={{ marginRight: '4px' }} />
            Za potvrdu upisa potrebno je odabrati program iz liste iznad.
          </div>
        )}
        {showProgramChooser && selectedProgramId && lessonOptions.length > 0 && !selectedLessonFrequency && (
          <div style={{
            color: 'rgb(var(--isticanje))',
            marginTop: 8,
            textAlign: 'center',
            fontSize: 14,
            background: 'rgba(var(--isticanje), 0.1)',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(var(--isticanje), 0.3)'
          }}>
            <Icon icon="solar:info-circle-broken" style={{ marginRight: '4px' }} />
            Za potvrdu upisa potrebno je odabrati način pohađanja nastave.
          </div>
        )}
        {programs.length === 0 && (
          <div style={{
            color: 'var(--tekst)',
            marginTop: 8,
            textAlign: 'center',
            fontSize: 14,
            background: '#f8f9fa',
            padding: '8px 12px',
            borderRadius: '6px'
          }}>
            <Icon icon="solar:clock-circle-broken" style={{ marginRight: '4px' }} />
            Učitavanje dostupnih programa...
          </div>
        )}
      </div>
      <div className="auth-legal-notice" style={{ textAlign: 'center', color: 'var(--tekst)', fontSize: 14, marginTop: 24 }}>
        Klikom na "Potvrdi upis" prihvaćate sve uvjete i potvrđujete točnost podataka.
      </div>

      {/* Logout button */}
      <div style={{ textAlign: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(var(--isticanje2), 0.3)' }}>
        <button
          onClick={handleLogout}
          className="auth-welcome-btn auth-welcome-btn-secondary"
          style={{ fontSize: 14, padding: '8px 16px' }}
        >
          <Icon icon="solar:logout-2-broken" />
          Odjavi se
        </button>
      </div>
    </div>
  );
};

export default EnrollmentConfirm;