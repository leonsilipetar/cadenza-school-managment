import React, { useEffect, useState, useCallback } from 'react';
import ApiConfig from '../../components/apiConfig';
import '../../scenes/SignUpForm.css';
import { Icon } from '@iconify/react';
import NavigacijaAdmin from './NavigacijaAdmin';
import NavTopAdministracija from './NavTopAdmin.jsx';
import { showNotification } from '../../components/Notifikacija.jsx';

const EnrollmentDashboard = () => {
  const [enrollments, setEnrollments] = useState([]);
  const [filteredEnrollments, setFilteredEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState('2025/2026'); // Default to current enrollment year
  const [activeTab, setActiveTab] = useState('all');
  const [enrollmentsByProgram, setEnrollmentsByProgram] = useState({});
  const [showMobileFiltersMenu, setShowMobileFiltersMenu] = useState(false);
  const [enrollmentsByEnrollmentYear, setEnrollmentsByEnrollmentYear] = useState({});
  const [enrollmentsByUserCreationYear, setEnrollmentsByUserCreationYear] = useState({});
  const [newAccounts, setNewAccounts] = useState([]);
  const [enrollmentYears, setEnrollmentYears] = useState([]);
  const [pdfLoading, setPdfLoading] = useState({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showMobileActionsMenu, setShowMobileActionsMenu] = useState(false);

  const downloadEnrollmentConfirmation = async (user) => {
    try {
      if (!user?.id) return;
      setPdfLoading(prev => ({ ...prev, [user.id]: true }));
      const res = await ApiConfig.api.get(`/api/enrollment/confirmation/${user.id}/pdf`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const ime = (user.ime || '').trim().replace(/\s+/g, '_');
      const prezime = (user.prezime || '').trim().replace(/\s+/g, '_');
      link.href = url;
      link.download = `potvrda-upisa_${ime}_${prezime}_${user.id}_${selectedYear || ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('success', `PDF generiran za ${user.ime} ${user.prezime}`);
    } catch (err) {
      console.error('PDF generation error:', err);
      showNotification('error', 'Greška pri generiranju potvrde upisa');
    } finally {
      setPdfLoading(prev => ({ ...prev, [user.id]: false }));
    }
  };

  const downloadBulkConfirmations = async () => {
    try {
      setBulkLoading(true);
      const userIds = (filteredEnrollments || [])
        .map(e => e?.user?.id)
        .filter(Boolean);
      if (userIds.length === 0) {
        showNotification('info', 'Nema korisnika za generiranje.');
        return;
      }
      const res = await ApiConfig.api.post('/api/enrollment/confirmation/bulk/pdf', { userIds }, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `potvrde-upisa_${selectedYear || ''}_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('success', `PDF (više stranica) generiran za ${userIds.length} učenika.`);
    } catch (err) {
      console.error('Bulk PDF generation error:', err);
      showNotification('error', 'Greška pri generiranju potvrda upisa');
    } finally {
      setBulkLoading(false);
    }
  };

  // Helper function to determine if account is new (created after July of current year)
  const isNewAccount = (createdAt) => {
    if (!createdAt) return false;
    const date = new Date(createdAt);
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // getMonth() returns 0-11

    return date.getFullYear() === currentYear && date.getMonth() + 1 >= 7;
  };

  // Helper function to determine enrollment year based on creation date (same logic as Korisnici.jsx)
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

  // Process enrollments for filtering
  const processEnrollmentsForFiltering = useCallback((enrollmentsData) => {
    const programsMap = {};
    const enrollmentYearsMap = {};
    const userCreationYearsMap = {};
    const newAccountsList = [];

    enrollmentsData.forEach(enrollment => {
      // Group by program
      if (enrollment.program && enrollment.program.id) {
        const programId = enrollment.program.id;
        if (!programsMap[programId]) {
          programsMap[programId] = {
            id: programId,
            naziv: enrollment.program.naziv,
            count: 0,
            enrollments: []
          };
        }
        programsMap[programId].count++;
        programsMap[programId].enrollments.push(enrollment);
      }

      // Group by enrollment year
      const enrollmentYear = selectedYear;
      if (!enrollmentYearsMap[enrollmentYear]) {
        enrollmentYearsMap[enrollmentYear] = {
          year: enrollmentYear,
          count: 0,
          enrollments: []
        };
      }
      enrollmentYearsMap[enrollmentYear].count++;
      enrollmentYearsMap[enrollmentYear].enrollments.push(enrollment);

      // Group by user creation year (when account was created)
      const userCreationYear = getEnrollmentYear(enrollment.user?.createdAt);
      if (!userCreationYearsMap[userCreationYear]) {
        userCreationYearsMap[userCreationYear] = {
          year: userCreationYear,
          count: 0,
          enrollments: []
        };
      }
      userCreationYearsMap[userCreationYear].count++;
      userCreationYearsMap[userCreationYear].enrollments.push(enrollment);

      // Check if it's a new account
      if (isNewAccount(enrollment.user?.createdAt)) {
        newAccountsList.push(enrollment);
      }
    });

    return { programsMap, enrollmentYearsMap, userCreationYearsMap, newAccountsList };
  }, [selectedYear]);

  useEffect(() => {
    const fetchEnrollments = async () => {
      setLoading(true);
      try {
        // First get the admin's profile to get their schoolId
        const profileRes = await ApiConfig.api.get('/api/profil');
        const schoolId = profileRes.data.user.schoolId;

        let url = '/api/enrollment/list';
        const params = new URLSearchParams();

        // Add school year parameter
        if (selectedYear) {
          params.append('schoolYear', selectedYear);
        }

        // Add schoolId parameter for filtering
        if (schoolId) {
          params.append('schoolId', schoolId);
        }

        if (params.toString()) {
          url += `?${params.toString()}`;
        }

        console.log('📋 Frontend: Making API call to:', url);
        const res = await ApiConfig.api.get(url);
        console.log('📋 Frontend: Received response:', res.data);
        const enrollmentsData = res.data.enrollments || [];
        setEnrollments(enrollmentsData);
        setFilteredEnrollments(enrollmentsData);

        // Process enrollments for filtering
        const { programsMap, enrollmentYearsMap, userCreationYearsMap, newAccountsList } = processEnrollmentsForFiltering(enrollmentsData);
        setEnrollmentsByProgram(programsMap);
        setEnrollmentsByEnrollmentYear(enrollmentYearsMap);
        setEnrollmentsByUserCreationYear(userCreationYearsMap);
        setNewAccounts(newAccountsList);

        // Get unique enrollment years for tabs
        const uniqueYears = Object.keys(userCreationYearsMap).filter(year => year !== 'unknown' && year !== 'other');
        setEnrollmentYears(uniqueYears.sort());
      } catch (err) {
        console.error('📋 Frontend: Error fetching enrollments:', err);
        setError('Greška pri dohvaćanju upisa.');
      } finally {
        setLoading(false);
      }
    };
    fetchEnrollments();
  }, [selectedYear, processEnrollmentsForFiltering]);

  // Update filtered enrollments based on search term and active tab
  useEffect(() => {
    let baseData = enrollments;

    // First apply tab filter
    if (activeTab === 'new-accounts') {
      baseData = newAccounts;
    } else if (activeTab.startsWith('program-')) {
      const programId = activeTab.replace('program-', '');
      baseData = enrollmentsByProgram[programId]?.enrollments || [];
    } else if (activeTab.startsWith('user-year-')) {
      const year = activeTab.replace('user-year-', '');
      baseData = enrollmentsByUserCreationYear[year]?.enrollments || [];
    }

    // Then apply search filter
    if (!baseData || !Array.isArray(baseData)) {
      setFilteredEnrollments([]);
      return;
    }

    const filtered = baseData.filter(e => {
      const name = (e.user?.ime + ' ' + e.user?.prezime).toLowerCase();
      const email = (e.user?.email || '').toLowerCase();
      return name.includes(searchTerm.toLowerCase()) || email.includes(searchTerm.toLowerCase());
    });

    setFilteredEnrollments(filtered);
  }, [searchTerm, enrollments, activeTab, newAccounts, enrollmentsByProgram, enrollmentsByUserCreationYear]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchTerm(''); // Clear search when changing tabs
    // The useEffect will handle the actual filtering
  };

  const handleExport = () => {
    try {
      // Force semicolon delimiter for better Croatian character support
      const delimiter = ';';
      const headers = [
        'Ime',
        'Prezime',
        'Email',
        'Korisnicko ime',
        'OIB',
        'Ulica',
        'Broj',
        'Mjesto',
        'Postanski broj',
        'Drzava',
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
        'Uloga',
        'Skola',
        'Status upisa',
        'Datum potvrde upisa',
        'Skolska godina'
      ];

      const rows = (filteredEnrollments || []).map((e) => [
        e.user?.ime || '',
        e.user?.prezime || '',
        e.user?.email || '',
        e.user?.korisnickoIme || '',
        e.user?.oib || '',
        e.user?.adresa?.ulica || '',
        e.user?.adresa?.kucniBroj || '',
        e.user?.adresa?.mjesto || '',
        e.user?.adresa?.postanskiBroj || '',
        e.user?.adresa?.drzava || '',
        e.mentor ? `${e.mentor.ime} ${e.mentor.prezime}` : '',
        e.program ? e.program.naziv : '',
        e.user?.roditelj1?.ime || '',
        e.user?.roditelj1?.prezime || '',
        e.user?.roditelj1?.brojMobitela || '',
        e.user?.roditelj1?.email || '',
        e.user?.roditelj2?.ime || '',
        e.user?.roditelj2?.prezime || '',
        e.user?.roditelj2?.brojMobitela || '',
        e.user?.roditelj2?.email || '',
        e.user?.createdAt ? new Date(e.user.createdAt).toLocaleDateString('hr-HR') : '',
        e.user?.isAdmin ? 'administrator' : (e.user?.isMentor ? 'mentor' : (e.user?.isStudent ? 'student' : 'bez uloge')),
        e.school?.name || '',
        e.agreementAccepted ? 'Potvrdjeno' : 'Nije potvrdjeno',
        e.agreementAcceptedAt ? new Date(e.agreementAcceptedAt).toLocaleDateString('hr-HR') : '',
        selectedYear
      ]);

      const escapeField = (val) => {
        const s = String(val ?? '');
        // Simple escaping for CSV
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

      // Create CSV with proper UTF-8 BOM for Croatian characters
      const csvContent = "\ufeff" + csv;
      const blob = new Blob([csvContent], {
        type: 'text/csv;charset=utf-8;'
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `upisi_${selectedYear}_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showNotification({ type: 'success', message: 'CSV datoteka uspješno izvezena!' });
    } catch (err) {
      console.error('CSV export error:', err);
      showNotification({ type: 'error', message: 'Greška pri izvozu CSV datoteke' });
    }
  };

  return (
    <>
    <NavigacijaAdmin otvoreno="enrollments" />
    <NavTopAdministracija naslov="Upisi u šk. god." />
    <div className="main">
      {loading ? (
        <div>Učitavanje...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : (
        <>
          <div className="karticaZadatka" style={{ overflow: 'visible' }}>
            <div className="div-row">
              <span style={{color: 'rgb(var(--isticanje))'}}>
                {activeTab === 'all'
                  ? `Ukupno upisa: ${enrollments?.length || 0}`
                  : `Filtrirani upisi: ${filteredEnrollments?.length || 0}`
                }
              </span>
              <div className="p">
                Pregled upisa učenika u školsku godinu {selectedYear}. Potvrde upisa se generiraju dinamički iz baze podataka klikom na gumb - nisu pohranjene kao datoteke. Svaka potvrda se uvijek generira s najnovijim podacima iz sustava.
              </div>
            </div>

            {/* Desktop actions - all visible */}
            <div className="desktop-actions" style={{
              fontSize: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '1rem',
              flexWrap: 'wrap'
            }}>
              <button
                className="action-btn spremiBtn"
                onClick={handleExport}
              >
                <Icon icon="solar:download-broken" /> Izvezi CSV
              </button>
              <button
                className="action-btn abEdit"
                onClick={downloadBulkConfirmations}
                title="Generiraj potvrde (trenutni prikaz)"
                disabled={bulkLoading}
                style={{ opacity: bulkLoading ? 0.6 : 1 }}
              >
                {bulkLoading ? <Icon icon="eos-icons:three-dots-loading" /> : <Icon icon="solar:document-add-broken" />} Potvrde (bulk)
              </button>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(e.target.value)}
                style={{ height: '100%', padding: '0.5rem' }}
              >
                <option value="2023/2024">2023/2024</option>
                <option value="2024/2025">2024/2025</option>
                <option value="2025/2026">2025/2026</option>
                <option value="2026/2027">2026/2027</option>
                <option value="2027/2028">2027/2028</option>
              </select>
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
                className="action-btn spremiBtn"
                onClick={handleExport}
                style={{ flex: 1 }}
              >
                <Icon icon="solar:download-broken" fontSize="large" /> Izvezi CSV
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
                      className="action-btn abEdit"
                      onClick={() => {
                        downloadBulkConfirmations();
                        setShowMobileActionsMenu(false);
                      }}
                      disabled={bulkLoading}
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        borderRadius: 0,
                        opacity: bulkLoading ? 0.6 : 1
                      }}
                    >
                      {bulkLoading ? <Icon icon="eos-icons:three-dots-loading" /> : <Icon icon="solar:document-add-broken" />} Potvrde (bulk)
                    </button>
                    <div style={{
                      padding: '0.5rem',
                      borderTop: '1px solid var(--border)'
                    }}>
                      <label style={{ fontSize: '0.7rem', marginBottom: '0.25rem', display: 'block', opacity: 0.8 }}>Školska godina</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => {
                          setSelectedYear(e.target.value);
                          setShowMobileActionsMenu(false);
                        }}
                        style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}
                      >
                        <option value="2023/2024">2023/2024</option>
                        <option value="2024/2025">2024/2025</option>
                        <option value="2025/2026">2025/2026</option>
                        <option value="2026/2027">2026/2027</option>
                        <option value="2027/2028">2027/2028</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

      {/* Layout container for sidebar + table */}
      <div className="karticaZadatka enrollment-layout-container" style={{ display: 'flex', gap: '1.5rem', alignItems: 'start', flexDirection: 'row', justifyContent: 'center' }}>
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

          {/* Main filter */}
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              className="filter-sidebar-btn"
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
              <span><Icon icon="solar:users-group-rounded-broken" /> Svi upisi</span>
              <span className="poll-count">{enrollments?.length || 0}</span>
            </button>
          </div>

          {/* Special filters */}
          {newAccounts.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tekst)', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Posebno</div>
              <button
                className="filter-sidebar-btn"
                onClick={() => handleTabChange('new-accounts')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  border: 'none',
                  background: activeTab === 'new-accounts' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                  color: activeTab === 'new-accounts' ? 'var(--pozadina)' : 'var(--tekst)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: activeTab === 'new-accounts' ? 600 : 400,
                  marginBottom: '0.25rem',
                  transition: 'all 0.2s'
                }}
              >
                <span><Icon icon="solar:user-plus-broken" /> Novi računi</span>
                <span className="poll-count">{newAccounts.length}</span>
              </button>
            </div>
          )}

          {/* User Creation Years */}
          {enrollmentYears.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tekst)', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Godina kreiranja</div>
              {enrollmentYears.map(year => (
                <button
                  key={`user-year-${year}`}
                  className="filter-sidebar-btn"
                  onClick={() => handleTabChange(`user-year-${year}`)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    border: 'none',
                    background: activeTab === `user-year-${year}` ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                    color: activeTab === `user-year-${year}` ? 'var(--pozadina)' : 'var(--tekst)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: activeTab === `user-year-${year}` ? 600 : 400,
                    marginBottom: '0.25rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <span><Icon icon="solar:calendar-broken" /> {year}</span>
                  <span className="poll-count">{enrollmentsByUserCreationYear[year]?.count || 0}</span>
                </button>
              ))}
            </div>
          )}

          {/* Programs */}
          {Object.values(enrollmentsByProgram).filter(program => program.count > 0).length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tekst)', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Programi</div>
              {Object.values(enrollmentsByProgram)
                .filter(program => program.count > 0)
                .sort((a, b) => a.naziv.localeCompare(b.naziv))
                .map(program => (
                  <button
                    key={`program-${program.id}`}
                    className="filter-sidebar-btn"
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
              {/* Primary filter - always visible */}
              <button
                className="filter-btn"
                onClick={() => handleTabChange('all')}
                style={{
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  background: activeTab === 'all' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                  color: activeTab === 'all' ? 'var(--pozadina)' : 'var(--tekst)'
                }}
              >
                <Icon icon="solar:users-group-rounded-broken" /> Svi
              </button>

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
              placeholder="Pretraži upise..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
          {filteredEnrollments.length === 0 ? (
            <div className="karticaZadatka">
              <p>{searchTerm ? 'Nema rezultata za pretragu!' : 'Nema upisa u bazi!'}</p>
            </div>
          ) : (
            filteredEnrollments.map(e => (
              <div
                className="tr redak"
                key={e.id}
              >
                {/* Unified stacked content for all screen sizes */}
                <div style={{ gridColumn: '1 / -1', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        {e.user?.ime} {e.user?.prezime}
                      </div>
                      <div className="txt-min2" style={{ opacity: 0.9 }}>
                        {e.user?.email}
                      </div>
                      <div className="txt-min2" style={{ opacity: 0.8 }}>
                        {e.program?.naziv || 'Nije dodijeljeno'} • {e.mentor?.ime ? `${e.mentor.ime} ${e.mentor.prezime}` : 'Bez mentora'}
                      </div>
                      <div className="txt-min2" style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginTop: '.25rem' }}>
                        <span className={`status-badge ${e.agreementAccepted ? 'confirmed' : 'pending'}`} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem' }}>
                          {e.agreementAccepted ? 'Potvrđeno' : 'Nije potvrđeno'}
                        </span>
                        {e.agreementAcceptedAt && (
                          <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>
                            {new Date(e.agreementAcceptedAt).toLocaleDateString('hr-HR')}
                          </span>
                        )}
                      </div>
                    </div>
                    {e.user?.id && (
                      <button
                        className="action-btn abEdit"
                        title="Potvrda upisa (PDF)"
                        onClick={() => downloadEnrollmentConfirmation(e.user)}
                        style={{ padding: '0.5rem', opacity: pdfLoading[e.user.id] ? 0.6 : 1, alignSelf: 'flex-start' }}
                        disabled={!!pdfLoading[e.user.id]}
                      >
                        {pdfLoading[e.user.id] ? <Icon icon="eos-icons:three-dots-loading" /> : <Icon icon="solar:document-broken" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
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
              {/* All Enrollments */}
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
                  <span><Icon icon="solar:users-group-rounded-broken" /> Svi upisi</span>
                  <span className="poll-count">{enrollments?.length || 0}</span>
                </button>
              </div>

              {/* Special section */}
              {newAccounts.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.6, textTransform: 'uppercase' }}>Posebno</div>
                  <button
                    className="action-btn"
                    onClick={() => {
                      handleTabChange('new-accounts');
                      setShowMobileFiltersMenu(false);
                    }}
                    style={{
                      width: '100%',
                      justifyContent: 'space-between',
                      marginBottom: '0.5rem',
                      background: activeTab === 'new-accounts' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                      color: activeTab === 'new-accounts' ? 'var(--pozadina)' : 'var(--tekst)'
                    }}
                  >
                    <span><Icon icon="solar:user-plus-broken" /> Novi računi</span>
                    <span className="poll-count">{newAccounts.length}</span>
                  </button>
                </div>
              )}

              {/* User Creation Years section */}
              {enrollmentYears.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.6, textTransform: 'uppercase' }}>Godina kreiranja</div>
                  {enrollmentYears.map(year => (
                    <button
                      key={`user-year-${year}`}
                      className="action-btn"
                      onClick={() => {
                        handleTabChange(`user-year-${year}`);
                        setShowMobileFiltersMenu(false);
                      }}
                      style={{
                        width: '100%',
                        justifyContent: 'space-between',
                        marginBottom: '0.5rem',
                        background: activeTab === `user-year-${year}` ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                        color: activeTab === `user-year-${year}` ? 'var(--pozadina)' : 'var(--tekst)'
                      }}
                    >
                      <span><Icon icon="solar:calendar-broken" /> {year}</span>
                      <span className="poll-count">{enrollmentsByUserCreationYear[year]?.count || 0}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Programs section */}
              {Object.values(enrollmentsByProgram).filter(program => program.count > 0).length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.6, textTransform: 'uppercase' }}>Programi</div>
                  {Object.values(enrollmentsByProgram)
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
                          background: activeTab === `program-${program.id}` ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                          color: activeTab === `program-${program.id}` ? 'var(--pozadina)' : 'var(--tekst)'
                        }}
                      >
                        <span><Icon icon="solar:music-notes-broken" /> {program.naziv}</span>
                        <span className="poll-count">{program.count}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 769px) {
          .desktop-filters {
            display: block !important;
          }
          .mobile-filters {
            display: none !important;
          }
          .desktop-actions {
            display: flex !important;
          }
          .mobile-actions {
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
          .desktop-actions {
            display: none !important;
          }
          .mobile-actions {
            display: flex !important;
          }
          .enrollment-layout-container {
            flex-direction: column !important;
            align-items: center !important;
          }
          .enrollment-layout-container > div:not(.desktop-filters) {
            width: 100% !important;
            max-width: 100% !important;
          }
        }
      `}} />

        </>
      )}
    </div>
    </>
  );
};

export default EnrollmentDashboard;