import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ApiConfig from '../../components/apiConfig';
import Modal from '../../components/Modal';
import { Icon } from '@iconify/react';
import { showNotification } from '../../components/Notifikacija';

axios.defaults.withCredentials = true;

const KorisnikDetalji = ({ korisnikId, userData, onCancel, selfService, onSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [mentors, setMentors] = useState([]);
  const [schools, setSchools] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [mentorPrograms, setMentorPrograms] = useState([]);
  const [inputs, setInputs] = useState({
    korisnickoIme: '',
    email: '',
    ime: '',
    prezime: '',
    isAdmin: false,
    isMentor: false,
    isStudent: true,
    oib: '',
    programId: [{}],
    brojMobitela: '',
    mentorId: [],
    schoolId: '',
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
      brojMobitela: '',
    },
    roditelj2: {
      ime: '',
      prezime: '',
      brojMobitela: '',
    },
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [programInput, setProgramInput] = useState('');
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [programToRemove, setProgramToRemove] = useState(null);
  const [programTypes, setProgramTypes] = useState({});
  // New state for mentor management (admin only)
  const [mentorSearch, setMentorSearch] = useState('');
  const [mentorSearchResults, setMentorSearchResults] = useState([]);
  const [mentorToRemove, setMentorToRemove] = useState(null);

  const fetchMentors = async () => {
    try {
      const res = await ApiConfig.api.get('/api/mentori');
      setMentors(res.data);
    } catch (err) {
      console.error('Error fetching mentors:', err);
      showNotification('error', 'Greška pri učitavanju mentora');
    }
  };

  const fetchSchools = async () => {
    try {
      const res = await ApiConfig.api.get('/api/schools');
      setSchools(res.data);
    } catch (err) {
      console.error('Error fetching schools:', err);
      showNotification('error', 'Greška pri učitavanju škola');
    }
  };

  const fetchPrograms = async (schoolId) => {
    try {
      if (!schoolId) {
        setPrograms([]);
        return;
      }

      const programsRes = await ApiConfig.api.get('/api/programs', {
        params: { schoolId }
      });

      if (Array.isArray(programsRes.data)) {
        setPrograms(programsRes.data);
      } else {
        console.error('Invalid programs data format:', programsRes.data);
        setPrograms([]);
      }
    } catch (err) {
      console.error('Error fetching programs:', err);
      showNotification('error', 'Greška pri učitavanju programa');
      setPrograms([]);
    }
  };

  const getDetaljiKorisnika = async (korisnikId) => {
    try {
      const res = await ApiConfig.api.get(`/api/korisnik/${korisnikId}`);
      return res.data.user;
    } catch (err) {
      console.error('Error fetching user details:', err);
      showNotification('error', 'Greška pri učitavanju detalja korisnika');
      throw err;
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // Handle checkbox inputs
    if (type === 'checkbox') {
      setInputs((prev) => ({
        ...prev,
        [name]: checked,
      }));
      return;
    }

    // Handle address fields
    if (inputs.adresa && Object.keys(inputs.adresa).includes(name)) {
      setInputs((prev) => ({
        ...prev,
        adresa: { ...prev.adresa, [name]: value || '' },
      }));
      return;
    }

    // Handle parent fields
    if (name.startsWith('roditelj1.')) {
      const field = name.split('.')[1];
      setInputs(prev => ({
        ...prev,
        roditelj1: { ...prev.roditelj1, [field]: value || '' }
      }));
      return;
    }

    if (name.startsWith('roditelj2.')) {
      const field = name.split('.')[1];
      setInputs(prev => ({
        ...prev,
        roditelj2: { ...prev.roditelj2, [field]: value || '' }
      }));
      return;
    }

    // Handle schoolId
    if (name === 'schoolId') {
      const newValue = value ? Number(value) : '';
      setInputs((prev) => ({
        ...prev,
        [name]: newValue,
      }));

      // Clear selected programs when school changes
      setSelectedPrograms([]);
      setProgramTypes({});

      // Fetch new programs for the selected school
      if (newValue) {
        fetchPrograms(newValue);
      } else {
        setPrograms([]); // Clear programs if no school selected
      }
      return;
    }

    // Handle all other fields
    setInputs((prev) => ({
      ...prev,
      [name]: value || '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const cleanedInputs = {
        ...inputs,
        napomene: typeof inputs.napomene === 'string' ? [inputs.napomene] : (inputs.napomene || []),
        programs: selectedPrograms.map(program => program.id),
        schoolId: inputs.schoolId || null,
        adresa: inputs.adresa || {},
        datumRodjenja: inputs.datumRodjenja || null,
        brojMobitela: inputs.brojMobitela || '',
        programType: Object.keys(programTypes).length > 0 ? programTypes : undefined
      };

      // Remove korisnickoIme since it's automatic and shouldn't be changed
      delete cleanedInputs.korisnickoIme;
      // In self-service mode, do not allow changing school or theory flag
      if (selfService) {
        delete cleanedInputs.schoolId;
        delete cleanedInputs.pohadjaTeoriju;
      }

      const res = await ApiConfig.api.put(
        `/api/update-korisnik/${korisnikId}`,
        cleanedInputs
      );

      if (res.data) {
        showNotification('success', 'Korisnik uspješno ažuriran');

        // Refetch user data
        const userData = await getDetaljiKorisnika(korisnikId);
        setInputs(prevInputs => ({
          ...prevInputs,
          ...userData,
          mentor: userData.mentorId || '',
          datumRodjenja: userData.datumRodjenja ?
            new Date(userData.datumRodjenja).toISOString().split('T')[0] : '',
          adresa: userData.adresa || { ulica: '', kucniBroj: '', mjesto: '' },
          roditelj1: userData.roditelj1 || { ime: '', prezime: '', brojMobitela: '' },
          roditelj2: userData.roditelj2 || { ime: '', prezime: '', brojMobitela: '' }
        }));
        
        // Call onSave callback if provided (for React Query cache invalidation)
        if (onSave) {
          onSave();
        }
        
        onCancel();
      }
    } catch (err) {
      console.error('❌ Update error:', err.response?.data || err);
      showNotification('error', err.response?.data?.message || 'Greška pri ažuriranju korisnika');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      setIsResetting(true);
      await ApiConfig.api.post('/api/reset-password', {
        userId: korisnikId,
        userType: 'student',
        email: inputs.email
      });
      showNotification('success', 'Nova lozinka je poslana na email.');
      setShowResetConfirm(false);
    } catch (error) {
      showNotification('error', error.response?.data?.message || 'Greška pri resetiranju lozinke.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleAddProgram = async (programId) => {
    try {

      // Find program in either mentorPrograms or regular programs array
      const program = programs.find(p => p.id === programId) || mentorPrograms.find(p => p.id === programId);
      if (!program) {
        return;
      }

      // Check for duplicate
      const isDuplicate = selectedPrograms.some(p => p.id === programId);
      if (isDuplicate) {
        showNotification('warning', 'Program je već dodan');
        return;
      }

      setSelectedPrograms(prev => {
        const newSelection = [...prev, program];
        return newSelection;
      });
      setProgramInput('');
      showNotification('success', 'Program uspješno dodan');
    } catch (error) {
      console.error('Error adding program:', error);
      showNotification('error', 'Greška pri dodavanju programa');
    }
  };

  const handleRemoveProgram = async (programId) => {
    try {
      setSelectedPrograms(prev => {
        const newSelection = prev.filter(program => program.id !== programId);
         return newSelection;
      });
      showNotification('success', 'Program uspješno uklonjen');
    } catch (error) {
      console.error('Error removing program:', error);
      showNotification('error', 'Greška pri uklanjanju programa');
    }
  };

  const handleProgramTypeChange = (programId, newType) => {
   setProgramTypes(prev => {
      const newTypes = { ...prev, [programId]: newType };
      return newTypes;
    });

    setInputs(prev => ({
      ...prev,
      programType: {
        ...prev.programType,
        [programId]: newType
      }
    }));
  };

  // Admin-only mentor management
  const handleMentorSearch = (e) => {
    const query = e.target.value || '';
    setMentorSearch(query);

    if (query.length < 2) {
      setMentorSearchResults([]);
      return;
    }

    const filtered = mentors
      .filter(m =>
        (m.korisnickoIme?.toLowerCase().includes(query.toLowerCase()) ||
         m.ime?.toLowerCase().includes(query.toLowerCase()) ||
         m.prezime?.toLowerCase().includes(query.toLowerCase())) &&
        !inputs.mentorId.includes(m.id)
      )
      .slice(0, 20);
    setMentorSearchResults(filtered);
  };

  const handleAddMentor = (mentorId) => {
    if (inputs.mentorId?.includes(mentorId)) {
      showNotification('warning', 'Mentor je već dodan');
      return;
    }
    setInputs(prev => ({
      ...prev,
      mentorId: [...(prev.mentorId || []), mentorId]
    }));
    setMentorSearch('');
    setMentorSearchResults([]);
    showNotification('success', 'Mentor uspješno dodan');
  };

  const handleRemoveMentor = (mentorId) => {
    setInputs(prev => ({
      ...prev,
      mentorId: (prev.mentorId || []).filter(id => id !== mentorId)
    }));
    setMentorToRemove(null);
    showNotification('success', 'Mentor uspješno uklonjen');
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use passed userData if available, otherwise fetch
        const data = userData || await getDetaljiKorisnika(korisnikId);
        if (data) {
          const formattedDate = data.datumRodjenja ?
            new Date(data.datumRodjenja).toISOString().split('T')[0] :
            '';

          // Convert schoolId to number if it exists
          const schoolId = data.school?.id ? Number(data.school.id) : (data.schoolId ? Number(data.schoolId) : '');

          // Ensure all fields have default values
          setInputs({
            korisnickoIme: data.korisnickoIme || '',
            email: data.email || '',
            ime: data.ime || '',
            prezime: data.prezime || '',
            isAdmin: data.isAdmin || false,
            isMentor: data.isMentor || false,
            isStudent: data.isStudent || true,
            oib: data.oib || '',
            programId: data.programId || [],
            brojMobitela: data.brojMobitela || '',
            mentorId: data.mentorId || [],
            schoolId: schoolId,
            datumRodjenja: formattedDate,
            adresa: {
              ulica: data.adresa?.ulica || '',
              kucniBroj: data.adresa?.kucniBroj || '',
              mjesto: data.adresa?.mjesto || '',
            },
            pohadjaTeoriju: data.pohadjaTeoriju || false,
            napomene: data.napomene || '',
            maloljetniClan: data.maloljetniClan || false,
            roditelj1: {
              ime: data.roditelj1?.ime || '',
              prezime: data.roditelj1?.prezime || '',
              brojMobitela: data.roditelj1?.brojMobitela || '',
            },
            roditelj2: {
              ime: data.roditelj2?.ime || '',
              prezime: data.roditelj2?.prezime || '',
              brojMobitela: data.roditelj2?.brojMobitela || '',
            },
          });

          // Set selected programs if user has any

          setSelectedPrograms(data.programs && Array.isArray(data.programs) ? data.programs : []);

          // Update program types
           setProgramTypes(data.programType || {});

          // Fetch mentor details and their programs if mentorId exists
          if (data.mentorId?.length > 0) {
            try {
              const mentorPromises = data.mentorId.map(async (id) => {
                try {
                  const res = await ApiConfig.api.get(`/api/mentori/${id}`);
                  return res.data;
                } catch (e) {
                  if (e?.response?.status === 404) return null; // skip missing mentor
                  throw e;
                }
              });
              const mentorDetails = (await Promise.all(mentorPromises)).filter(Boolean);

              // Get all unique programs from mentors
              const allMentorPrograms = mentorDetails
                .flatMap(mentor => mentor.programs || [])
                .filter((program, index, self) =>
                  index === self.findIndex(p => p.id === program.id)
                );

              setMentorPrograms(allMentorPrograms);
            } catch (err) {
              console.error('Error fetching mentor programs:', err);
              showNotification('error', 'Greška pri učitavanju programa mentora');
            }
          }
        }
      } catch (error) {
        console.error('Error fetching user details:', error);
        showNotification('error', 'Greška pri učitavanju detalja korisnika');
      }
    };

    fetchData();
    fetchMentors();
    fetchSchools();
  }, [korisnikId, userData]);

  // Fetch programs when school changes
  useEffect(() => {
    if (inputs.schoolId) {
      fetchPrograms(inputs.schoolId);
    } else {
      setPrograms([]);
    }
  }, [inputs.schoolId]);

  // Fetch mentor programs when mentors change
  useEffect(() => {
    if (inputs.mentorId?.length > 0) {
      fetchMentorPrograms();
    } else {
      setMentorPrograms([]);
    }
  }, [inputs.mentorId]);

  const fetchSchoolPrograms = async () => {
    try {
      const response = await ApiConfig.api.get(`/api/programs`);
      setPrograms(response.data);
    } catch (error) {
      console.error('Error fetching school programs:', error);
      showNotification('error', 'Greška pri dohvaćanju programa škole');
    }
  };

  const fetchMentorPrograms = async () => {
    try {
      const mentorPromises = inputs.mentorId.map(id =>
        ApiConfig.api.get(`/api/mentori/${id}`)
      );
      const mentorResponses = await Promise.all(mentorPromises);
      const allMentorPrograms = mentorResponses.flatMap(response =>
        response.data.programs || []
      );
      // Remove duplicates
      const uniquePrograms = [...new Map(allMentorPrograms.map(item =>
        [item.id, item]
      )).values()];
      setMentorPrograms(uniquePrograms);
    } catch (error) {
      console.error('Error fetching mentor programs:', error);
      showNotification('error', 'Greška pri dohvaćanju programa mentora');
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={
        <>
          <Icon icon="solar:user-id-broken" />
          {selfService ? 'Moj profil' : 'Detalji učenika'}
        </>
      }
      maxWidth="900px"
      isFormModal={true}
    >
      <form onSubmit={handleSubmit} style={{ paddingBottom: '100px' }}>
        <style>{`
          @media (max-width: 768px) {
            .korisnik-detalji-grid {
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
                <label htmlFor="kor-Korime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Korisničko ime
                </label>
                <input
                  className="input-login-signup"
                  value={inputs.korisnickoIme}
                  onChange={handleChange}
                  type="text"
                  name="korisnickoIme"
                  id="kor-Korime"
                  placeholder="Korisničko ime"
                  disabled={!!selfService}
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
                  placeholder="primjer@email.com"
                  required
                  disabled={!!selfService}
                  style={{ width: '100%' }}
                />
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
                  disabled={!!selfService}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="korisnik-detalji-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label htmlFor="kor-ime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Ime
                  </label>
                  <input
                    className="input-login-signup"
                    value={inputs.ime}
                    onChange={handleChange}
                    type="text"
                    name="ime"
                    id="kor-ime"
                    placeholder="Ime"
                    disabled={!!selfService}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label htmlFor="kor-prezime" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Prezime
                  </label>
                  <input
                    className="input-login-signup"
                    value={inputs.prezime}
                    onChange={handleChange}
                    type="text"
                    name="prezime"
                    id="kor-prezime"
                    placeholder="Prezime"
                    disabled={!!selfService}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="korisnik-detalji-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
                    disabled={!!selfService}
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
                  disabled={!!selfService}
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

          {/* Programs Section - Admin Only */}
          {!selfService && (
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
              <div>
                <label htmlFor="kor-program" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Pretraži i dodaj programe
                </label>
                <input
                  className="input-login-signup"
                  type="text"
                  value={programInput}
                  onChange={(e) => setProgramInput(e.target.value)}
                  placeholder="Počni tipkati za pretragu programa..."
                  style={{ width: '100%' }}
                />
              </div>

              {/* Program search results */}
              {programInput.length > 0 && (
                <div style={{
                  background: 'rgba(var(--isticanje2), 0.05)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgba(var(--isticanje2), 0.2)',
                  maxHeight: '300px',
                  overflow: 'auto'
                }}>
                  <div style={{
                    padding: '0.5rem 1rem',
                    borderBottom: '1px solid rgba(var(--isticanje2), 0.2)',
                    background: 'rgba(var(--isticanje2), 0.1)',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}>
                    Rezultati pretrage
                  </div>
                  {[
                    ...programs.map(p => ({ ...p, source: 'Škola' })),
                    ...mentorPrograms.map(p => ({ ...p, source: 'Mentor' }))
                  ]
                    .filter(program =>
                      program.naziv.toLowerCase().includes(programInput.toLowerCase()) &&
                      !selectedPrograms.some(sp => sp.id === program.id)
                    )
                    .map(program => (
                      <div
                        key={program.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid rgba(var(--isticanje2), 0.1)',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--isticanje), 0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500 }}>{program.naziv}</div>
                          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
                            <Icon icon={program.source === 'Škola' ? "solar:buildings-3-broken" : "solar:user-broken"} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                            {program.source}
                          </div>
                        </div>
                        <button
                          className="action-btn abEdit"
                          onClick={() => handleAddProgram(program.id)}
                          type="button"
                          style={{ marginLeft: '1rem' }}
                        >
                          <Icon icon="solar:add-circle-broken" /> Dodaj
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {/* Selected programs */}
              {selectedPrograms.length > 0 && (
                <div>
                  <div style={{
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'rgb(var(--isticanje))'
                  }}>
                    Dodani programi ({selectedPrograms.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedPrograms.map((program) => (
                      <div
                        key={program.id}
                        style={{
                          background: 'rgba(var(--isticanje), 0.05)',
                          padding: '1rem',
                          borderRadius: 'var(--radius)',
                          border: '1px solid rgba(var(--isticanje), 0.2)'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '0.75rem'
                        }}>
                          <div style={{ fontWeight: 600 }}>{program.naziv}</div>
                          {programToRemove?.id === program.id ? (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="action-btn abDelete"
                                type="button"
                                onClick={() => handleRemoveProgram(program.id)}
                              >
                                <Icon icon="solar:trash-bin-trash-broken" /> Ukloni
                              </button>
                              <button
                                className="action-btn abEdit"
                                type="button"
                                onClick={() => setProgramToRemove(null)}
                              >
                                <Icon icon="solar:close-circle-broken" /> Odustani
                              </button>
                            </div>
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
                        <div>
                          <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block', fontSize: '0.9rem' }}>
                            Tip programa
                          </label>
                          <select
                            value={programTypes[program.id] || ''}
                            onChange={(e) => handleProgramTypeChange(program.id, e.target.value)}
                            className="input-login-signup"
                            style={{ width: '100%' }}
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
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Mentors Section - Admin Only */}
          {!selfService && (
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:user-speak-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Mentori
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label htmlFor="mentor-search" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Pretraži i dodaj mentore
                </label>
                <input
                  id="mentor-search"
                  className="input-login-signup"
                  type="text"
                  value={mentorSearch}
                  onChange={handleMentorSearch}
                  placeholder="Počni tipkati za pretragu mentora..."
                  style={{ width: '100%' }}
                />
              </div>

              {/* Mentor search results */}
              {mentorSearch.length > 0 && mentorSearchResults.length > 0 && (
                <div style={{
                  background: 'rgba(var(--isticanje2), 0.05)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgba(var(--isticanje2), 0.2)',
                  maxHeight: '300px',
                  overflow: 'auto'
                }}>
                  <div style={{
                    padding: '0.5rem 1rem',
                    borderBottom: '1px solid rgba(var(--isticanje2), 0.2)',
                    background: 'rgba(var(--isticanje2), 0.1)',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                  }}>
                    Rezultati pretrage
                  </div>
                  {mentorSearchResults.map(mentor => (
                    <div
                      key={mentor.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid rgba(var(--isticanje2), 0.1)',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--isticanje), 0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500 }}>{mentor.ime} {mentor.prezime}</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
                          <Icon icon="solar:user-id-broken" style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                          {mentor.korisnickoIme}
                        </div>
                      </div>
                      <button
                        className="action-btn abEdit"
                        onClick={() => handleAddMentor(mentor.id)}
                        type="button"
                        style={{ marginLeft: '1rem' }}
                      >
                        <Icon icon="solar:add-circle-broken" /> Dodaj
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected mentors */}
              {inputs.mentorId?.length > 0 && (
                <div>
                  <div style={{
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'rgb(var(--isticanje))'
                  }}>
                    Dodani mentori ({inputs.mentorId.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {mentors
                      .filter(mentor => inputs.mentorId.includes(mentor.id))
                      .map((mentor) => (
                        <div
                          key={mentor.id}
                          style={{
                            background: 'rgba(var(--isticanje), 0.05)',
                            padding: '1rem',
                            borderRadius: 'var(--radius)',
                            border: '1px solid rgba(var(--isticanje), 0.2)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600 }}>{mentor.ime} {mentor.prezime}</div>
                            <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
                              {mentor.korisnickoIme}
                            </div>
                          </div>
                          {mentorToRemove === mentor.id ? (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                className="action-btn abDelete"
                                type="button"
                                onClick={() => handleRemoveMentor(mentor.id)}
                              >
                                <Icon icon="solar:trash-bin-trash-broken" /> Ukloni
                              </button>
                              <button
                                className="action-btn abEdit"
                                type="button"
                                onClick={() => setMentorToRemove(null)}
                              >
                                <Icon icon="solar:close-circle-broken" /> Odustani
                              </button>
                            </div>
                          ) : (
                            <button
                              className="action-btn abDelete"
                              onClick={() => setMentorToRemove(mentor.id)}
                              type="button"
                            >
                              <Icon icon="solar:trash-bin-trash-broken" />
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

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
              <div className="korisnik-detalji-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
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
              <div className="korisnik-detalji-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
              <div className="korisnik-detalji-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
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
              {!selfService && (
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
                  <div
                    className={`checkbox-item ${inputs.pohadjaTeoriju ? 'checked' : ''}`}
                    onClick={() => { if (!selfService) setInputs((prev) => ({ ...prev, pohadjaTeoriju: !prev.pohadjaTeoriju })); }}
                    style={{ margin: 0, cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      id="pohadjaTeoriju"
                      checked={inputs.pohadjaTeoriju}
                      onChange={() => { if (!selfService) setInputs((prev) => ({ ...prev, pohadjaTeoriju: !prev.pohadjaTeoriju })); }}
                      style={{ display: 'none' }}
                      disabled={!!selfService}
                    />
                    {inputs.pohadjaTeoriju ? '✓ Da' : '✗ Ne'}
                  </div>
                </div>
              )}

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
                  disabled={!!selfService}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Fixed Action Buttons */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--iznad)',
          borderTop: '2px solid rgba(var(--isticanje), 0.3)',
          padding: '1rem',
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'center',
          flexWrap: 'wrap',
          zIndex: 1000,
          boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)'
        }}>
          <button
            className="gumb action-btn zatvoriBtn"
            onClick={() => onCancel()}
            type="button"
          >
            <Icon icon="solar:close-circle-broken" /> Zatvori
          </button>
          <button
            className="gumb action-btn spremiBtn"
            type="submit"
            disabled={isSaving}
          >
            <Icon icon={isSaving ? "solar:loading-bold-duotone" : "solar:diskette-broken"} className={isSaving ? "spin" : ""} />
            {isSaving ? 'Spremanje...' : 'Spremi promjene'}
          </button>
          {!selfService && !showResetConfirm ? (
            <button
              className="gumb action-btn abExpand"
              type="button"
              onClick={() => setShowResetConfirm(true)}
            >
              <Icon icon="solar:lock-password-broken" /> Resetiraj lozinku
            </button>
          ) : (!selfService && (
            <>
              <button
                className="gumb action-btn abDelete"
                type="button"
                onClick={() => setShowResetConfirm(false)}
              >
                <Icon icon="solar:close-square-broken" /> Odustani
              </button>
              <button
                className="gumb action-btn abEdit"
                type="button"
                onClick={handlePasswordReset}
                disabled={isResetting}
              >
                <Icon icon={isResetting ? "solar:loading-bold-duotone" : "solar:check-square-broken"} className={isResetting ? "spin" : ""} />
                {isResetting ? 'Resetiranje...' : 'Resetiraj'}
              </button>
            </>
          ))}
        </div>
      </form>
    </Modal>
  );
};

export default KorisnikDetalji;
