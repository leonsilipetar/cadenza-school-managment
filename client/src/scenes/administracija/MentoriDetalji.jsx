import React, { useEffect, useState } from 'react';
import axios from 'axios';
import ApiConfig from '../../components/apiConfig.js';
import { Icon } from '@iconify/react';
import { showNotification } from '../../components/Notifikacija';
import Modal from '../../components/Modal';

const MentorDetalji = ({ korisnikId, onCancel, selfService = false, onSave }) => {
  const [inputs, setInputs] = useState({
    korisnickoIme: '',
    email: '',
    ime: '',
    prezime: '',
    isAdmin: false,
    isMentor: true,
    isStudent: false,
    oib: '',
    programs: [],
    brojMobitela: '',
    datumRodjenja: '',
    adresa: {
      ulica: '',
      kucniBroj: '',
      mjesto: '',
    },
    napomene: '',
    studentId: [],
    removedStudents: [],
    schoolId: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [studentInput, setStudentInput] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [schools, setSchools] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [programInput, setProgramInput] = useState('');
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [programToRemove, setProgramToRemove] = useState(null);

  const fetchMentorDetails = async () => {
    try {
      const res = await ApiConfig.api.get(`/api/mentori/${korisnikId}`);
      const data = res.data;

      // Format date if exists
      const formattedDate = data.datumRodjenja ?
        new Date(data.datumRodjenja).toISOString().split('T')[0] :
        '';

      // Set the main inputs
      setInputs({
        ...data,
        datumRodjenja: formattedDate,
        adresa: data.adresa || { ulica: '', kucniBroj: '', mjesto: '' },
        napomene: Array.isArray(data.napomene) ? data.napomene.join('\n') : (data.napomene || ''),
        studentId: data.studentId || [],
        removedStudents: [] // Initialize empty array for removedStudents
      });

      // Set programs if they exist
      if (data.programs && Array.isArray(data.programs)) {
        setSelectedPrograms(data.programs);
      }

      // Fetch and set students if studentId array exists
      if (data.studentId && Array.isArray(data.studentId) && data.studentId.length > 0) {
        const studentPromises = data.studentId.map(id =>
          ApiConfig.api.get(`/api/korisnik/${id}`)
            .then(response => ({ status: 'fulfilled', value: response.data.user, id }))
            .catch(error => ({ status: 'rejected', reason: error, id }))
        );

        const settledStudentResults = await Promise.all(studentPromises);

        const studentDetails = settledStudentResults.map(result => {
          if (result.status === 'fulfilled') {
            return result.value; // This is the user object
          } else {
            console.error(`Error fetching student details for ID ${result.id}:`, result.reason);
            // Return a placeholder object for display
            return {
              id: result.id,
              error: true,
              korisnickoIme: `Greška pri učitavanju (ID: ${result.id})`, // Main display for error
              ime: 'N/A', // Placeholder if 'ime' is expected by rendering logic
              prezime: '',  // Placeholder if 'prezime' is expected
              brojMobitela: '-',
              email: '-',
            };
          }
        });

        setSelectedStudents(studentDetails);

        if (settledStudentResults.some(r => r.status === 'rejected')) {
          showNotification('warning', 'Neki podaci učenika nisu mogli biti učitani. Prikazani su s greškom.');
        }
      } else if (data.studentId && Array.isArray(data.studentId) && data.studentId.length === 0) {
        // Ensure selectedStudents is empty if there are no student IDs
        setSelectedStudents([]);
      }
    } catch (err) {
      console.error(err);
      showNotification('error', 'Greška pri dohvaćanju detalja mentora');
    }
  };

  const handleDelete = async () => {
    try {
      await ApiConfig.api.delete(`/api/mentori/${korisnikId}`);
      onCancel(); // Close details view
      showNotification('success', 'Mentor uspješno obrisan');
    } catch (err) {
      console.error(err);
      showNotification('error', 'Greška pri brisanju mentora');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setInputs(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value || ''
        }
      }));
    } else {
      setInputs(prev => ({
        ...prev,
        [name]: value || ''
      }));
    }
  };

  const fetchAllStudents = async () => {
    try {
      const res = await ApiConfig.api.get('/api/all-students');
      setAllStudents(res.data);
    } catch (error) {
      console.error('Error fetching students:', error);
      showNotification('error', 'Greška pri dohvaćanju učenika');
    }
  };

  const handleSearch = async (e) => {
    const query = e.target.value || '';
    setStudentInput(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await ApiConfig.api.get('/api/users', {
        params: { searchTerm: query }
      });

      if (res.data) {
        const students = Array.isArray(res.data) ? res.data : res.data || [];
        const mappedResults = students
          .filter(student => student && student.isStudent)
          .map(student => ({
            ...student,
            isAssigned: selectedStudents.some(s => s.id === student.id)
          }));
        setSearchResults(mappedResults);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  };

  const handleAddStudent = async (studentId) => {
    try {
      const student = searchResults.find(s => s.id === studentId);
      if (!student) return;

      // Check if student is already in selectedStudents
      const isDuplicate = selectedStudents.some(s => s.id === studentId);
      if (isDuplicate) {
        showNotification('warning', 'Učenik je već dodan');
        return;
      }

      setSelectedStudents(prev => [...prev, student]);
      setInputs(prev => ({
        ...prev,
        studentId: [...(prev.studentId || []), studentId],
        removedStudents: (prev.removedStudents || []).filter(id => id !== studentId)
      }));
      setSearchResults(prev =>
        prev.map(s => s.id === studentId ? { ...s, isAssigned: true } : s)
      );
      setStudentInput('');
      showNotification('success', 'Učenik uspješno dodan');
    } catch (error) {
      console.error('Error adding student:', error);
      showNotification('error', 'Greška pri dodavanju učenika');
    }
  };

  const handleRemoveStudent = async (studentId) => {
    try {

      setSelectedStudents(prev => prev.filter(student => student.id !== studentId));
      setInputs(prev => {
        const newInputs = {
          ...prev,
          studentId: prev.studentId.filter(id => id !== studentId),
          removedStudents: [...(prev.removedStudents || []), studentId]
        };
        return newInputs;
      });

      setSearchResults(prev =>
        prev.map(s => s.id === studentId ? { ...s, isAssigned: false } : s)
      );
      setStudentToRemove(null);
      showNotification('success', 'Učenik uspješno uklonjen');
    } catch (error) {
      console.error('Error removing student:', error);
      showNotification('error', 'Greška pri uklanjanju učenika');
    }
  };

  const handleAddProgram = async (programId) => {
    try {
      const program = programs.find(p => p.id === programId);
      if (!program) return;

      // Check if program is already added
      const isDuplicate = selectedPrograms.some(p => p.id === programId);
      if (isDuplicate) {
        showNotification('warning', 'Program je već dodan');
        return;
      }

      // Add to selected programs
      setSelectedPrograms(prev => [...prev, program]);

      // Update inputs state with new program IDs
      setInputs(prev => ({
        ...prev,
        programs: [...(prev.programs || []), programId]
      }));

      setProgramInput('');
      showNotification('success', 'Program uspješno dodan');
    } catch (err) {
      console.error('Error adding program:', err);
      showNotification('error', 'Greška pri dodavanju programa');
    }
  };

  const handleRemoveProgram = async (programId) => {
    try {
      setSelectedPrograms(prev => prev.filter(program => program.id !== programId));

      // Update inputs.programs array to reflect the removal
      setInputs(prev => ({
        ...prev,
        programs: prev.programs.filter(id => id !== programId)
      }));

      showNotification('success', 'Program uspješno uklonjen');
    } catch (err) {
      console.error('Error removing program:', err);
      showNotification('error', 'Greška pri uklanjanju programa');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {

      // Format the data for update
      const updateData = {
        ...inputs,
        programs: selectedPrograms?.map(program => program.id) || [],
        studentId: selectedStudents?.map(student => student.id) || [],
        removedStudents: inputs.removedStudents || [],
        napomene: inputs.napomene ? [inputs.napomene] : [],
        adresa: inputs.adresa || {
          ulica: '',
          kucniBroj: '',
          mjesto: ''
        },
        isAdmin: Boolean(inputs.isAdmin),
        isMentor: true,
        isStudent: Boolean(inputs.isStudent)
      };


      const response = await ApiConfig.api.put(`/api/mentori/${korisnikId}`, updateData);


      showNotification('success', 'Uspješno spremljene promjene');

      // Reset removedStudents after successful save
      setInputs(prev => ({ ...prev, removedStudents: [] }));
      
      // Call onSave callback if provided (for React Query cache invalidation)
      if (onSave) {
        onSave();
      }
      
      // Close modal after successful save
      onCancel();
    } catch (error) {
      console.error('Error updating mentor:', error);
      showNotification('error', error.response?.data?.message || 'Greška pri ažuriranju mentora.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    try {
      setIsResetting(true);
      await ApiConfig.api.post('/api/reset-password', {
        userId: korisnikId,
        userType: 'mentor',
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

  const fetchPrograms = async () => {
    try {
      const userRes = await ApiConfig.api.get('/api/user');
      const programsRes = await ApiConfig.api.get(`/api/programs?school=${userRes.data.user.school}`);
      setPrograms(Array.isArray(programsRes.data) ? programsRes.data : []);
    } catch (err) {
      console.error('Error fetching programs:', err);
      showNotification('error', 'Greška pri dohvaćanju programa');
    }
  };

  useEffect(() => {
    fetchMentorDetails();
    fetchAllStudents();
    fetchPrograms();
  }, [korisnikId]);

  useEffect(() => {
    const fetchSchools = async () => {
      try {
        const res = await ApiConfig.api.get('/api/schools');
        setSchools(res.data);
      } catch (error) {
        console.error('Error fetching schools:', error);
        showNotification('error', 'Greška pri učitavanju škola');
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
          {selfService ? 'Moj profil' : 'Detalji mentora'}
        </>
      }
      maxWidth="900px"
      isFormModal={true}
    >
      <form onSubmit={handleSubmit} style={{ paddingBottom: '100px' }}>
        <style>{`
          @media (max-width: 768px) {
            .mentor-detalji-grid {
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
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Korisničko ime
                </label>
                <input
                  className="input-login-signup"
                  type="text"
                  name="korisnickoIme"
                  value={inputs.korisnickoIme || ''}
                  onChange={handleChange}
                  placeholder="Korisničko ime"
                  disabled={!!selfService}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Email <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  className="input-login-signup"
                  type="email"
                  name="email"
                  value={inputs.email || ''}
                  onChange={handleChange}
                  placeholder="primjer@email.com"
                  required
                  disabled={!!selfService}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  OIB
                </label>
                <input
                  className="input-login-signup"
                  type="text"
                  name="oib"
                  value={inputs.oib || ''}
                  onChange={handleChange}
                  placeholder="11 znamenki"
                  maxLength={11}
                  pattern="\d{11}"
                  disabled={!!selfService}
                  style={{ width: '100%' }}
                />
              </div>

              <div className="mentor-detalji-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Ime
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    name="ime"
                    value={inputs.ime || ''}
                    onChange={handleChange}
                    placeholder="Ime"
                    disabled={!!selfService}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Prezime
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    name="prezime"
                    value={inputs.prezime || ''}
                    onChange={handleChange}
                    placeholder="Prezime"
                    disabled={!!selfService}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="mentor-detalji-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Datum rođenja
                  </label>
                  <input
                    className="input-login-signup"
                    type="date"
                    name="datumRodjenja"
                    value={inputs.datumRodjenja || ''}
                    onChange={handleChange}
                    disabled={!!selfService}
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Broj mobitela
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    name="brojMobitela"
                    value={inputs.brojMobitela || ''}
                    onChange={handleChange}
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
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
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
              {programs.length > 0 && programInput.length > 0 && (
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
                  {programs
                    .filter(program =>
                      program.naziv.toLowerCase().includes(programInput.toLowerCase()) &&
                      !selectedPrograms.some(p => p.id === program.id)
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
                        <div style={{ fontWeight: 500 }}>{program.naziv}</div>
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
                          border: '1px solid rgba(var(--isticanje), 0.2)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{program.naziv}</div>
                        {programToRemove === program.id ? (
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
                            onClick={() => setProgramToRemove(program.id)}
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
              <div className="mentor-detalji-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Ulica
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    name="adresa.ulica"
                    value={inputs.adresa?.ulica || ''}
                    onChange={handleChange}
                    placeholder="Naziv ulice"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                    Broj
                  </label>
                  <input
                    className="input-login-signup"
                    type="text"
                    name="adresa.kucniBroj"
                    value={inputs.adresa?.kucniBroj || ''}
                    onChange={handleChange}
                    placeholder="Broj"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Mjesto
                </label>
                <input
                  className="input-login-signup"
                  type="text"
                  name="adresa.mjesto"
                  value={inputs.adresa?.mjesto || ''}
                  onChange={handleChange}
                  placeholder="Grad/Mjesto"
                  style={{ width: '100%' }}
                />
              </div>
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
              <Icon icon="solar:notes-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Dodatne informacije
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {!selfService && (
                <div
                  className={`radio-item ${inputs.isAdmin ? 'checked' : ''}`}
                  onClick={() => setInputs(prev => ({ ...prev, isAdmin: !prev.isAdmin }))}
                  style={{
                    padding: '1rem',
                    border: '2px solid rgba(var(--isticanje), 0.3)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    background: inputs.isAdmin ? 'rgba(var(--isticanje), 0.1)' : 'transparent',
                    transition: 'all 0.2s',
                    textAlign: 'center',
                    fontWeight: 600
                  }}
                >
                  <input
                    type="radio"
                    id="isAdmin"
                    checked={inputs.isAdmin}
                    onChange={() => setInputs(prev => ({ ...prev, isAdmin: !prev.isAdmin }))}
                    style={{ display: 'none' }}
                  />
                  <Icon
                    icon={inputs.isAdmin ? "solar:shield-check-bold" : "solar:shield-broken"}
                    style={{ verticalAlign: 'middle', marginRight: '0.5rem', fontSize: '1.2rem' }}
                  />
                  {inputs.isAdmin ? 'Administrator' : 'Nije administrator'}
                </div>
              )}

              <div>
                <label htmlFor="kor-napomene" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Napomene
                </label>
                <textarea
                  className="input-login-signup"
                  value={inputs.napomene || ''}
                  onChange={(e) => setInputs(prev => ({ ...prev, napomene: e.target.value || '' }))}
                  name="napomene"
                  id="kor-napomene"
                  placeholder="Unesite napomene o mentoru..."
                  maxLength={5000}
                  rows={4}
                  disabled={!!selfService}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
            </div>
          </div>

          {/* Students Section */}
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem'
            }}>
              <Icon icon="solar:users-group-rounded-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Učenici
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                  Pretraži i dodaj učenike
                </label>
                <input
                  className="input-login-signup"
                  type="text"
                  value={studentInput}
                  onChange={handleSearch}
                  placeholder="Počni tipkati za pretragu učenika..."
                  style={{ width: '100%' }}
                />
              </div>

              {/* Student search results */}
              {searchResults?.length > 0 && (
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
                  {searchResults.map((student) => (
                    <div
                      key={student.id}
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
                        <div style={{ fontWeight: 500 }}>{student.ime} {student.prezime}</div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
                          <Icon icon="solar:user-id-broken" style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                          {student.korisnickoIme}
                        </div>
                      </div>
                      {student.isAssigned ? (
                        <button
                          className="action-btn abDelete"
                          type="button"
                          onClick={() => handleRemoveStudent(student.id)}
                          style={{ marginLeft: '1rem' }}
                        >
                          <Icon icon="solar:trash-bin-trash-broken" /> Ukloni
                        </button>
                      ) : (
                        <button
                          className="action-btn abEdit"
                          onClick={() => handleAddStudent(student.id)}
                          type="button"
                          style={{ marginLeft: '1rem' }}
                        >
                          <Icon icon="solar:add-circle-broken" /> Dodaj
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Selected students */}
              {selectedStudents.length > 0 && (
                <div>
                  <div style={{
                    fontWeight: 600,
                    marginBottom: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'rgb(var(--isticanje))'
                  }}>
                    Dodani učenici ({selectedStudents.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {selectedStudents.map((student) => (
                      <div
                        key={student.id}
                        style={{
                          background: student.error ? 'rgba(255, 0, 0, 0.05)' : 'rgba(var(--isticanje), 0.05)',
                          padding: '1rem',
                          borderRadius: 'var(--radius)',
                          border: `1px solid ${student.error ? 'rgba(255, 0, 0, 0.2)' : 'rgba(var(--isticanje), 0.2)'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          {student.error ? (
                            <div style={{ color: 'red', fontStyle: 'italic' }}>
                              {student.korisnickoIme}
                            </div>
                          ) : (
                            <>
                              <div style={{ fontWeight: 600 }}>
                                {student.ime && student.prezime
                                  ? `${student.ime} ${student.prezime}`
                                  : student.korisnickoIme}
                              </div>
                              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
                                <Icon icon="solar:phone-broken" style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                                {student.brojMobitela || '-'} • {student.email || '-'}
                              </div>
                            </>
                          )}
                        </div>
                        {studentToRemove === student.id ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              className="action-btn abDelete"
                              type="button"
                              onClick={() => handleRemoveStudent(student.id)}
                            >
                              <Icon icon="solar:trash-bin-trash-broken" /> Ukloni
                            </button>
                            <button
                              className="action-btn abEdit"
                              type="button"
                              onClick={() => setStudentToRemove(null)}
                            >
                              <Icon icon="solar:close-circle-broken" /> Odustani
                            </button>
                          </div>
                        ) : (
                          <button
                            className="action-btn abDelete"
                            onClick={() => setStudentToRemove(student.id)}
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

export default MentorDetalji;
