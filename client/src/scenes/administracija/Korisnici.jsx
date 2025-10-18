import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Icon } from '@iconify/react';
import NavigacijaAdmin from './NavigacijaAdmin';
import NavTopAdministracija from './NavTopAdmin.jsx';
import DodajKorisnika from './DodajKorisnika';
import KorisnikDetalji from './KorisnikDetalji';
import Modal from '../../components/Modal';
import ApiConfig from '../../components/apiConfig';
import LoadingShell from '../../components/LoadingShell';
import showNotification from '../../components/Notifikacija.jsx';
import { useAdminUsers, useInvalidateAdminUsers } from '../../hooks/useAdminUsers';

axios.defaults.withCredentials = true;

const Korisnici = () => {
  const [odabranoDodajKorisnika, setOdabranoDodajKOrisnika] = useState(false);
  const [korisnikDetaljiOtvoreno, setKorisnikDetaljiOtvoreno] = useState(null);
  const [notification, setNotification] = useState(null);

  // State for schoolId (fetched from profile)
  const [schoolId, setSchoolId] = useState(null);
  const [user, setUser] = useState();
  const [isHovered, setIsHovered] = useState(false);
  
  // REACT QUERY: Use hook for admin users - automatic caching!
  const { data: usersData = [], isLoading, refetch: refetchUsers } = useAdminUsers(schoolId);
  const invalidateUsers = useInvalidateAdminUsers();
  
  // Keep a local copy for filtering (sorted)
  const [korisnici, setKorisnici] = useState([]);
  const otvoreno = 'korisnici';
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredKorisnici, setFilteredKorisnici] = useState([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState(null); // { toCreate, duplicates, errors }
  const [editableRows, setEditableRows] = useState([]); // local editable copy of toCreate
  const [selectedForCommit, setSelectedForCommit] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [usersWithoutMentors, setUsersWithoutMentors] = useState([]);
  const [usersWithoutSchool, setUsersWithoutSchool] = useState([]);
  const [usersWithoutPrograms, setUsersWithoutPrograms] = useState([]);
  const [usersNotAccepted, setUsersNotAccepted] = useState([]);
  const [usersGlazbenoOpism, setUsersGlazbenoOpism] = useState([]);
  const [usersMaiZbor, setUsersMaiZbor] = useState([]);

  // New state for programs and enrollment years
  const [programs, setPrograms] = useState([]);
  const [enrollmentYears, setEnrollmentYears] = useState([]);
  const [usersByProgram, setUsersByProgram] = useState({});
  const [usersByEnrollmentYear, setUsersByEnrollmentYear] = useState({});
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderScope, setReminderScope] = useState('notAccepted');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState(new Set());
  const [customMessage, setCustomMessage] = useState('');
  const [showMobileActionsMenu, setShowMobileActionsMenu] = useState(false);
  const [showMobileFiltersMenu, setShowMobileFiltersMenu] = useState(false);

  // Helper function to determine enrollment year based on creation date
  const getEnrollmentYear = (createdAt) => {
    if (!createdAt) return 'unknown';

    const date = new Date(createdAt);
    const month = date.getMonth() + 1; // getMonth() returns 0-11
    const year = date.getFullYear();

    // 24/25: Sept-Dec 2024 (9-12) + Jan-June 2025 (1-6)
    // 25/26: July-Dec 2025 (7-12) + Jan-June 2026 (1-6)
    if ((month >= 9 && month <= 12 && year === 2024) ||
        (month >= 1 && month <= 6 && year === 2025)) {
      return '24/25';
    } else if ((month >= 7 && month <= 12 && year === 2025) ||
               (month >= 1 && month <= 6 && year === 2026)) {
      return '25/26';
    } else if ((month >= 9 && month <= 12 && year === 2023) ||
               (month >= 1 && month <= 6 && year === 2024)) {
      return '23/24';
    } else if ((month >= 7 && month <= 12 && year === 2024) ||
               (month >= 1 && month <= 6 && year === 2025)) {
      return '24/25';
    } else if ((month >= 7 && month <= 12 && year === 2025) ||
               (month >= 1 && month <= 6 && year === 2026)) {
      return '25/26';
    } else if ((month >= 7 && month <= 12 && year === 2026) ||
               (month >= 1 && month <= 6 && year === 2027)) {
      return '26/27';
    }

    return 'other';
  };

  // REACT QUERY: sendRequestUsers removed - now handled by useAdminUsers hook

  const sendRequest = async () => {
    try {
      const res = await ApiConfig.api.get('/api/profil');
      return res.data;
    } catch (err) {
      console.error(err);
      throw err; // Let the caller handle the error
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await ApiConfig.api.get('/api/programs');
      return res.data || [];
    } catch (err) {
      console.error('Error fetching programs:', err);
      return [];
    }
  };

  const handleDodajKorisnika = () => {
    // Logic for handling the addition of a new user
    // e.g., refetch the user list or perform other actions
    console.log('Adding user logic here');
  };

  const handleCancelDodajKorisnika = () => {
    setOdabranoDodajKOrisnika(false);
  };

  const getUserRoles = (user) => {
    const roles = [];

    if (user.isAdmin) {
      roles.push('administrator');
    }

    if (user.isMentor) {
      roles.push('mentor');
    }

    if (user.isStudent) {
      roles.push('student');
    }

    return roles.length > 0 ? roles.join(', ') : 'bez uloge';
  };

  // Process users to group them by program and enrollment year
  const processUsersForFiltering = (usersData) => {
    const programsMap = {};
    const enrollmentYearsMap = {};

    usersData.forEach(user => {
      // Group by program
      if (user.programs && user.programs.length > 0) {
        user.programs.forEach(program => {
          if (!programsMap[program.id]) {
            programsMap[program.id] = {
              id: program.id,
              naziv: program.naziv,
              count: 0,
              users: []
            };
          }
          programsMap[program.id].count++;
          programsMap[program.id].users.push(user);
        });
      }

      // Group by enrollment year
      const enrollmentYear = getEnrollmentYear(user.createdAt);
      if (!enrollmentYearsMap[enrollmentYear]) {
        enrollmentYearsMap[enrollmentYear] = {
          year: enrollmentYear,
          count: 0,
          users: []
        };
      }
      enrollmentYearsMap[enrollmentYear].count++;
      enrollmentYearsMap[enrollmentYear].users.push(user);
    });

    return { programsMap, enrollmentYearsMap };
  };

  // Sort users alphabetically by last name, then first name
  const sortUsers = (users) => {
    return [...users].sort((a, b) => {
      const lastNameCompare = (a.prezime || '').localeCompare(b.prezime || '', 'hr');
      if (lastNameCompare !== 0) return lastNameCompare;
      return (a.ime || '').localeCompare(b.ime || '', 'hr');
    });
  };

  // Fetch profile and programs on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [userData, programsData] = await Promise.all([
          sendRequest(),
          fetchPrograms()
        ]);

        setUser(userData.user);
        setSchoolId(userData.user.schoolId); // This triggers React Query fetch
        setPrograms(programsData);
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();
  }, []);

  // Process usersData when it changes from React Query
  useEffect(() => {
    if (!usersData || usersData.length === 0) return;

    // Sort users alphabetically
    const sortedUsers = sortUsers(usersData);

    setKorisnici(sortedUsers);
    setFilteredKorisnici(sortedUsers);

    // Filter users without mentors (use sorted data)
    const withoutMentors = sortUsers(sortedUsers.filter(user => !user.mentorId || user.mentorId.length === 0));
    setUsersWithoutMentors(withoutMentors);

    // Filter users without school
    const withoutSchool = sortUsers(sortedUsers.filter(user => !user.schoolId));
    setUsersWithoutSchool(withoutSchool);

    // Filter users without programs
    const withoutPrograms = sortUsers(sortedUsers.filter(user => !user.programs || user.programs.length === 0));
    setUsersWithoutPrograms(withoutPrograms);

    // Users who have not accepted enrollment terms
    const notAccepted = sortUsers(sortedUsers.filter(user => {
      const hasEnrollments = Array.isArray(user.enrollments) && user.enrollments.length > 0;
      if (!hasEnrollments) return true;
      return user.enrollments.some(e => e.active && !e.agreementAccepted);
    }));
    setUsersNotAccepted(notAccepted);

    // Users attending "glazbeno opismenjavanje" (theory)
    const theoryUsers = sortUsers(sortedUsers.filter(user => Boolean(user.pohadjaTeoriju)));
    setUsersGlazbenoOpism(theoryUsers);

    // Users in MAI choir program (by program name contains 'zbor')
    const choirUsers = sortUsers(sortedUsers.filter(user => {
      const programsArr = Array.isArray(user?.programs) ? user.programs : [];
      return programsArr.some(p => (p?.naziv || '').toString().toLowerCase().includes('zbor'));
    }));
    setUsersMaiZbor(choirUsers);

    // Process users for filtering
    const { programsMap, enrollmentYearsMap } = processUsersForFiltering(sortedUsers);
    setUsersByProgram(programsMap);
    setUsersByEnrollmentYear(enrollmentYearsMap);

    // Get unique enrollment years for tabs
    const uniqueYears = Object.keys(enrollmentYearsMap).filter(year => year !== 'unknown' && year !== 'other');
    setEnrollmentYears(uniqueYears.sort());
  }, [usersData]);

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    if (!korisnici || !Array.isArray(korisnici)) {
      setFilteredKorisnici([]);
      return;
    }

    const filtered = korisnici.filter(korisnik => {
      const fullName = `${korisnik.ime || ''} ${korisnik.prezime || ''}`.toLowerCase();
      const username = (korisnik.korisnickoIme || '').toLowerCase();
      const email = (korisnik.email || '').toLowerCase();
      const oib = (korisnik.oib || '').toLowerCase();

      // Add address search
      const address = korisnik.adresa ?
        `${korisnik.adresa.ulica || ''} ${korisnik.adresa.kucniBroj || ''} ${korisnik.adresa.mjesto || ''}`.toLowerCase()
        : '';

      // Add parents search
      const parent1 = korisnik.roditelj1 ?
        `${korisnik.roditelj1.ime || ''} ${korisnik.roditelj1.prezime || ''} ${korisnik.roditelj1.brojMobitela || ''}`.toLowerCase()
        : '';
      const parent2 = korisnik.roditelj2 ?
        `${korisnik.roditelj2.ime || ''} ${korisnik.roditelj2.prezime || ''} ${korisnik.roditelj2.brojMobitela || ''}`.toLowerCase()
        : '';

      return fullName.includes(term) ||
             username.includes(term) ||
             email.includes(term) ||
             oib.includes(term) ||
             address.includes(term) ||
             parent1.includes(term) ||
             parent2.includes(term);
    });

    setFilteredKorisnici(filtered);
  };

  const handleBulkUpload = async () => {
    try {
      if (!selectedFile) {
        setNotification({
          type: 'error',
          message: 'Molimo odaberite XLSX datoteku'
        });
        return;
      }

      setIsUploading(true);
      setProgressMessage('Priprema pregleda...');

      const formData = new FormData();
      formData.append('file', selectedFile);

      // Step 1: Preview on server
      const previewResp = await ApiConfig.api.post('/api/users/bulk-upload/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          setProgressMessage(`Prijenos: ${percentCompleted}%`);
        }
      });

      const data = previewResp.data;
      setPreviewData(data);
      const editable = (data?.toCreate || []).map(u => ({ ...u }));
      setEditableRows(editable);
      setSelectedForCommit(new Set(editable.map((_, idx) => idx))); // preselect all
      setShowPreviewModal(true);
    } catch (error) {
      console.error('Error uploading users:', error);
      setNotification({
        type: 'error',
        message: error.response?.data?.message || 'Greška pri učitavanju korisnika / pregledu'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setProgressMessage('');
    }
  };

  // Refresh users data
  const refreshUsers = async () => {
    try {
      // REACT QUERY: Just invalidate, will auto-refetch
      invalidateUsers();
      const sortedUsers = sortUsers(usersData);
      setKorisnici(sortedUsers);

      // Refresh filtered lists
      const withoutMentors = sortUsers(sortedUsers.filter(user => !user.mentorId || user.mentorId.length === 0));
      setUsersWithoutMentors(withoutMentors);

      const withoutSchool = sortUsers(sortedUsers.filter(user => !user.schoolId));
      setUsersWithoutSchool(withoutSchool);

      const withoutPrograms = sortUsers(sortedUsers.filter(user => !user.programs || user.programs.length === 0));
      setUsersWithoutPrograms(withoutPrograms);

      const notAccepted = sortUsers(sortedUsers.filter(user => {
        const hasEnrollments = Array.isArray(user.enrollments) && user.enrollments.length > 0;
        if (!hasEnrollments) return true;
        return user.enrollments.some(e => e.active && !e.agreementAccepted);
      }));
      setUsersNotAccepted(notAccepted);

      const theoryUsers = sortUsers(sortedUsers.filter(user => Boolean(user.pohadjaTeoriju)));
      setUsersGlazbenoOpism(theoryUsers);

      const choirUsers = sortUsers(sortedUsers.filter(user => {
        const programsArr = Array.isArray(user?.programs) ? user.programs : [];
        return programsArr.some(p => (p?.naziv || '').toString().toLowerCase().includes('zbor'));
      }));
      setUsersMaiZbor(choirUsers);

      // Reprocess for filtering
      const { programsMap, enrollmentYearsMap } = processUsersForFiltering(sortedUsers);
      setUsersByProgram(programsMap);
      setUsersByEnrollmentYear(enrollmentYearsMap);

      // Update filtered list based on active tab
      if (activeTab === 'without-mentors') {
        setFilteredKorisnici(withoutMentors);
      } else if (activeTab === 'without-school') {
        setFilteredKorisnici(withoutSchool);
      } else if (activeTab === 'without-programs') {
        setFilteredKorisnici(withoutPrograms);
      } else if (activeTab === 'not-accepted') {
        setFilteredKorisnici(notAccepted);
      } else if (activeTab === 'theory') {
        setFilteredKorisnici(theoryUsers);
      } else if (activeTab === 'mai-choir') {
        setFilteredKorisnici(choirUsers);
      } else if (activeTab.startsWith('program-')) {
        const programId = activeTab.replace('program-', '');
        const programUsers = sortUsers(programsMap[programId]?.users || []);
        setFilteredKorisnici(programUsers);
      } else if (activeTab.startsWith('year-')) {
        const year = activeTab.replace('year-', '');
        const yearUsers = sortUsers(enrollmentYearsMap[year]?.users || []);
        setFilteredKorisnici(yearUsers);
      } else {
        setFilteredKorisnici(sortedUsers);
      }
    } catch (err) {
      console.error('Error refreshing users:', err);
      showNotification({ type: 'error', message: 'Greška pri osvježavanju korisnika' });
    }
  };

  const handleCommitSelected = async () => {
    try {
      const toSend = Array.from(selectedForCommit).map(idx => editableRows[idx]);
      if (toSend.length === 0) {
        setNotification({ type: 'error', message: 'Niste odabrali niti jednog korisnika' });
        return;
      }
      setIsUploading(true);
      const resp = await ApiConfig.api.post('/api/users/bulk-upload/commit', { users: toSend });
      setNotification({
        type: 'success',
        message: `Dodano: ${resp.data.successCount || 0}, preskočeno/greške: ${resp.data.errorCount || 0}`
      });
      // Cleanup and refresh
      setShowPreviewModal(false);
      setShowBulkUpload(false);
      setSelectedFile(null);
      setPreviewData(null);
      setEditableRows([]);
      setSelectedForCommit(new Set());
      await refreshUsers();
    } catch (err) {
      console.error('Commit error:', err);
      setNotification({ type: 'error', message: err.response?.data?.message || 'Greška pri spremanju novih korisnika' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm('');

    if (tab === 'without-mentors') {
      setFilteredKorisnici(usersWithoutMentors);
    } else if (tab === 'without-school') {
      setFilteredKorisnici(usersWithoutSchool);
    } else if (tab === 'without-programs') {
      setFilteredKorisnici(usersWithoutPrograms);
    } else if (tab === 'not-accepted') {
      setFilteredKorisnici(usersNotAccepted);
    } else if (tab === 'theory') {
      setFilteredKorisnici(usersGlazbenoOpism);
    } else if (tab === 'mai-choir') {
      setFilteredKorisnici(usersMaiZbor);
    } else if (tab.startsWith('program-')) {
      const programId = tab.replace('program-', '');
      const programUsers = sortUsers(usersByProgram[programId]?.users || []);
      setFilteredKorisnici(programUsers);
    } else if (tab.startsWith('year-')) {
      const year = tab.replace('year-', '');
      const yearUsers = sortUsers(usersByEnrollmentYear[year]?.users || []);
      setFilteredKorisnici(yearUsers);
    } else {
      setFilteredKorisnici(korisnici);
    }
  };

  const exportUsersCSV = () => {
    try {
      const decimalSeparatorIsComma = Intl.NumberFormat().format(1.1).includes(',');
      const delimiter = decimalSeparatorIsComma ? ';' : ',';
      const headers = [
        'Ime',
        'Prezime',
        'Email',
        'Korisničko ime',
        'OIB',
        'Ulica',
        'Broj',
        'Mjesto',
        'Poštanski broj',
        'Država',
        'Mentor',
        'Programi',
        'R1 Ime',
        'R1 Prezime',
        'R1 Mobitel',
        'R1 Email',
        'R2 Ime',
        'R2 Prezime',
        'R2 Mobitel',
        'R2 Email',
        'Datum registracije',
        'Uloga'
      ];

      const rows = (filteredKorisnici || []).map((u) => [
        u.ime || '',
        u.prezime || '',
        u.email || '',
        u.korisnickoIme || '',
        u.oib || '',
        u.adresa?.ulica || '',
        u.adresa?.kucniBroj || '',
        u.adresa?.mjesto || '',
        u.adresa?.postanskiBroj || '',
        u.adresa?.drzava || '',
        u.mentor ? `${u.mentor.ime} ${u.mentor.prezime}` : '',
        u.programs ? u.programs.map(p => p.naziv).join(', ') : '',
        u.roditelj1?.ime || '',
        u.roditelj1?.prezime || '',
        u.roditelj1?.brojMobitela || '',
        u.roditelj1?.email || '',
        u.roditelj2?.ime || '',
        u.roditelj2?.prezime || '',
        u.roditelj2?.brojMobitela || '',
        u.roditelj2?.email || '',
        u.createdAt ? new Date(u.createdAt).toLocaleDateString('hr-HR') : '',
        getUserRoles(u) || ''
      ]);

      const escapeField = (val) => {
        const s = String(val ?? '');
        const escaped = s.replace(/"/g, '""');
        const needsQuotes = escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r') || escaped.includes(delimiter);
        return needsQuotes ? `"${escaped}"` : escaped;
      };

      const lines = [];
      lines.push(`sep=${delimiter}`);
      lines.push(headers.map(escapeField).join(delimiter));
      rows.forEach((row) => {
        lines.push(row.map(escapeField).join(delimiter));
      });
      const csv = lines.join('\r\n');

      const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `korisnici_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export error:', err);
      showNotification({ type: 'error', message: 'Greška pri izvozu CSV datoteke' });
    }
  };

  return (
    <>
      <NavigacijaAdmin otvoreno={otvoreno} />
      <NavTopAdministracija naslov={'Administracija - Korisnici'} />
      {korisnikDetaljiOtvoreno && (
        <KorisnikDetalji
          korisnikId={korisnikDetaljiOtvoreno}
          userData={korisnici.find(k => k.id === korisnikDetaljiOtvoreno)}
          onCancel={async () => {
            setKorisnikDetaljiOtvoreno(false);
            await refreshUsers();
          }}
        />
      )}
      {odabranoDodajKorisnika && (
        <DodajKorisnika
          onDodajKorisnika={handleDodajKorisnika}
          onCancel={handleCancelDodajKorisnika}
        />
      )}
      <div className="main">
        {isLoading ? (
          <LoadingShell />
        ) : (
          <>
            <div className="karticaZadatka" style={{ overflow: 'visible' }}>
              <div className="div-row">
                <span style={{color: 'rgb(var(--isticanje))'}}>Ukupno učenika: {korisnici?.length || 0}</span>
                <div className="p">Dodavanjem korisnika se na njihovu e-mail adresu (pohranjenu u polje za e-mail) šalju njihovi podaci za prijavu: email i lozinka.</div>
                <div className="p" style={{ marginTop: '.25rem' }}>
                  Napomena: Svaki korisnik pri prvoj prijavi u školskoj godini mora prihvatiti uvjete upisa te odabrati program ako ga već nema dodijeljenog. Učenici koji su potvrdili se nalaze na popisu u kartici 'Upisi'.
                </div>
              {/*
              {user && user.schoolId === 1 &&
              (
                <>
                <div className='p acc'>Podaci učenika su ispravljeni...</div>
                <div className='p'>Potencijalne greške: </div>
                <div className='p acc'>Stanić Marina - OIB ima 10 od 11 znamenki, Volarević Leona i Vidaković Sunčica imaju isti OIB?</div>
                </>
              )}
              */}
              </div>

              {/* Desktop actions - all visible */}
              <div className="desktop-actions" style={{
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                marginTop: '1rem',
                gap: '0.5rem',
                flexWrap: 'wrap'
              }}>
                <button
                  className="action-btn abEdit"
                  onClick={() => setOdabranoDodajKOrisnika(true)}
                >
                  <Icon icon="solar:user-plus-broken" fontSize="large" /> Dodaj učenika
                </button>
                <button
                  className="action-btn spremiBtn"
                  onClick={() => setShowBulkUpload(true)}
                >
                  <Icon icon="solar:upload-broken" /> Učitaj iz XLSX
                </button>
                <button
                  className="action-btn abExpand"
                  onClick={exportUsersCSV}
                >
                  <Icon icon="solar:download-broken" /> Izvezi CSV
                </button>
                <button
                  className={`action-btn spremiBtn`}
                  onClick={() => setShowReminderModal(true)}
                >
                  <Icon icon={'solar:mailbox-broken'} />
                  Pošalji podsjetnike za upis
                </button>
              </div>

              {/* Mobile actions - primary button + overflow menu */}
              <div className="mobile-actions" style={{
                fontSize: '0.7rem',
                display: 'none',
                alignItems: 'center',
                marginTop: '1rem',
                gap: '0.5rem',
                position: 'relative'
              }}>
                <button
                  className="action-btn abEdit"
                  onClick={() => setOdabranoDodajKOrisnika(true)}
                  style={{ flex: 1 }}
                >
                  <Icon icon="solar:user-plus-broken" fontSize="large" /> Dodaj učenika
                </button>
                <button
                  className="action-btn abExpand"
                  onClick={() => setShowMobileActionsMenu(!showMobileActionsMenu)}
                  style={{ padding: '0.5rem 0.75rem' }}
                  title="Više akcija"
                >
                  <Icon icon="solar:menu-dots-bold" fontSize="large" />
                </button>

                {/* Mobile actions dropdown */}
                {showMobileActionsMenu && (
                  <>
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 998
                      }}
                      onClick={() => setShowMobileActionsMenu(false)}
                    />
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.5rem',
                      background: 'var(--iznad)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      zIndex: 999,
                      minWidth: '220px',
                      overflow: 'hidden'
                    }}>
                      <button
                        className="action-btn"
                        onClick={() => {
                          setShowBulkUpload(true);
                          setShowMobileActionsMenu(false);
                        }}
                        style={{
                          width: '100%',
                          justifyContent: 'flex-start',
                          borderRadius: 0,
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          background: 'transparent',
                          padding: '0.75rem 1rem'
                        }}
                      >
                        <Icon icon="solar:upload-broken" /> Učitaj iz XLSX
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => {
                          exportUsersCSV();
                          setShowMobileActionsMenu(false);
                        }}
                        style={{
                          width: '100%',
                          justifyContent: 'flex-start',
                          borderRadius: 0,
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          background: 'transparent',
                          padding: '0.75rem 1rem'
                        }}
                      >
                        <Icon icon="solar:download-broken" /> Izvezi CSV
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => {
                          setShowReminderModal(true);
                          setShowMobileActionsMenu(false);
                        }}
                        style={{
                          width: '100%',
                          justifyContent: 'flex-start',
                          borderRadius: 0,
                          border: 'none',
                          background: 'transparent',
                          padding: '0.75rem 1rem'
                        }}
                      >
                        <Icon icon="solar:mailbox-broken" /> Pošalji podsjetnike
                      </button>
                    </div>
                  </>
                )}
              </div>

              <style dangerouslySetInnerHTML={{__html: `
                @media (max-width: 768px) {
                  .desktop-actions {
                    display: none !important;
                  }
                  .mobile-actions {
                    display: flex !important;
                  }
                }
              `}} />
            </div>
            <Modal
              isOpen={showReminderModal}
              onClose={() => {
                if (!isSendingReminders) {
                  setShowReminderModal(false);
                  setSelectedRecipientIds(new Set());
                  setCustomMessage('');
                }
              }}
              title={
                <>
                  <Icon icon="solar:mailbox-broken" />
                  Slanje podsjetnika za upis
                </>
              }
              maxWidth="700px"
              isFormModal={true}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Scope Selection */}
                <div>
                  <h4 style={{
                    fontSize: '1rem',
                    marginBottom: '1rem',
                    color: 'rgb(var(--isticanje))',
                    borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
                    paddingBottom: '0.5rem'
                  }}>
                    <Icon icon="solar:users-group-rounded-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    Odabir primatelja
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div
                      onClick={() => setReminderScope('notAccepted')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: reminderScope === 'notAccepted' ? 'rgba(var(--isticanje), 0.1)' : 'transparent',
                        border: `2px solid ${reminderScope === 'notAccepted' ? 'rgb(var(--isticanje))' : 'rgba(var(--isticanje2), 0.3)'}`,
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontWeight: reminderScope === 'notAccepted' ? 600 : 400 }}>
                        Samo "NISU POTVRDILI UPIS"
                      </span>
                      <span style={{
                        fontWeight: 700,
                        color: reminderScope === 'notAccepted' ? 'rgb(var(--isticanje))' : 'var(--tekst)',
                        fontSize: '1.1rem'
                      }}>
                        {usersNotAccepted.length}
                      </span>
                    </div>

                    <div
                      onClick={() => setReminderScope('all')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: reminderScope === 'all' ? 'rgba(var(--isticanje), 0.1)' : 'transparent',
                        border: `2px solid ${reminderScope === 'all' ? 'rgb(var(--isticanje))' : 'rgba(var(--isticanje2), 0.3)'}`,
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontWeight: reminderScope === 'all' ? 600 : 400 }}>
                        Svi korisnici
                      </span>
                      <span style={{
                        fontWeight: 700,
                        color: reminderScope === 'all' ? 'rgb(var(--isticanje))' : 'var(--tekst)',
                        fontSize: '1.1rem'
                      }}>
                        {korisnici.length}
                      </span>
                    </div>

                    <div
                      onClick={() => setReminderScope('selected')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: reminderScope === 'selected' ? 'rgba(var(--isticanje), 0.1)' : 'transparent',
                        border: `2px solid ${reminderScope === 'selected' ? 'rgb(var(--isticanje))' : 'rgba(var(--isticanje2), 0.3)'}`,
                        borderRadius: 'var(--radius)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span style={{ fontWeight: reminderScope === 'selected' ? 600 : 400 }}>
                        Odabrani korisnici
                      </span>
                      <span style={{
                        fontWeight: 700,
                        color: reminderScope === 'selected' ? 'rgb(var(--isticanje))' : 'var(--tekst)',
                        fontSize: '1.1rem'
                      }}>
                        {selectedRecipientIds.size}
                      </span>
                    </div>
                  </div>
                </div>

                {/* User Selection List */}
                {reminderScope === 'selected' && (
                  <div style={{
                    background: 'rgba(var(--isticanje2), 0.05)',
                    padding: '1rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid rgba(var(--isticanje2), 0.2)'
                  }}>
                    <h4 style={{
                      fontSize: '0.9rem',
                      marginBottom: '0.75rem',
                      color: 'rgb(var(--isticanje))'
                    }}>
                      Odaberi korisnike ({selectedRecipientIds.size} odabrano)
                    </h4>
                    <div style={{
                      maxHeight: '250px',
                      overflow: 'auto',
                      background: 'var(--pozadina)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)'
                    }}>
                      {(filteredKorisnici?.length ? filteredKorisnici : korisnici).map(u => (
                        <label
                          key={u.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'auto 1fr',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            borderBottom: '1px solid var(--border)',
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            background: selectedRecipientIds.has(u.id) ? 'rgba(var(--isticanje), 0.05)' : 'transparent'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(var(--isticanje), 0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = selectedRecipientIds.has(u.id) ? 'rgba(var(--isticanje), 0.05)' : 'transparent'}
                        >
                          <input
                            type="checkbox"
                            checked={selectedRecipientIds.has(u.id)}
                            onChange={(e) => {
                              setSelectedRecipientIds(prev => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(u.id); else next.delete(u.id);
                                return next;
                              });
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>
                            {(u.ime || '') + ' ' + (u.prezime || '')}
                            <span style={{ opacity: 0.6, fontSize: '0.85rem', marginLeft: '0.5rem' }}>({u.email})</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Message */}
                <div>
                  <h4 style={{
                    fontSize: '1rem',
                    marginBottom: '1rem',
                    color: 'rgb(var(--isticanje))',
                    borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
                    paddingBottom: '0.5rem'
                  }}>
                    <Icon icon="solar:letter-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    Poruka
                  </h4>

                  <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                    Prilagođena poruka (opcionalno)
                  </label>
                  <textarea
                    className="input-login-signup"
                    style={{ minHeight: '120px', width: '100%', resize: 'vertical' }}
                    placeholder="Upišite prilagođenu poruku koja će biti dodana osnovnom podsjetnicima..."
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                  />
                </div>

                {/* Action Buttons */}
                <div className="div-radio" style={{
                  borderTop: '1px solid rgba(var(--isticanje2), 0.3)'
                }}>
                  <button
                    className="gumb action-btn zatvoriBtn"
                    onClick={() => {
                      if (!isSendingReminders) {
                        setShowReminderModal(false);
                        setSelectedRecipientIds(new Set());
                        setCustomMessage('');
                      }
                    }}
                    disabled={isSendingReminders}
                  >
                    <Icon icon="solar:close-circle-broken" /> Odustani
                  </button>
                  <button
                    className={`gumb action-btn spremiBtn ${isSendingReminders ? 'disabled' : ''}`}
                    onClick={async () => {
                      try {
                        setIsSendingReminders(true);
                        setReminderResult(null);
                        let targetIds = [];
                        if (reminderScope === 'notAccepted') {
                          targetIds = (usersNotAccepted || []).map(u => u.id);
                        } else if (reminderScope === 'all') {
                          targetIds = (korisnici || []).map(u => u.id);
                        } else if (reminderScope === 'selected') {
                          targetIds = Array.from(selectedRecipientIds);
                        }
                        const resp = await ApiConfig.api.post('/api/users/send-enrollment-reminders', { userIds: targetIds, customMessage });
                        setReminderResult(resp.data);
                        showNotification({
                          type: 'success',
                          message: `Podsjetnici poslani: ${resp.data.successCount || 0}, greške: ${resp.data.errorCount || 0}`
                        });
                        setShowReminderModal(false);
                        setSelectedRecipientIds(new Set());
                        setCustomMessage('');
                      } catch (err) {
                        console.error('Error sending reminders:', err);
                        showNotification({ type: 'error', message: err.response?.data?.message || 'Greška pri slanju podsjetnika' });
                      } finally {
                        setIsSendingReminders(false);
                      }
                    }}
                    disabled={isSendingReminders}
                  >
                    <Icon icon={isSendingReminders ? 'solar:loading-bold-duotone' : 'solar:mailbox-broken'} className={isSendingReminders ? 'spin' : ''} />
                    {isSendingReminders ? 'Šaljem...' : 'Pošalji'}
                  </button>
                </div>
              </div>
            </Modal>
            {/* Layout container for sidebar + table */}
            <div className="karticaZadatka korisnici-layout-container" style={{ display: 'flex', gap: '1.5rem', alignItems: 'start', flexDirection: 'row', justifyContent: 'center' }}>
              {/* Desktop Sidebar Filters */}
              <div className="filters-sidebar desktop-filters" style={{
              display: 'none',
              position: 'sticky',
              top: '0px',
              width: '280px',
              maxHeight: 'calc(100vh - 100px)',
              overflowY: 'auto',
              background: 'var(--iznad)',
              borderRadius: '12px',
              padding: '1rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600 }}>Filteri</h3>

              {/* Main filters */}
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  className={`filter-sidebar-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => handleTabChange('all')}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    border: 'none',
                    background: activeTab === 'all' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                    color: activeTab === 'all' ? 'var(--pozadina)' : 'var(--tekst)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: activeTab === 'all' ? 600 : 400,
                    marginBottom: '0.25rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span><Icon icon="solar:users-group-rounded-broken" /> Svi korisnici</span>
                  <span className="poll-count">{korisnici.length}</span>
                </button>
              </div>

              {/* Issues filters */}
              {(usersWithoutMentors.length > 0 || usersWithoutSchool.length > 0 || usersWithoutPrograms.length > 0 || usersNotAccepted.length > 0) && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tekst)', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Problemi</div>

                  {usersNotAccepted.length > 0 && (
                    <button
                      className={`filter-sidebar-btn ${activeTab === 'not-accepted' ? 'active' : ''}`}
                      onClick={() => handleTabChange('not-accepted')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        border: 'none',
                        background: activeTab === 'not-accepted' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                        color: activeTab === 'not-accepted' ? 'var(--pozadina)' : 'var(--tekst)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: activeTab === 'not-accepted' ? 600 : 400,
                        marginBottom: '0.25rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>Nisu potvrdili upis</span>
                      <span className="poll-count">{usersNotAccepted.length}</span>
                    </button>
                  )}

                  {usersWithoutMentors.length > 0 && (
                    <button
                      className={`filter-sidebar-btn ${activeTab === 'without-mentors' ? 'active' : ''}`}
                      onClick={() => handleTabChange('without-mentors')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        border: 'none',
                        background: activeTab === 'without-mentors' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                        color: activeTab === 'without-mentors' ? 'var(--pozadina)' : 'var(--tekst)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: activeTab === 'without-mentors' ? 600 : 400,
                        marginBottom: '0.25rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span><Icon icon="solar:user-cross-broken" /> Bez mentora</span>
                      <span className="poll-count">{usersWithoutMentors.length}</span>
                    </button>
                  )}

                  {usersWithoutSchool.length > 0 && (
                    <button
                      className={`filter-sidebar-btn ${activeTab === 'without-school' ? 'active' : ''}`}
                      onClick={() => handleTabChange('without-school')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        border: 'none',
                        background: activeTab === 'without-school' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                        color: activeTab === 'without-school' ? 'var(--pozadina)' : 'var(--tekst)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: activeTab === 'without-school' ? 600 : 400,
                        marginBottom: '0.25rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>Bez škole</span>
                      <span className="poll-count">{usersWithoutSchool.length}</span>
                    </button>
                  )}

                  {usersWithoutPrograms.length > 0 && (
                    <button
                      className={`filter-sidebar-btn ${activeTab === 'without-programs' ? 'active' : ''}`}
                      onClick={() => handleTabChange('without-programs')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        border: 'none',
                        background: activeTab === 'without-programs' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                        color: activeTab === 'without-programs' ? 'var(--pozadina)' : 'var(--tekst)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: activeTab === 'without-programs' ? 600 : 400,
                        marginBottom: '0.25rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span>Bez programa</span>
                      <span className="poll-count">{usersWithoutPrograms.length}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Special categories */}
              {(usersGlazbenoOpism.length > 0 || usersMaiZbor.length > 0) && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tekst)', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Posebno</div>

                  {usersGlazbenoOpism.length > 0 && (
                    <button
                      className={`filter-sidebar-btn ${activeTab === 'theory' ? 'active' : ''}`}
                      onClick={() => handleTabChange('theory')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        border: 'none',
                        background: activeTab === 'theory' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                        color: activeTab === 'theory' ? 'var(--pozadina)' : 'var(--tekst)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: activeTab === 'theory' ? 600 : 400,
                        marginBottom: '0.25rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span><Icon icon="solar:book-2-broken" /> Glazbeno opism.</span>
                      <span className="poll-count">{usersGlazbenoOpism.length}</span>
                    </button>
                  )}

                  {usersMaiZbor.length > 0 && (
                    <button
                      className={`filter-sidebar-btn ${activeTab === 'mai-choir' ? 'active' : ''}`}
                      onClick={() => handleTabChange('mai-choir')}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        border: 'none',
                        background: activeTab === 'mai-choir' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                        color: activeTab === 'mai-choir' ? 'var(--pozadina)' : 'var(--tekst)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: activeTab === 'mai-choir' ? 600 : 400,
                        marginBottom: '0.25rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <span><Icon icon="solar:microphone-3-broken" /> MAI zbor</span>
                      <span className="poll-count">{usersMaiZbor.length}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Enrollment Years */}
              {enrollmentYears.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tekst)', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Godina upisa</div>
                  {enrollmentYears.map(year => (
                      <button
                        key={`year-${year}`}
                        className={`filter-sidebar-btn ${activeTab === `year-${year}` ? 'active' : ''}`}
                        onClick={() => handleTabChange(`year-${year}`)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem',
                          border: 'none',
                          background: activeTab === `year-${year}` ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                          color: activeTab === `year-${year}` ? 'var(--pozadina)' : 'var(--tekst)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: activeTab === `year-${year}` ? 600 : 400,
                          marginBottom: '0.25rem',
                          transition: 'all 0.2s'
                        }}
                      >
                      <span><Icon icon="solar:calendar-broken" /> {year}</span>
                      <span className="poll-count">{usersByEnrollmentYear[year]?.count || 0}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Programs */}
              {Object.values(usersByProgram).filter(program => program.count > 0).length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tekst)', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Programi</div>
                  {Object.values(usersByProgram)
                    .filter(program => program.count > 0)
                    .sort((a, b) => a.naziv.localeCompare(b.naziv))
                    .map(program => (
                        <button
                          key={`program-${program.id}`}
                          className={`filter-sidebar-btn ${activeTab === `program-${program.id}` ? 'active' : ''}`}
                          onClick={() => handleTabChange(`program-${program.id}`)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem',
                            border: 'none',
                            background: activeTab === `program-${program.id}` ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                            color: activeTab === `program-${program.id}` ? 'var(--pozadina)' : 'var(--tekst)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: activeTab === `program-${program.id}` ? 600 : 400,
                            marginBottom: '0.25rem',
                            transition: 'all 0.2s',
                            textAlign: 'left'
                          }}
                        >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Icon icon="solar:music-notes-broken" /> {program.naziv}
                        </span>
                        <span className="poll-count" style={{ flexShrink: 0, marginLeft: '0.5rem' }}>{program.count}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Main content area - table and filters */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Mobile Filters */}
              <div className="mobile-filters" style={{
                display: 'none',
                marginBottom: '1rem'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  overflowX: 'auto',
                  paddingBottom: '0.5rem',
                  justifyContent: 'center'
                }}>
                  {/* Primary filters - always visible */}
                  <button
                    className={`filter-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => handleTabChange('all')}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <Icon icon="solar:users-group-rounded-broken" /> Svi
                  </button>

                  {usersNotAccepted.length > 0 && (
                    <button
                      className={`filter-btn ${activeTab === 'not-accepted' ? 'active' : ''}`}
                      onClick={() => handleTabChange('not-accepted')}
                      style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      Nisu potvrdili <span className="poll-count">{usersNotAccepted.length}</span>
                    </button>
                  )}

                  {/* Overflow menu button */}
                  <button
                    className="filter-btn"
                    onClick={() => setShowMobileFiltersMenu(true)}
                    style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <Icon icon="solar:filter-bold" /> Više filtera
                  </button>
                </div>
              </div>

              <div className="tablica">
              <div className="tr naziv">
                <div className="th filter" style={{ gridColumn: '1 / -1' }}>
                  <input
                    type="text"
                    className="input-login-signup"
                    placeholder="Pretraži korisnike..."
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>
              </div>
              {filteredKorisnici?.length > 0 ? (
                filteredKorisnici.map((korisnik) => (
                  <div
                    className={`tr redak ${isHovered ? 'hovered' : ''}`}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    key={korisnik.id}
                  >
                    {/* Unified stacked content for all screen sizes */}
                    <div style={{ gridColumn: '1 / -1', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>
                            {(korisnik.ime || '') + ' ' + (korisnik.prezime || '')}
                          </div>
                          <div className="txt-min2" style={{ opacity: 0.9 }}>
                            {korisnik.email}
                          </div>
                          <div className="txt-min2" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', color: (Array.isArray(korisnik.enrollments) ? (korisnik.enrollments.some(e => e.active && !e.agreementAccepted) ? 'rgb(var(--error))' : undefined) : 'rgb(var(--error))') }}>
                            {!korisnik.schoolId && (
                              <span style={{ color: 'rgb(var(--error))', fontWeight: 600 }}>bez škole</span>
                            )}
                            {(!korisnik.mentorId || korisnik.mentorId.length === 0) && (
                              <span style={{ color: 'rgb(var(--error))', fontWeight: 600 }}>bez mentora</span>
                            )}
                            {(!korisnik.programs || korisnik.programs.length === 0) && (
                              <span style={{ color: 'rgb(var(--error))', fontWeight: 600 }}>bez programa</span>
                            )}
                            {(Array.isArray(korisnik.enrollments) ? korisnik.enrollments.some(e => e.active && !e.agreementAccepted) : true) && (
                              <span style={{ color: 'rgb(var(--error))', fontWeight: 600 }}>nisu potvrdili upis</span>
                            )}
                          </div>
                        </div>
                        <div
                          className={`action-btn btn abExpand ${isHovered ? 'hovered' : ''}`}
                          onClick={() => setKorisnikDetaljiOtvoreno(korisnik.id)}
                          aria-label="Detalji"
                          style={{ alignSelf: 'flex-start' }}
                        >
                          <Icon icon="solar:round-double-alt-arrow-down-broken" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="karticaZadatka">
                  <p>{searchTerm ? 'Nema rezultata za pretragu!' : 'Nema korisnika u bazi!'}</p>
                </div>
              )}
            </div>
              </div>
            </div>

            {/* Mobile Filters Modal */}
            {showMobileFiltersMenu && (
              <>
                {/* Backdrop */}
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    zIndex: 999,
                    backdropFilter: 'blur(4px)'
                  }}
                  onClick={() => setShowMobileFiltersMenu(false)}
                />

                {/* Modal Content */}
                <div style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 1000,
                  width: '90vw',
                  maxWidth: '500px',
                  maxHeight: '80vh',
                  background: 'var(--iznad)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {/* Header */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.5rem',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--iznad)'
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Filteri</h3>
                    <button
                      className="action-btn zatvoriBtn"
                      onClick={() => setShowMobileFiltersMenu(false)}
                      style={{
                        padding: '0.5rem',
                        minWidth: 'auto',
                        background: 'rgba(var(--danger), 0.1)',
                        color: 'rgb(var(--danger))'
                      }}
                    >
                      <Icon icon="solar:close-circle-broken" fontSize="1.5rem" />
                    </button>
                  </div>

                  {/* Scrollable Content */}
                  <div style={{
                    flex: 1,
                    overflow: 'auto',
                    padding: '1rem 1.5rem'
                  }}>

                    {/* All Users */}
                    <div style={{ marginBottom: '1rem' }}>
                      <button
                        className="action-btn"
                        onClick={() => {
                          handleTabChange('all');
                          setShowMobileFiltersMenu(false);
                        }}
                        style={{
                          width: '100%',
                          justifyContent: 'space-between',
                          background: activeTab === 'all' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                          color: activeTab === 'all' ? 'var(--pozadina)' : 'var(--tekst)'
                        }}
                      >
                        <span><Icon icon="solar:users-group-rounded-broken" /> Svi korisnici</span>
                        <span className="poll-count">{korisnici.length}</span>
                      </button>
                    </div>

                    {/* Problems section */}
                    {(usersWithoutMentors.length > 0 || usersWithoutSchool.length > 0 || usersWithoutPrograms.length > 0 || usersNotAccepted.length > 0) && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.6, textTransform: 'uppercase' }}>Problemi</div>

                        {usersNotAccepted.length > 0 && (
                          <button
                            className="action-btn"
                            onClick={() => {
                              handleTabChange('not-accepted');
                              setShowMobileFiltersMenu(false);
                            }}
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem',
                              background: activeTab === 'not-accepted' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                              color: activeTab === 'not-accepted' ? 'var(--pozadina)' : 'var(--tekst)'
                            }}
                          >
                            <span>Nisu potvrdili upis</span>
                            <span className="poll-count">{usersNotAccepted.length}</span>
                          </button>
                        )}

                        {usersWithoutMentors.length > 0 && (
                          <button
                            className="action-btn"
                            onClick={() => {
                              handleTabChange('without-mentors');
                              setShowMobileFiltersMenu(false);
                            }}
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem',
                              background: activeTab === 'without-mentors' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                              color: activeTab === 'without-mentors' ? 'var(--pozadina)' : 'var(--tekst)'
                            }}
                          >
                            <span><Icon icon="solar:user-cross-broken" /> Bez mentora</span>
                            <span className="poll-count">{usersWithoutMentors.length}</span>
                          </button>
                        )}

                        {usersWithoutSchool.length > 0 && (
                          <button
                            className="action-btn"
                            onClick={() => {
                              handleTabChange('without-school');
                              setShowMobileFiltersMenu(false);
                            }}
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem',
                              background: activeTab === 'without-school' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                              color: activeTab === 'without-school' ? 'var(--pozadina)' : 'var(--tekst)'
                            }}
                          >
                            <span>Bez škole</span>
                            <span className="poll-count">{usersWithoutSchool.length}</span>
                          </button>
                        )}

                        {usersWithoutPrograms.length > 0 && (
                          <button
                            className="action-btn"
                            onClick={() => {
                              handleTabChange('without-programs');
                              setShowMobileFiltersMenu(false);
                            }}
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem',
                              background: activeTab === 'without-programs' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                              color: activeTab === 'without-programs' ? 'var(--pozadina)' : 'var(--tekst)'
                            }}
                          >
                            <span>Bez programa</span>
                            <span className="poll-count">{usersWithoutPrograms.length}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Special categories */}
                    {(usersGlazbenoOpism.length > 0 || usersMaiZbor.length > 0) && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.6, textTransform: 'uppercase' }}>Posebno</div>

                        {usersGlazbenoOpism.length > 0 && (
                          <button
                            className="action-btn"
                            onClick={() => {
                              handleTabChange('theory');
                              setShowMobileFiltersMenu(false);
                            }}
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem',
                              background: activeTab === 'theory' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                              color: activeTab === 'theory' ? 'var(--pozadina)' : 'var(--tekst)'
                            }}
                          >
                            <span><Icon icon="solar:book-2-broken" /> Glazbeno opismenjavanje</span>
                            <span className="poll-count">{usersGlazbenoOpism.length}</span>
                          </button>
                        )}

                        {usersMaiZbor.length > 0 && (
                          <button
                            className="action-btn"
                            onClick={() => {
                              handleTabChange('mai-choir');
                              setShowMobileFiltersMenu(false);
                            }}
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem',
                              background: activeTab === 'mai-choir' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                              color: activeTab === 'mai-choir' ? 'var(--pozadina)' : 'var(--tekst)'
                            }}
                          >
                            <span><Icon icon="solar:microphone-3-broken" /> MAI zbor</span>
                            <span className="poll-count">{usersMaiZbor.length}</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Enrollment Years */}
                    {enrollmentYears.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.6, textTransform: 'uppercase' }}>Godina upisa</div>
                        {enrollmentYears.map(year => (
                        <button
                          key={`year-${year}`}
                          className="action-btn"
                          onClick={() => {
                            handleTabChange(`year-${year}`);
                            setShowMobileFiltersMenu(false);
                          }}
                          style={{
                            width: '100%',
                            justifyContent: 'space-between',
                            marginBottom: '0.5rem',
                            background: activeTab === `year-${year}` ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                            color: activeTab === `year-${year}` ? 'var(--pozadina)' : 'var(--tekst)'
                          }}
                        >
                            <span><Icon icon="solar:calendar-broken" /> {year}</span>
                            <span className="poll-count">{usersByEnrollmentYear[year]?.count || 0}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Programs */}
                    {Object.values(usersByProgram).filter(program => program.count > 0).length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.6, textTransform: 'uppercase' }}>Programi</div>
                        {Object.values(usersByProgram)
                          .filter(program => program.count > 0)
                          .sort((a, b) => a.naziv.localeCompare(b.naziv))
                          .map(program => (
                          <button
                            key={`program-${program.id}`}
                            className="action-btn"
                            onClick={() => {
                              handleTabChange(`program-${program.id}`);
                              setShowMobileFiltersMenu(false);
                            }}
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem',
                              textAlign: 'left',
                              background: activeTab === `program-${program.id}` ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                              color: activeTab === `program-${program.id}` ? 'var(--pozadina)' : 'var(--tekst)'
                            }}
                          >
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <Icon icon="solar:music-notes-broken" /> {program.naziv}
                              </span>
                              <span className="poll-count" style={{ flexShrink: 0 }}>{program.count}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Media queries for responsive layout */}
            <style dangerouslySetInnerHTML={{__html: `
              @media (min-width: 769px) {
                .desktop-filters {
                  display: block !important;
                }
                .mobile-filters {
                  display: none !important;
                }
              }
              @media (max-width: 768px) {
                .desktop-filters {
                  display: none !important;
                }
                .mobile-filters {
                  display: block !important;
                }
                .korisnici-layout-container {
                  flex-direction: column !important;
                  align-items: center !important;
                }
                .korisnici-layout-container > div:not(.desktop-filters) {
                  width: 100% !important;
                  max-width: 100% !important;
                }
              }
            `}} />

            {/* Bulk Upload Modal */}
            <Modal
              isOpen={showBulkUpload}
              onClose={() => {
                if (!isUploading) {
                  setShowBulkUpload(false);
                  setSelectedFile(null);
                  setUploadProgress(0);
                  setProgressMessage('');
                }
              }}
              title={
                <>
                  <Icon icon="solar:upload-broken" />
                  Učitavanje učenika iz XLSX datoteke
                </>
              }
              maxWidth="800px"
              isFormModal={true}
            >
              <style>{`
                @media (max-width: 768px) {
                  .bulk-upload-fields-grid {
                    grid-template-columns: 1fr !important;
                  }
                }
              `}</style>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                  Odaberite XLSX datoteku s popisom učenika.
                </p>

                {/* File Format Section */}
                <div style={{
                  background: 'rgba(var(--isticanje), 0.05)',
                  padding: '1.5rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgba(var(--isticanje), 0.2)'
                }}>
                  <h4 style={{
                    fontSize: '1rem',
                    marginBottom: '1rem',
                    color: 'rgb(var(--isticanje))'
                  }}>
                    <Icon icon="solar:file-text-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    Format datoteke
                  </h4>

                  <div className="bulk-upload-fields-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 2rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    <div><strong>Ime*</strong></div>
                    <div><strong>Prezime*</strong></div>
                    <div><strong>Email*</strong></div>
                    <div><strong>OIB*</strong></div>
                    <div>Broj mobitela</div>
                    <div>Ulica</div>
                    <div>Kućni broj</div>
                    <div>Mjesto</div>
                    <div>Roditelj 1 - Ime</div>
                    <div>Roditelj 1 - Prezime</div>
                    <div>Roditelj 1 - Mobitel</div>
                    <div>Roditelj 2 - Ime</div>
                    <div>Roditelj 2 - Prezime</div>
                    <div>Roditelj 2 - Mobitel</div>
                    <div>Program</div>
                    <div>Mentor</div>
                  </div>

                  <a
                    href="/Predlozak_Ucenici.xlsx"
                    download="Predlozak_Ucenici.xlsx"
                    className="action-btn abEdit"
                    style={{
                      display: 'inline-flex',
                      textDecoration: 'none',
                      width: 'auto'
                    }}
                  >
                    <Icon icon="solar:download-minimalistic-broken" />
                    Preuzmi predložak (XLSX)
                  </a>
                </div>

                {/* Important Notes */}
                <div style={{
                  background: 'rgba(var(--isticanje2), 0.1)',
                  border: '1px solid rgba(var(--isticanje2), 0.3)',
                  padding: '1rem',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  fontSize: '0.9rem'
                }}>
                  <p style={{ margin: 0, color: 'rgb(var(--isticanje))' }}>
                    <Icon icon="solar:info-circle-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    <strong>Napomena:</strong> Polja označena zvjezdicom (*) su obavezna i moraju biti popunjena za svakog učenika.
                    Polja za adresu, roditelje, broj mobitela, program i mentor su opcionalna i mogu ostati prazna.
                  </p>
                  <p style={{ margin: 0, color: 'rgb(var(--isticanje))' }}>
                    <Icon icon="solar:document-text-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    <strong>Važno za OIB:</strong> Stupac OIB mora biti formatiran kao <strong>Tekst</strong> u Excelu (ne kao Broj) kako bi se sačuvale početne nule (npr. 00123456789).
                    Predložak već ima ispravno formatiranje.
                  </p>
                  <p style={{ margin: 0, color: 'rgb(var(--isticanje))' }}>
                    <Icon icon="solar:shield-warning-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    <strong>Važno:</strong> Program i mentor moraju već postojati u bazi podataka da bi bili povezani s učenikom.
                    Ako program ili mentor ne postoje, učenik će biti kreiran bez tih podataka.
                  </p>
                  <p style={{ margin: 0, color: 'rgb(var(--isticanje))' }}>
                    <Icon icon="solar:link-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    <strong>Napomena:</strong> Programi i mentori se mogu dodijeliti neovisno jedan o drugom.
                    Učenik može imati program bez mentora i obrnuto.
                  </p>
                  <p style={{ margin: 0, color: 'rgb(var(--isticanje))' }}>
                    <Icon icon="solar:user-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    <strong>Napomena:</strong> Mentori i učenici mogu samostalno ažurirati svoje podatke u prikazu <em>Profil</em>.
                    Učenici ne mogu mijenjati vlastite programe ni dodijeljene mentore.
                  </p>
                  <p style={{ margin: 0, color: 'rgb(var(--isticanje))' }}>
                    <Icon icon="solar:pen-new-square-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                    Nakdnadno uređivanje podataka je moguće!
                  </p>
                </div>

                {/* File Upload Section */}
                <div style={{
                  background: 'rgba(var(--isticanje), 0.05)',
                  padding: '1.5rem',
                  borderRadius: 'var(--radius)',
                  border: '2px dashed rgba(var(--isticanje), 0.3)',
                  textAlign: 'center'
                }}>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                      }
                    }}
                    className="file-input"
                    id="users-file-input"
                    disabled={isUploading}
                    style={{ display: 'none' }}
                  />
                  <label
                    htmlFor="users-file-input"
                    className={`action-btn spremiBtn ${isUploading ? 'disabled' : ''}`}
                    style={{ cursor: isUploading ? 'not-allowed' : 'pointer', display: 'inline-flex' }}
                  >
                    <Icon icon={isUploading ? "solar:loading-bold-duotone" : "solar:upload-broken"}
                          className={isUploading ? "spin" : ""} />
                    {isUploading ? 'Učitavanje...' : 'Odaberi XLSX datoteku'}
                  </label>

                  {selectedFile && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      background: 'var(--iznad)',
                      borderRadius: 'var(--radius)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      alignItems: 'center'
                    }}>
                      <p style={{ margin: 0, fontWeight: 600 }}>
                        <Icon icon="solar:file-check-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                        Odabrana datoteka: {selectedFile.name}
                      </p>
                      <button
                        className="gumb action-btn spremiBtn"
                        onClick={handleBulkUpload}
                        disabled={isUploading}
                        style={{ width: 'auto' }}
                      >
                        <Icon icon="solar:upload-broken" />
                        {isUploading ? 'Učitavanje...' : 'Učitaj korisnike'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {uploadProgress > 0 && (
                  <div style={{
                    background: 'rgba(var(--isticanje2), 0.1)',
                    padding: '1rem',
                    borderRadius: 'var(--radius)'
                  }}>
                    <div style={{
                      height: '8px',
                      background: 'rgba(var(--isticanje2), 0.3)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginBottom: '0.5rem'
                    }}>
                      <div
                        style={{
                          width: `${uploadProgress}%`,
                          height: '100%',
                          background: 'rgb(var(--isticanje))',
                          transition: 'width 0.3s ease'
                        }}
                      ></div>
                    </div>
                    <p style={{ margin: 0, textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>
                      {progressMessage}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="div-radio" style={{
                  borderTop: '1px solid rgba(var(--isticanje2), 0.3)'
                }}>
                  <button
                    className="gumb action-btn zatvoriBtn"
                    onClick={() => {
                      if (!isUploading) {
                        setShowBulkUpload(false);
                        setSelectedFile(null);
                        setUploadProgress(0);
                        setProgressMessage('');
                      }
                    }}
                    disabled={isUploading}
                  >
                    <Icon icon="solar:close-circle-broken" /> Odustani
                  </button>
                </div>
              </div>
            </Modal>

            {/* Preview Modal */}
            {showPreviewModal && (
              <div className="popup">
                <div className="div div-clmn">
                  <h3>Pregled novih učenika</h3>
                  <div className="p">
                    <div>Ukupno redaka: {previewData?.summary?.total || 0}</div>
                    <div>Novi: {previewData?.summary?.valid || 0}</div>
                    <div>Duplikati: {previewData?.summary?.duplicates || 0}</div>
                    {previewData?.errors?.length > 0 && (
                      <div style={{ color: 'rgb(var(--error))' }}>Greške: {previewData.errors.length}</div>
                    )}
                  </div>
                  {previewData?.duplicates?.length > 0 && (
                    <div className="p" style={{ maxHeight: '150px', overflow: 'auto' }}>
                      <h4>Pronađeni duplikati (neće biti dodani):</h4>
                      <div className="tablica">
                        <div className="tr naziv">
                          <div className="th">Red</div>
                          <div className="th">Razlog</div>
                          <div className="th">Ime i prezime</div>
                          <div className="th">Email</div>
                          <div className="th">OIB</div>
                        </div>
                        {previewData.duplicates.map((d, idx) => (
                          <div key={idx} className="tr redak">
                            <div className="th">{d.row}</div>
                            <div className="th">{d.reason}</div>
                            <div className="th">{d.candidate?.ime} {d.candidate?.prezime}</div>
                            <div className="th">{d.candidate?.email}</div>
                            <div className="th">{d.candidate?.oib}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="p" style={{ maxHeight: '300px', overflow: 'auto' }}>
                    <h4>Novi učenici za dodavanje</h4>
                    <div className="tablica">
                      <div className="tr naziv">
                        <div className="th">Dodaj</div>
                        <div className="th">Ime</div>
                        <div className="th">Prezime</div>
                        <div className="th">Email</div>
                        <div className="th">OIB</div>
                        <div className="th">Mobitel</div>
                        <div className="th">Ulica</div>
                        <div className="th">Broj</div>
                        <div className="th">Mjesto</div>
                        <div className="th">R1 Ime</div>
                        <div className="th">R1 Prezime</div>
                        <div className="th">R1 Mob</div>
                        <div className="th">R2 Ime</div>
                        <div className="th">R2 Prezime</div>
                        <div className="th">R2 Mob</div>
                        <div className="th">Program</div>
                        <div className="th">Mentor</div>
                      </div>
                      {editableRows.map((row, idx) => (
                        <div key={idx} className="tr redak">
                          <div className="th">
                            <input
                              type="checkbox"
                              checked={selectedForCommit.has(idx)}
                              onChange={(e) => {
                                setSelectedForCommit(prev => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(idx); else next.delete(idx);
                                  return next;
                                });
                              }}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.ime || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], ime: e.target.value };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.prezime || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], prezime: e.target.value };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.email || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], email: e.target.value };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.oib || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], oib: e.target.value };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.brojMobitela || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], brojMobitela: e.target.value };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.adresa?.ulica || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], adresa: { ...(next[idx].adresa || {}), ulica: e.target.value } };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.adresa?.kucniBroj || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], adresa: { ...(next[idx].adresa || {}), kucniBroj: e.target.value } };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.adresa?.mjesto || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], adresa: { ...(next[idx].adresa || {}), mjesto: e.target.value } };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.roditelj1?.ime || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], roditelj1: { ...(next[idx].roditelj1 || {}), ime: e.target.value } };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.roditelj1?.prezime || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], roditelj1: { ...(next[idx].roditelj1 || {}), prezime: e.target.value } };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.roditelj1?.brojMobitela || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], roditelj1: { ...(next[idx].roditelj1 || {}), brojMobitela: e.target.value } };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.roditelj2?.ime || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], roditelj2: { ...(next[idx].roditelj2 || {}), ime: e.target.value } };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.roditelj2?.prezime || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], roditelj2: { ...(next[idx].roditelj2 || {}), prezime: e.target.value } };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.roditelj2?.brojMobitela || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], roditelj2: { ...(next[idx].roditelj2 || {}), brojMobitela: e.target.value } };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.programName || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], programName: e.target.value };
                                return next;
                              })}
                            />
                          </div>
                          <div className="th">
                            <input
                              className="input-login-signup"
                              value={row.mentorName || ''}
                              onChange={(e) => setEditableRows(prev => {
                                const next = [...prev];
                                next[idx] = { ...next[idx], mentorName: e.target.value };
                                return next;
                              })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="div-row" style={{ gap: '.5rem' }}>
                    <button className={`gumb action-btn spremiBtn ${isUploading ? 'disabled' : ''}`} onClick={handleCommitSelected} disabled={isUploading}>
                      <Icon icon={isUploading ? 'solar:loading-bold-duotone' : 'solar:check-circle-broken'} className={isUploading ? 'spin' : ''} />
                      Spremi odabrane
                    </button>
                    <button className="gumb action-btn zatvoriBtn" onClick={() => setShowPreviewModal(false)} disabled={isUploading}>
                      <Icon icon="solar:close-circle-broken" /> Zatvori
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {notification && (
        <div
          className={`notification ${notification.type === 'success' ? 'success' : 'error'}`}
          onClick={() => setNotification(null)}
        >
          {notification.message}
        </div>
      )}
    </>
  );
};

export default Korisnici;
