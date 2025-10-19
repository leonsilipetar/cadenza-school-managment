import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authActions } from '../store/index';
import { Icon } from '@iconify/react';
import ApiConfig from '../components/apiConfig.js';
import Navigacija from './navigacija';
import NavTop from './nav-top';
import UserInfoComponent from '../components/UserInfo';
import { clearPWAUser, isPWA } from '../utils/pwaUtils';
import LoadingShell from '../components/LoadingShell.jsx';
import { showNotification } from '../components/Notifikacija';
import './Profile.css';
import KorisnikDetalji from './administracija/KorisnikDetalji.jsx';

axios.defaults.withCredentials = true;

const Profile = ({ user, unreadChatsCount }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [profileData, setProfileData] = useState(null);
  const [schools, setSchools] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [showSettings, setShowSettings] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState(null);
  const [enrollmentSchoolYear, setEnrollmentSchoolYear] = useState(null);
  const [showEnrollmentInfo, setShowEnrollmentInfo] = useState(false);
  const otvoreno = 'profil';
  const [pdfLoading, setPdfLoading] = useState(false);
  const [freshUser, setFreshUser] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
  const [mentorStudents, setMentorStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [showStudentDetails, setShowStudentDetails] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // Initialize reminderSettings from user data or defaults
  const [reminderSettings, setReminderSettings] = useState(() => {
    if (user?.reminderPreferences) {
      return {
        reminderTime: user.reminderPreferences.reminderTime || '14:00',
        classReminders: user.reminderPreferences.classReminders ?? true,
        practiceReminders: user.reminderPreferences.practiceReminders ?? true
      };
    }
    // Only set defaults if there are no user preferences at all
    return {
      reminderTime: '14:00',
      classReminders: true,
      practiceReminders: true
    };
  });

  // Linked accounts for same email
  const [linkedAccounts, setLinkedAccounts] = useState([]);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  // Update reminderSettings when user data changes
  useEffect(() => {
    if (user?.reminderPreferences) {
      setReminderSettings({
        reminderTime: user.reminderPreferences.reminderTime || '14:00',
        classReminders: user.reminderPreferences.classReminders ?? true,
        practiceReminders: user.reminderPreferences.practiceReminders ?? true
      });
    }
  }, [user?.reminderPreferences]);

  // Fetch linked accounts by email
  useEffect(() => {
    const fetchLinkedAccounts = async () => {
      try {
        const res = await ApiConfig.api.get('/api/linked-accounts', { headers: { 'Cache-Control': 'no-cache' }, params: { t: Date.now() } });
        if (Array.isArray(res.data?.accounts)) {
          // Only keep accounts different from current to show as choices
          setLinkedAccounts(res.data.accounts);
        }
      } catch (err) {
        // ignore silently; feature is optional
      }
    };
    if (user?.email) {
      fetchLinkedAccounts();
    }
  }, [user?.email]);

  // Fetch fresh user (ensures programs and associations are present)
  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        // QUICK WIN: Removed unnecessary no-cache and timestamp params
        const res = await ApiConfig.cachedApi.get('/api/user');
        if (mounted && res?.user) setFreshUser(res.user);
      } catch (_) {
        // ignore
      }
    };
    loadUser();
    return () => { mounted = false; };
  }, []);

  // Color presets (synced with App.css - modern colors)
  const colorPresets = {
    teal: {
      name: 'Teal (Default)',
      isticanje: '20, 184, 166',
      isticanje2: '203, 213, 225',
      isticanje3: '6, 182, 212',
      pozadina: '248, 250, 252'
    },
    blue: {
      name: 'Plava',
      isticanje: '59, 130, 246',
      isticanje2: '191, 219, 254',
      isticanje3: '37, 99, 235',
      pozadina: '239, 246, 255'
    },
    purple: {
      name: 'Ljubičasta',
      isticanje: '139, 92, 246',
      isticanje2: '221, 214, 254',
      isticanje3: '124, 58, 237',
      pozadina: '250, 245, 255'
    },
    green: {
      name: 'Zelena',
      isticanje: '16, 185, 129',
      isticanje2: '209, 250, 229',
      isticanje3: '5, 150, 105',
      pozadina: '240, 253, 244'
    },
    orange: {
      name: 'Narančasta (Legacy)',
      isticanje: '249, 115, 22',
      isticanje2: '254, 215, 170',
      isticanje3: '255, 155, 0',
      pozadina: '255, 247, 237'
    },
    red: {
      name: 'Crvena',
      isticanje: '239, 68, 68',
      isticanje2: '254, 202, 202',
      isticanje3: '220, 38, 38',
      pozadina: '254, 242, 242'
    },
    rose: {
      name: 'Rose',
      isticanje: '255, 105, 180',
      isticanje2: '252, 231, 243',
      isticanje3: '219, 39, 119',
      pozadina: '253, 242, 248'
    }
  };

  // Initialize color settings from localStorage
  const [colorSettings, setColorSettings] = useState(() => {
    const savedColors = {
      isticanje: localStorage.getItem('isticanje'),
      isticanje2: localStorage.getItem('isticanje2'),
      isticanje3: localStorage.getItem('isticanje3'),
      pozadina: localStorage.getItem('pozadina')
    };

    // If no saved colors, use teal preset (new default)
    if (!savedColors.isticanje) {
      return colorPresets.teal;
    }

    return savedColors;
  });

  // Apply saved colors on component mount
  useEffect(() => {
    applyColorTheme(colorSettings);
  }, []); // Empty dependency array means this runs once on mount

  // Apply color theme
  const applyColorTheme = (colors) => {
    // Update CSS variables
    document.documentElement.style.setProperty('--isticanje', colors.isticanje);
    document.documentElement.style.setProperty('--isticanje2', colors.isticanje2);
    document.documentElement.style.setProperty('--isticanje3', colors.isticanje3);
    document.documentElement.style.setProperty('--pozadina', colors.pozadina);

    // Save to localStorage
    localStorage.setItem('isticanje', colors.isticanje);
    localStorage.setItem('isticanje2', colors.isticanje2);
    localStorage.setItem('isticanje3', colors.isticanje3);
    localStorage.setItem('pozadina', colors.pozadina);

    setColorSettings(colors);
  };

  // Settings Popup Component
  const SettingsPopup = ({ onClose }) => {
    const [localSettings, setLocalSettings] = useState({
      theme,
      reminderSettings: { ...reminderSettings },
      colorSettings: { ...colorSettings }
    });

    // Update localSettings when parent reminderSettings changes
    useEffect(() => {
      setLocalSettings(prev => ({
        ...prev,
        reminderSettings: { ...reminderSettings }
      }));
    }, [reminderSettings]);

    const handleSave = async () => {
      try {
        // Save theme
        setTheme(localSettings.theme);
        document.body.className = localSettings.theme;
        localStorage.setItem('theme', localSettings.theme);

        // Save reminder settings
        if (user?.isStudent) {
          const response = await ApiConfig.api.post('/api/user/reminder-settings', {
            reminderPreferences: {
              reminderTime: localSettings.reminderSettings.reminderTime,
              classReminders: Boolean(localSettings.reminderSettings.classReminders),
              practiceReminders: Boolean(localSettings.reminderSettings.practiceReminders)
            }
          });

          if (response.data?.data?.reminderPreferences) {
            const newSettings = response.data.data.reminderPreferences;
            setReminderSettings({
              reminderTime: newSettings.reminderTime || '14:00',
              classReminders: Boolean(newSettings.classReminders),
              practiceReminders: Boolean(newSettings.practiceReminders)
            });
          }
        }

        // Apply color settings
        applyColorTheme(localSettings.colorSettings);

        showNotification('success', 'Postavke su uspješno spremljene');

        setTimeout(() => {
          onClose();
        }, 3000);
      } catch (error) {
        console.error('Error saving settings:', error);
        showNotification('error', 'Greška pri spremanju postavki');

        setTimeout(() => {
          onClose();
        }, 3000);
      }
    };

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Postavke</h2>
            <button className="modal-close-button" onClick={onClose}>
              <Icon icon="solar:close-circle-broken" />
            </button>
          </div>

          <div className="modal-body">
            {/* Theme Settings */}
            <div className="settings-section">
              <h3>Tema</h3>
              <div className="theme-options">
                <button
                  className={`theme-button ${localSettings.theme === 'light' ? 'active' : ''}`}
                  onClick={() => setLocalSettings(prev => ({ ...prev, theme: 'light' }))}
                >
                  <Icon icon="solar:sun-broken" />
                  Svijetla
                </button>
                <button
                  className={`theme-button ${localSettings.theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setLocalSettings(prev => ({ ...prev, theme: 'dark' }))}
                >
                  <Icon icon="solar:moon-stars-broken" />
                  Tamna
                </button>
              </div>
            </div>

            {/* Color Settings */}
            <div className="settings-section">
              <h3>Boje</h3>
              <div className="color-presets">
                {Object.entries(colorPresets).map(([name, colors]) => (
                  <button
                    key={name}
                    className={`color-preset-button ${
                      JSON.stringify(colors) === JSON.stringify(localSettings.colorSettings) ? 'active' : ''
                    }`}
                    onClick={() => setLocalSettings(prev => ({
                      ...prev,
                      colorSettings: colors
                    }))}
                    style={{
                      '--isticanje': colors.isticanje,
                      '--isticanje2': colors.isticanje2
                    }}
                  >
                    <span className="preset-name">
                      {colors.name || name.charAt(0).toUpperCase() + name.slice(1)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Reminder Settings (only for students) */}
            {user?.isStudent && (
              <div className="settings-section">
                <h3>Podsjetnici</h3>
                <div className="reminder-options">
                  <label className="reminder-option">
                    <input
                      type="checkbox"
                      checked={localSettings.reminderSettings.practiceReminders}
                      onChange={e => setLocalSettings(prev => ({
                        ...prev,
                        reminderSettings: {
                          ...prev.reminderSettings,
                          practiceReminders: e.target.checked
                        }
                      }))}
                    />
                    <span>Podsjetnici za vježbanje</span>
                  </label>
                  <label className="reminder-option">
                    <input
                      type="checkbox"
                      checked={localSettings.reminderSettings.classReminders}
                      onChange={e => setLocalSettings(prev => ({
                        ...prev,
                        reminderSettings: {
                          ...prev.reminderSettings,
                          classReminders: e.target.checked
                        }
                      }))}
                    />
                    <span>Podsjetnici za nastavu</span>
                  </label>
                  <div className="time-picker">
                    <span>Vrijeme podsjetnika:</span>
                    <input
                      type="time"
                      value={localSettings.reminderSettings.reminderTime}
                      onChange={e => setLocalSettings(prev => ({
                        ...prev,
                        reminderSettings: {
                          ...prev.reminderSettings,
                          reminderTime: e.target.value
                        }
                      }))}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="action-btn zatvoriBtn" onClick={onClose}>Odustani</button>
            <button className="action-btn spremiBtn" onClick={handleSave}>Spremi</button>
          </div>
        </div>
      </div>
    );
  };

  // Check enrollment status
  useEffect(() => {
    const checkEnrollmentStatus = async () => {
      if (user && user.isStudent) {
        try {
          const res = await ApiConfig.api.get('/api/enrollment/current', { headers: { 'Cache-Control': 'no-cache' }, params: { t: Date.now() } });
          const payload = res?.data || {};
          const hasEnrolled = payload.enrollment && payload.enrollment.agreementAccepted;
          setEnrollmentStatus(hasEnrolled ? payload.enrollment : null);
          setEnrollmentSchoolYear(payload.schoolYear);

          const currentMonth = new Date().getMonth() + 1; // 1-12
          const needsEnrollment = !hasEnrolled;

          // Show enrollment info if:
          // - Month 6-8 (June-August): Show info about upcoming enrollment
          // - Month 9-12 (September-December): Show enrollment required
          if ((currentMonth >= 6 && currentMonth <= 8) || (currentMonth >= 9 && currentMonth <= 12)) {
            setShowEnrollmentInfo(true);
          }
        } catch (err) {
          console.error('Error checking enrollment status:', err);
          setEnrollmentStatus(false);
          const currentMonth = new Date().getMonth() + 1;
          if ((currentMonth >= 6 && currentMonth <= 8) || (currentMonth >= 9 && currentMonth <= 12)) {
            setShowEnrollmentInfo(true);
          }
        }
      }
    };

    checkEnrollmentStatus();
  }, [user]);

  // Download own enrollment confirmation PDF
  const downloadMyEnrollmentConfirmation = async () => {
    try {
      if (!user?.id) return;
      setPdfLoading(true);
      const res = await ApiConfig.api.get('/api/enrollment/my/upis-pdf', { responseType: 'blob', headers: { 'Cache-Control': 'no-cache' }, params: { t: Date.now() } });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const ime = (user.ime || '').trim().replace(/\s+/g, '_');
      const prezime = (user.prezime || '').trim().replace(/\s+/g, '_');
      link.href = url;
      link.download = `potvrda-upisa_${ime}_${prezime}_${user.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification('success', 'PDF generiran');
    } catch (err) {
      console.error('PDF generation error:', err);
      showNotification('error', 'Greška pri generiranju potvrde');
    } finally {
      setPdfLoading(false);
    }
  };

  // Single data fetch effect
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!user) return;

      try {
        setLoading(true);
        // QUICK WIN: Removed no-cache headers to allow caching
        const [schoolsRes, mentorsRes] = await Promise.all([
          ApiConfig.cachedApi.get('/api/schools'),
          ApiConfig.cachedApi.get('/api/mentori')
        ]);

        if (isMounted) {
          setSchools(schoolsRes.data || schoolsRes);
          setMentors(mentorsRes.data || mentorsRes);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        if (isMounted) {
          showNotification('error', 'Greška pri dohvaćanju podataka');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Fetch mentor students when mentors open the Students tab
  useEffect(() => {
    const fetchStudents = async () => {
      if (!user?.isMentor || activeTab !== 'students') return;
      try {
        setStudentsLoading(true);
        // QUICK WIN: Removed no-cache to allow caching
        const res = await ApiConfig.cachedApi.get('/api/mentors/students');
        setMentorStudents(Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : []);
      } catch (e) {
        console.error('Error fetching mentor students:', e);
        setMentorStudents([]);
        showNotification('error', 'Greška pri dohvaćanju učenika');
      } finally {
        setStudentsLoading(false);
      }
    };
    fetchStudents();
  }, [activeTab, user?.isMentor]);

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (dispatch) {
      dispatch({ type: 'LOGOUT' });
    }
    window.location.href = '/login';
  };

  // Memoize helper functions
  const getSchoolName = useCallback((schoolId) => {
    if (!schoolId || !schools.length) return 'Unknown School';
    const school = schools.find(s => s.id === schoolId);
    return school ? school.name : 'Unknown School';
  }, [schools]);

  const getMentorName = useCallback((mentorId) => {
    if (!mentorId || !mentors.length) return 'Unknown Mentor';
    const mentor = mentors.find(m => m.id === mentorId);
    return mentor ? `${mentor.ime} ${mentor.prezime}` : 'Unknown Mentor';
  }, [mentors]);

  if (loading) return <LoadingShell />;

  return (
    <>
      <Navigacija user={user} otvoreno={otvoreno} unreadChatsCount={unreadChatsCount} />
      <NavTop user={user} naslov="Profil" />

      <div className="main">
        

        {/* Mentor Students Tab */}
        {user?.isMentor && activeTab === 'students' && (
          <div className="karticaZadatka">
            <div className="notification-filters" style={{ marginBottom: '0.75rem' }}>
              <button
                className={`filter-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <Icon icon="solar:user-id-broken" /> Moj profil
              </button>
              <button
                className={`filter-btn ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
              >
                <Icon icon="solar:users-group-rounded-broken" /> Moji učenici {mentorStudents?.length > 0 && <span className="poll-count">{mentorStudents.length}</span>}
              </button>
            </div>
            {studentsLoading ? (
              <LoadingShell />
            ) : (
              <div className="tablica">
                <div className="tr naziv">
                  <div className="th">Ime i prezime</div>
                  <div className="th">Email</div>
                  <div className="th">Programi</div>
                  <div className="th"></div>
                </div>
                {(mentorStudents || []).map((s) => (
                  <div key={s.id} className="tr redak">
                    <div className="th">{s.ime} {s.prezime}</div>
                    <div className="th">{s.email}</div>
                    <div className="th">{Array.isArray(s.program) ? s.program.map(p => p.naziv).join(', ') : ''}</div>
                    <div className="th">
                      <button
                        className="action-btn abEdit"
                        onClick={() => { setSelectedStudentId(s.id); setShowStudentDetails(true); }}
                      >
                        <Icon icon="solar:pen-broken" /> Uredi
                      </button>
                    </div>
                  </div>
                ))}
                {(mentorStudents || []).length === 0 && (
                  <div className="tr redak">
                    <div className="th" colSpan="4">Nema dodijeljenih učenika.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Profile Tab Content */}
        {activeTab === 'profile' && (
        <>
        {/* Linked accounts switcher (if multiple accounts on same email) */}
        {user?.isStudent && Array.isArray(linkedAccounts) && linkedAccounts.length > 1 && (
          <div className="karticaZadatka">
            <div className="div sbtwn">
              <div className="div">
                <h3 style={{ margin: 0 }}>Povezani računi</h3>
                <small>Brzo promijenite račun za djecu povezanu s ovom email adresom</small>
              </div>
              <button className="gumb action-btn" onClick={() => setShowAccountSwitcher(v => !v)}>
                <Icon icon={showAccountSwitcher ? 'solar:minus-square-broken' : 'solar:plus-square-broken'} />
                {showAccountSwitcher ? 'Sakrij' : 'Prikaži'}
              </button>
            </div>

            {showAccountSwitcher && (
              <div className="tablica" style={{ marginTop: '0.75rem' }}>
                <div className="tr naziv">
                  <div className="th">Korisnik</div>
                  <div className="th">Korisničko ime</div>
                  <div className="th">Radnja</div>
                </div>
                {linkedAccounts.map(acc => (
                  <div className="tr" key={acc.id}>
                    <div className="th">{acc.ime} {acc.prezime}{acc.isCurrent ? ' (trenutno prijavljen)' : ''}</div>
                    <div className="th">{acc.korisnickoIme}</div>
                    <div className="th">
                      {acc.isCurrent ? (
                        <span className="gumb" style={{ opacity: 0.6 }}>Aktivan</span>
                      ) : (
                        <a className="gumb action-btn" href={`/login?prefill=${encodeURIComponent(acc.korisnickoIme)}`}>
                          <Icon icon="solar:login-2-broken" /> Prijavi se kao
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="karticaZadatka" style={{ backgroundColor: 'transparent' }}>
            <div style={{ gap: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', width: '100%' }}>
              {/* Settings */}
              <button
                className="icon"
                onClick={() => setShowSettings(true)}
                title="Postavke"
                aria-label="Postavke"
                style={{ width: 50, height: 50, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--isticanje2),0.15)', border: '1px solid rgba(var(--isticanje2),0.3)', padding:10 }}
              >
                <Icon icon="solar:settings-broken" className="icon" />
              </button>



              {/* About */}
              <Link to="/about" title="O aplikaciji" aria-label="O aplikaciji" className="icon" style={{ width: 50, height: 50, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--isticanje2),0.15)', border: '1px solid rgba(var(--isticanje2),0.3)', padding:10 }}>
                <Icon icon={'solar:info-circle-broken'} className="icon"/>
              </Link>


            {/* Logout - last */}
            <button
              className={`icon ${isHovered ? 'hovered' : ''}`}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onClick={handleLogout}
              title="Odjavi se"
              aria-label="Odjavi se"
              style={{ width: 50, height: 50, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(var(--isticanje2),0.15)', border: '1px solid rgba(var(--isticanje2),0.3)', padding:10 }}
            >
              <Icon icon="solar:logout-2-broken" className="icon" />
            </button>
            </div>
        </div>

        {/* Enrollment Info */}
        {showEnrollmentInfo && user && user.isStudent && (
          <div className="karticaZadatka">
          <div className="enrollment-card">
            <div className="enrollment-header">
              <div className={`enrollment-icon ${enrollmentStatus ? 'success' : 'warning'}`}>
                <Icon icon={enrollmentStatus ? "solar:check-circle-broken" : "solar:bell-bing-bold-duotone"} />
              </div>
              <div>
                <h3 className="enrollment-title">
                  {enrollmentStatus ? 'Upis potvrđen' : 'Upis u školsku godinu'}
                </h3>
                <p className="enrollment-status">
                  {enrollmentStatus ? 'Status: Aktivno' : 'Status: Čeka potvrdu'}
                </p>
              </div>
            </div>

            <div className="enrollment-details">
              {enrollmentStatus ? (
                <>
                  <p>
                    Uspješno ste upisani za školsku godinu
                    <span className="enrollment-year-badge">{enrollmentSchoolYear}</span>
                  </p>
                  <div className="enrollment-date">
                    <Icon icon="solar:calendar-broken" />
                    <span>
                      Datum potvrde: {enrollmentStatus.agreementAcceptedAt ?
                        new Date(enrollmentStatus.agreementAcceptedAt).toLocaleDateString('hr-HR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) :
                        'Nije dostupan'
                      }
                    </span>
                  </div>
                  <div style={{ marginTop: '0.75rem' }}>
                    <button
                      className="enrollment-action-btn"
                      onClick={downloadMyEnrollmentConfirmation}
                      disabled={pdfLoading}
                      style={{ opacity: pdfLoading ? 0.6 : 1 }}
                      title="Preuzmi potvrdu o upisu (PDF)"
                    >
                      <Icon icon={pdfLoading ? 'eos-icons:three-dots-loading' : 'solar:document-broken'} />
                      {pdfLoading ? 'Generiram...' : 'Preuzmi potvrdu'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Potrebno je upisati se za školsku godinu
                    <span className="enrollment-year-badge">{enrollmentSchoolYear}</span>
                  </p>
                  <Link to="/enroll" className="enrollment-action-btn">
                    <Icon icon="solar:document-add-broken" />
                    Upiši se!
                  </Link>
                </>
              )}
            </div>
          </div>
          </div>
        )}

        {/* Mentor tabs moved above Uredi profil */}
        {user?.isMentor && (
          <div className="karticaZadatka posts">
            <div className="notification-filters">
              <button
                className={`filter-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => setActiveTab('profile')}
              >
                <Icon icon="solar:user-id-broken" /> Moj profil
              </button>
              <button
                className={`filter-btn ${activeTab === 'students' ? 'active' : ''}`}
                onClick={() => setActiveTab('students')}
              >
                <Icon icon="solar:users-group-rounded-broken" /> Moji učenici {mentorStudents?.length > 0 && <span className="poll-count">{mentorStudents.length}</span>}
              </button>
            </div>
          </div>
        )}

        {/* Mentor self-service action */}
        {user && user.isMentor && (
          <div className="karticaZadatka">
            <div className="div">
              <Link to="/mentor">
                <button className='gumb action-btn spremiBtn'>
                  <Icon icon={'solar:user-id-broken'} />
                 Uredi profil
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* Student self-service action */}
        {user && user.isStudent && (
          <div className="karticaZadatka">
            <div className="div">
              <Link to="/ucenik">
                <button className='gumb action-btn spremiBtn'>
                  <Icon icon={'solar:user-id-broken'} />
                  Uredi profil
                </button>
              </Link>
            </div>
          </div>
        )}

        {/* User info */}
        <div className="karticaZadatka">
          <div className="profilDiv">
            { (freshUser || user) && (
              <UserInfoComponent
                user={freshUser || user}
                schoolName={getSchoolName(user.schoolId)}
                mentorName={getMentorName(user.mentorId)}
              />
            )}
          </div>
        </div>

        {/* Settings Popup */}
        {showSettings && <SettingsPopup onClose={() => setShowSettings(false)} />}
        </>
        )}
      </div>

      {showStudentDetails && selectedStudentId && (
        <KorisnikDetalji
          korisnikId={selectedStudentId}
          onCancel={() => { setShowStudentDetails(false); setSelectedStudentId(null); }}
        />
      )}
    </>
  );
};

export default Profile;
