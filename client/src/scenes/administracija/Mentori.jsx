import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Icon } from '@iconify/react';
import NavigacijaAdmin from './NavigacijaAdmin';
import NavTopAdministracija from './NavTopAdmin.jsx';
import DodajMentora from './DodajMentora';
import MentorDetalji from './MentoriDetalji';
import ApiConfig from '../../components/apiConfig';
import LoadingShell from '../../components/LoadingShell';
import { showNotification } from '../../components/Notifikacija.jsx';
import Modal from '../../components/Modal';
import { useAdminMentors, useInvalidateAdminMentors } from '../../hooks/useAdminMentors';

const Mentori = () => {
  const [odabranoDodajKorisnika, setOdabranoDodajKOrisnika] = useState(false);
  const [korisnikDetaljiOtvoreno, setKorisnikDetaljiOtvoreno] = useState(null);
  
  // State for schoolId (fetched from profile)
  const [schoolId, setSchoolId] = useState(null);
  const [user, setUser] = useState();
  const [isHovered, setIsHovered] = useState(false);
  
  // REACT QUERY: Use hook for admin mentors - automatic caching!
  const { data: mentorsData = [], isLoading, refetch: refetchMentors } = useAdminMentors(schoolId);
  const invalidateMentors = useInvalidateAdminMentors();
  
  // Keep a local copy for filtering
  const [korisnici, setKorisnici] = useState([]);
  const otvoreno = 'mentori';
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredKorisnici, setFilteredKorisnici] = useState([]);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showMobileFiltersMenu, setShowMobileFiltersMenu] = useState(false);
  const [showMobileActionsMenu, setShowMobileActionsMenu] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showSecretLink, setShowSecretLink] = useState(false);
  const [secretLinkCopied, setSecretLinkCopied] = useState(false);

  // Program filtering state
  const [programTabs, setProgramTabs] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState('all');

  // REACT QUERY: sendRequestUsers removed - now handled by useAdminMentors hook
  // Security filtering (cadenza.dev account) is done in the hook

  const handleDodajKorisnika = () => {
    console.log('Adding user logic here');
  };

  const handleCancelDodajKorisnika = () => {
    setOdabranoDodajKOrisnika(false);
  };

  const handleMoreDetails = (mentorId) => {
    setKorisnikDetaljiOtvoreno(mentorId);
  };

  const handleBulkUpload = async () => {
    try {
      if (!selectedFile) {
        showNotification({
          type: 'error',
          message: 'Molimo odaberite XLSX datoteku'
        });
        return;
      }

      setIsUploading(true);
      setProgressMessage('Započinjem učitavanje...');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await ApiConfig.api.post('/api/mentors/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          setProgressMessage(`Učitavanje: ${percentCompleted}%`);
        }
      });

      const { successCount, errorCount, results } = response.data;

      // Format notification message
      let message = `Dodano ${successCount} mentora uspješno.`;
      if (errorCount > 0) {
        message += ` ${errorCount} mentora ima greške.`;
        const errors = results.filter(r => r.status === 'error')
          .map(r => `${r.email}: ${r.message}`)
          .join('\n');
        message += `\nGreške:\n${errors}`;
      }

      showNotification({
        type: successCount > 0 ? 'success' : 'error',
        message
      });

      // Close upload dialog and refresh data
      setShowBulkUpload(false);
      setSelectedFile(null);
      await sendRequestUsers(); // Refresh the list
    } catch (error) {
      console.error('Error uploading mentors:', error);
      showNotification({
        type: 'error',
        message: error.response?.data?.message || 'Greška pri učitavanju mentora'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setProgressMessage('');
    }
  };

  const handleCopySecretLink = () => {
    const secretLink = `${window.location.origin}/signup/f8h3k2j9d5m7n1p4q6r8s0t2u4v6w8x0`;
    navigator.clipboard.writeText(secretLink).then(() => {
      setSecretLinkCopied(true);
             showNotification('success', 'Link za registraciju kopiran u međuspremnik!');
      setTimeout(() => setSecretLinkCopied(false), 3000);
    }).catch(() => {
             showNotification('error', 'Greška pri kopiranju linka');
    });
  };

  // Program filtering logic
  const filterByProgram = useCallback((mentors, programFilter) => {
    if (programFilter === 'all') return mentors;

    return mentors.filter(mentor => {
      if (!mentor.programs || !Array.isArray(mentor.programs)) return false;
      return mentor.programs.some(program => program.id === parseInt(programFilter));
    });
  }, []);

  // Generate program tabs from mentors data
  const generateProgramTabs = useCallback((mentors) => {
    const programMap = new Map();

    mentors.forEach(mentor => {
      if (mentor.programs && Array.isArray(mentor.programs)) {
        mentor.programs.forEach(program => {
          if (!programMap.has(program.id)) {
            programMap.set(program.id, {
              id: program.id,
              name: program.naziv,
              count: 0
            });
          }
          programMap.get(program.id).count++;
        });
      }
    });

    // Convert to array and sort by name
    const tabs = Array.from(programMap.values())
      .filter(tab => tab.count > 0) // Only show programs with mentors
      .sort((a, b) => a.name.localeCompare(b.name));

    return tabs;
  }, []);

  // Fetch profile on mount to get schoolId
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRes = await ApiConfig.api.get('/api/profil');
        setSchoolId(profileRes.data.user.schoolId); // This triggers React Query fetch
      } catch (error) {
        console.error('Error fetching profile:', error);
        showNotification({
          type: 'error',
          message: 'Greška pri dohvaćanju profila'
        });
      }
    };

    fetchProfile();
  }, []);

  // Process mentorsData when it changes from React Query
  useEffect(() => {
    if (!mentorsData || mentorsData.length === 0) return;

    setKorisnici(mentorsData);

    // Generate program tabs
    const tabs = generateProgramTabs(mentorsData);
    setProgramTabs(tabs);

    // Apply initial filtering
    const filtered = filterByProgram(mentorsData, selectedProgram);
    setFilteredKorisnici(filtered);
  }, [mentorsData, generateProgramTabs, filterByProgram, selectedProgram]);

  // Separate effect for program filtering changes
  useEffect(() => {
    if (korisnici.length > 0) {
      const filtered = filterByProgram(korisnici, selectedProgram);
      setFilteredKorisnici(filtered);
    }
  }, [selectedProgram, korisnici, filterByProgram]);

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    if (!korisnici || !Array.isArray(korisnici)) {
      setFilteredKorisnici([]);
      return;
    }

    // First filter by program
    const programFiltered = filterByProgram(korisnici, selectedProgram);

    // Then filter by search term
    const filtered = programFiltered.filter(korisnik => {
      const fullName = `${korisnik.ime || ''} ${korisnik.prezime || ''}`.toLowerCase();
      const username = (korisnik.korisnickoIme || '').toLowerCase();
      const email = (korisnik.email || '').toLowerCase();
      const oib = (korisnik.oib || '').toLowerCase();

      return fullName.includes(term) ||
             username.includes(term) ||
             email.includes(term) ||
             oib.includes(term);
    });

    setFilteredKorisnici(filtered);
  };

  const handleProgramTabClick = (programId) => {
    setSelectedProgram(programId);
    setSearchTerm(''); // Reset search when changing program

    // Filter mentors by program
    const filtered = filterByProgram(korisnici, programId);
    setFilteredKorisnici(filtered);
  };

  const exportMentorsCSV = () => {
    try {
      const decimalSeparatorIsComma = Intl.NumberFormat().format(1.1).includes(',');
      const delimiter = decimalSeparatorIsComma ? ';' : ',';
      const headers = [
        'Korisničko ime',
        'Ime',
        'Prezime',
        'Email',
        'OIB',
        'Administrator',
        'Ulica',
        'Broj',
        'Mjesto',
        'Poštanski broj',
        'Država',
        'Programi',
        'Datum registracije',
        'Datum zadnje prijave',
        'Uloga'
      ];

      const rows = (filteredKorisnici || []).map((u) => [
        u.korisnickoIme || '',
        u.ime || '',
        u.prezime || '',
        u.email || '',
        u.oib || '',
        u.isAdmin ? 'Da' : 'Ne',
        u.adresa?.ulica || '',
        u.adresa?.kucniBroj || '',
        u.adresa?.mjesto || '',
        u.adresa?.postanskiBroj || '',
        u.adresa?.drzava || '',
        u.programs ? u.programs.map(p => p.naziv).join(', ') : '',
        u.createdAt ? new Date(u.createdAt).toLocaleDateString('hr-HR') : '',
        u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('hr-HR') : '',
        u.isAdmin ? 'Administrator' : (u.isMentor ? 'Mentor' : 'Bez uloge'),
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
      link.setAttribute('download', `mentori_${new Date().toISOString().slice(0, 10)}.csv`);
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
        <MentorDetalji
          korisnikId={korisnikDetaljiOtvoreno}
          onCancel={() => setKorisnikDetaljiOtvoreno(false)}
          onSave={() => invalidateMentors()}
        />
      )}
      {odabranoDodajKorisnika && (
        <DodajMentora
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
                <span style={{color: 'rgb(var(--isticanje))'}}>
                  {selectedProgram === 'all'
                    ? `Ukupno mentora: ${korisnici?.length || 0}`
                    : `Mentori u programu: ${filteredKorisnici?.length || 0}`
                  }
                </span>
                <div className="p">
                  Dodavanjem korisnika se na njihovu e-mail adresu (pohranjenu u polje za e-mail) šalju njihovi podaci za prijavu: email i lozinka.
                </div>
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
                  <Icon icon="solar:user-plus-broken" fontSize="large" /> Dodaj mentora
                </button>
                <button
                  className="action-btn spremiBtn"
                  onClick={() => setShowBulkUpload(true)}
                >
                  <Icon icon="solar:upload-broken" /> Učitaj iz XLSX
                </button>
                <button
                  className="action-btn abExpand"
                  onClick={() => setShowSecretLink(!showSecretLink)}
                  style={{
                    backgroundColor: showSecretLink ? 'rgb(var(--isticanje))' : '',
                    color: showSecretLink ? 'white' : ''
                  }}
                >
                  <Icon icon="solar:link-broken" /> Link za registraciju
                </button>
                <button
                  className="action-btn abExpand"
                  onClick={exportMentorsCSV}
                >
                  <Icon icon="solar:download-broken" /> Izvezi CSV
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
                  <Icon icon="solar:user-plus-broken" fontSize="large" /> Dodaj mentora
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
                          setShowSecretLink(!showSecretLink);
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
                        <Icon icon="solar:link-broken" /> Link za registraciju
                      </button>
                      <button
                        className="action-btn"
                        onClick={() => {
                          exportMentorsCSV();
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
                        <Icon icon="solar:download-broken" /> Izvezi CSV
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

            {showSecretLink && (
              <div className="karticaZadatka" style={{
                border: '1px solid rgb(var(--isticanje))'
              }}>
                <div className="div-row">
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: 'rgb(var(--isticanje))', fontWeight: 'bold' }}>
                      Link za registraciju mentora:
                    </span>
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'var(--pozadina)',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    wordBreak: 'break-all'
                  }}>
                    <span style={{ flex: 1 }}>
                      {window.location.origin}/signup/f8h3k2j9d5m7n1p4q6r8s0t2u4v6w8x0
                    </span>
                    <button
                      className="gumb action-btn spremiBtn"
                      onClick={handleCopySecretLink}
                      style={{ minWidth: 'auto', padding: '0.3rem 0.6rem' }}
                    >
                      <Icon icon={secretLinkCopied ? "solar:check-circle-broken" : "solar:copy-broken"} />
                      {secretLinkCopied ? 'Kopirano!' : 'Kopiraj'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgb(var(--isticanje))', marginTop: '0.5rem' }}>
                    Podijelite ovaj link s mentorima koji se žele registrirati. Link koristi istu funkcionalnost kao "Dodaj mentora".
                  </div>
                </div>
              </div>
            )}

            {/* Layout container for sidebar + table */}
            <div className="karticaZadatka mentori-layout-container" style={{ display: 'flex', gap: '1.5rem', alignItems: 'start', flexDirection: 'row', justifyContent: 'center' }}>
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
                    onClick={() => handleProgramTabClick('all')}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      border: 'none',
                      background: selectedProgram === 'all' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                      color: selectedProgram === 'all' ? 'var(--pozadina)' : 'var(--tekst)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: selectedProgram === 'all' ? 600 : 400,
                      marginBottom: '0.25rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    <span><Icon icon="solar:users-group-rounded-broken" /> Svi mentori</span>
                    <span className="poll-count">{korisnici?.length || 0}</span>
                  </button>
                </div>

                {/* Programs */}
                {programTabs.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--tekst)', opacity: 0.6, marginBottom: '0.5rem', textTransform: 'uppercase' }}>Programi</div>
                    {programTabs.map((tab) => (
                      <button
                        key={tab.id}
                        className="filter-sidebar-btn"
                        onClick={() => handleProgramTabClick(tab.id.toString())}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem',
                          border: 'none',
                          background: selectedProgram === tab.id.toString() ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                          color: selectedProgram === tab.id.toString() ? 'var(--pozadina)' : 'var(--tekst)',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: selectedProgram === tab.id.toString() ? 600 : 400,
                          marginBottom: '0.25rem',
                          transition: 'all 0.2s',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Icon icon="solar:music-notes-broken" /> {tab.name}
                        </span>
                        <span className="poll-count" style={{ flexShrink: 0, marginLeft: '0.5rem' }}>{tab.count}</span>
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
                      onClick={() => handleProgramTabClick('all')}
                      style={{
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        background: selectedProgram === 'all' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                        color: selectedProgram === 'all' ? 'var(--pozadina)' : 'var(--tekst)'
                      }}
                    >
                      <Icon icon="solar:users-group-rounded-broken" /> Svi
                    </button>

                    {/* Overflow menu button */}
                    {programTabs.length > 0 && (
                      <button
                        className="filter-btn"
                        onClick={() => setShowMobileFiltersMenu(true)}
                        style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        <Icon icon="solar:filter-bold" /> Više filtera
                      </button>
                    )}
                  </div>
                </div>

                <div className="tablica">
              <div className="tr naziv">
                <div className="th filter" style={{ gridColumn: '1 / -1' }}>
                  <input
                    type="text"
                    className="input-login-signup"
                    placeholder="Pretraži mentore..."
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
                          {korisnik.isAdmin && (
                            <div className="txt-min2" style={{ color: 'rgb(var(--isticanje))', fontWeight: 600 }}>
                              Administrator
                            </div>
                          )}
                        </div>
                        <div
                          className={`action-btn btn abExpand ${isHovered ? 'hovered' : ''}`}
                          onClick={() => handleMoreDetails(korisnik.id)}
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
                  <p>{searchTerm ? 'Nema rezultata za pretragu!' : 'Nema mentora u bazi!'}</p>
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
                    {/* All Mentors */}
                    <div style={{ marginBottom: '1rem' }}>
                      <button
                        className="action-btn"
                        onClick={() => {
                          handleProgramTabClick('all');
                          setShowMobileFiltersMenu(false);
                        }}
                        style={{
                          width: '100%',
                          justifyContent: 'space-between',
                          background: selectedProgram === 'all' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                          color: selectedProgram === 'all' ? 'var(--pozadina)' : 'var(--tekst)'
                        }}
                      >
                        <span><Icon icon="solar:users-group-rounded-broken" /> Svi mentori</span>
                        <span className="poll-count">{korisnici?.length || 0}</span>
                      </button>
                    </div>

                    {/* Programs section */}
                    {programTabs.length > 0 && (
                      <div style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.5rem', opacity: 0.6, textTransform: 'uppercase' }}>Programi</div>
                        {programTabs.map((tab) => (
                          <button
                            key={tab.id}
                            className="action-btn"
                            onClick={() => {
                              handleProgramTabClick(tab.id.toString());
                              setShowMobileFiltersMenu(false);
                            }}
                            style={{
                              width: '100%',
                              justifyContent: 'space-between',
                              marginBottom: '0.5rem',
                              background: selectedProgram === tab.id.toString() ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                              color: selectedProgram === tab.id.toString() ? 'var(--pozadina)' : 'var(--tekst)'
                            }}
                          >
                            <span><Icon icon="solar:music-notes-broken" /> {tab.name}</span>
                            <span className="poll-count">{tab.count}</span>
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
              }
              @media (max-width: 768px) {
                .desktop-filters {
                  display: none !important;
                }
                .mobile-filters {
                  display: block !important;
                }
                .mentori-layout-container {
                  flex-direction: column !important;
                  align-items: center !important;
                }
                .mentori-layout-container > div:not(.desktop-filters) {
                  width: 100% !important;
                  max-width: 100% !important;
                }
              }
            `}} />

            {/* Bulk Upload Modal */}
            {showBulkUpload && (
              <Modal
                isOpen={true}
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
                    Učitavanje mentora iz XLSX datoteke
                  </>
                }
                maxWidth="800px"
                isFormModal={true}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {/* Description */}
                  <p style={{ margin: 0 }}>
                    Učitajte više mentora odjednom pomoću XLSX datoteke. Preuzmite predložak datoteke, ispunite ga s podacima mentora i učitajte ga ovdje.
                  </p>

                  {/* Template Download */}
                  <div style={{
                    background: 'rgba(var(--isticanje), 0.05)',
                    padding: '1rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid rgba(var(--isticanje), 0.2)'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Icon icon="solar:document-add-broken" style={{ fontSize: '1.2rem' }} />
                      Predložak datoteke
                    </div>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', opacity: 0.9 }}>
                      Preuzmite predložak XLSX datoteke s pravilno formatiranim stupcima.
                    </p>
                    <a
                      href="/Predlozak_Mentori.xlsx"
                      download
                      className="action-btn abEdit"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
                    >
                      <Icon icon="solar:download-broken" />
                      Preuzmi predložak (XLSX)
                    </a>
                  </div>

                  {/* Required Fields */}
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Icon icon="solar:list-check-broken" style={{ fontSize: '1.2rem', color: 'rgb(var(--isticanje))' }} />
                      Potrebna polja u datoteci
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '0.5rem',
                      fontSize: '0.95rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'red', fontWeight: 'bold' }}>*</span>
                        <span>Ime</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'red', fontWeight: 'bold' }}>*</span>
                        <span>Prezime</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'red', fontWeight: 'bold' }}>*</span>
                        <span>Email</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'red', fontWeight: 'bold' }}>*</span>
                        <span>OIB (11 znamenki)</span>
                      </div>
                      <div style={{ opacity: 0.7 }}>Ulica (opcionalno)</div>
                      <div style={{ opacity: 0.7 }}>Kućni broj (opcionalno)</div>
                      <div style={{ opacity: 0.7 }}>Mjesto (opcionalno)</div>
                    </div>
                  </div>

                  {/* Important Notes */}
                  <div style={{
                    background: 'rgba(var(--isticanje2), 0.1)',
                    padding: '1rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid rgba(var(--isticanje2), 0.3)'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Icon icon="solar:info-circle-broken" style={{ fontSize: '1.2rem' }} />
                      Važne napomene
                    </div>
                    <ul style={{ margin: '0', paddingLeft: '1.5rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
                      <li>Polja označena <span style={{ color: 'red', fontWeight: 'bold' }}>*</span> su obavezna</li>
                      <li><strong>OIB stupac u Excelu mora biti formatiran kao Text</strong> kako bi se sačuvale vodece nule</li>
                      <li>Naknadno uređivanje podataka je moguće</li>
                      <li>Nakon učitavanja, svakom mentoru dodijelite programe i učenike</li>
                      <li>Učenicima je moguće dodati programe samo kada njihov mentor ima dodijeljen program</li>
                    </ul>
                  </div>

                  {/* File Upload Section */}
                  <div style={{
                    border: '2px dashed rgba(var(--isticanje), 0.3)',
                    borderRadius: 'var(--radius)',
                    padding: '1.5rem',
                    textAlign: 'center',
                    background: 'rgba(var(--isticanje), 0.02)'
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
                      style={{ display: 'none' }}
                      id="mentors-file-input"
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="mentors-file-input"
                      className={`action-btn spremiBtn ${isUploading ? 'disabled' : ''}`}
                      style={{ cursor: isUploading ? 'not-allowed' : 'pointer', display: 'inline-flex' }}
                    >
                      <Icon
                        icon={isUploading ? "solar:loading-bold-duotone" : "solar:upload-broken"}
                        className={isUploading ? "spin" : ""}
                      />
                      {isUploading ? 'Učitavanje...' : 'Odaberi XLSX datoteku'}
                    </label>

                    {selectedFile && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'rgba(var(--isticanje), 0.05)',
                        borderRadius: 'var(--radius)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                          <Icon icon="solar:file-check-broken" style={{ color: 'rgb(var(--isticanje))' }} />
                          {selectedFile.name}
                        </div>
                        <button
                          className="gumb action-btn spremiBtn"
                          onClick={handleBulkUpload}
                          disabled={isUploading}
                          style={{ display: 'inline-flex' }}
                        >
                          <Icon icon="solar:cloud-upload-broken" />
                          {isUploading ? 'Učitavanje...' : 'Učitaj mentore'}
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
                        background: 'rgba(var(--isticanje2), 0.2)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        marginBottom: '0.5rem'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${uploadProgress}%`,
                          background: 'rgb(var(--isticanje))',
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                      <p style={{ margin: 0, textAlign: 'center', fontWeight: 600, color: 'rgb(var(--isticanje))' }}>
                        {progressMessage}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="div-radio">
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
                      type="button"
                    >
                      <Icon icon="solar:close-circle-broken" /> Odustani
                    </button>
                  </div>
                </div>
              </Modal>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default Mentori;
