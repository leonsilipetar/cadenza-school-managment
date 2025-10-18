import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import NavigacijaAdmin from './NavigacijaAdmin';
import NavTopAdministracija from './NavTopAdmin.jsx';
import DodajProgram from './DodajProgram';
import ApiConfig from '../../components/apiConfig';
import ProgramDetalji from './ProgramDetalji';
import Notification from '../../components/Notifikacija';
import LoadingShell from '../../components/LoadingShell.jsx';

const Programs = () => {
  const [programs, setPrograms] = useState([]);
  const [odabranoDodajProgram, setOdabranoDodajProgram] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [showDetalji, setShowDetalji] = useState(false);
  const otvoreno = 'programi';
  const [user, setUser] = useState(null);
  const [deleteProgram, setDeleteProgram] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all'); // all, withPrices, inSignup

  const fetchPrograms = async () => {
    setIsLoading(true);
    try {
      // First get user
      const userRes = await ApiConfig.api.get('/api/user');
      if (!userRes.data?.user) {
        throw new Error('No user data received');
      }
      setUser(userRes.data.user);

      // Then get programs with user's school
      const programsRes = await ApiConfig.api.get('/api/programs');
      console.log('Programs response:', programsRes.data);

      setPrograms(Array.isArray(programsRes.data) ? programsRes.data : []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setNotification({
        type: 'error',
        message: 'Greška pri dohvaćanju programa: ' + (err.response?.data?.error || err.message)
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrograms();
  }, []);

  const handleDeleteProgram = async (programId) => {
    try {
      await ApiConfig.api.delete(`/api/programs/${programId}`);
      setPrograms(programs.filter((program) => program.id !== programId));
      setNotification({
        type: 'success',
        message: 'Program uspješno obrisan!'
      });
      setDeleteProgram(null);
    } catch (err) {
      console.error('Error deleting program:', err);
      setNotification({
        type: 'error',
        message: 'Greška pri brisanju programa'
      });
    }
  };

  const handleEditProgram = (program) => {
    setSelectedProgram(program);
    setShowDetalji(true);
  };

  const handleUpdateProgram = (updatedProgram) => {
    setPrograms(programs.map(p =>
      p.id === updatedProgram.id ? updatedProgram : p
    ));
    setShowDetalji(false);
    setSelectedProgram(null);
  };

  // Filter programs based on active filter
  const filteredPrograms = programs.filter(program => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'withPrices') return program.tipovi && program.tipovi.length > 0;
    if (activeFilter === 'inSignup') return program.showInSignup === true;
    return true;
  });

  if (isLoading) {
    return (
    <>
    <NavigacijaAdmin otvoreno={otvoreno} />
    <NavTopAdministracija naslov={'Administracija - Programi'} />
      <LoadingShell />
    </>);
  }

  return (
    <>
      <NavigacijaAdmin otvoreno={otvoreno} />
      <NavTopAdministracija naslov={'Administracija - Programi'} />
      {showDetalji && selectedProgram && (
        <ProgramDetalji
          program={selectedProgram}
          onClose={() => {
            setShowDetalji(false);
            setSelectedProgram(null);
          }}
          onUpdate={handleUpdateProgram}
        />
      )}
      {odabranoDodajProgram && user && (
        <DodajProgram
          onDodajProgram={() => {
            fetchPrograms();
            setOdabranoDodajProgram(false);
            setSelectedProgram(null);
          }}
          onCancel={() => {
            setOdabranoDodajProgram(false);
            setSelectedProgram(null);
          }}
          programToEdit={selectedProgram}
          user={user}
        />
      )}
      {deleteProgram && (
        <div className="popup">
          <div className="karticaZadatka">
            <h3>Potvrda brisanja</h3>
            <p>Jeste li sigurni da želite obrisati ovaj program?</p>
            <div className="div-radio">
              <button
                className="gumb action-btn zatvoriBtn"
                onClick={() => setDeleteProgram(null)}
              >
                Odustani
              </button>
              <button
                className="gumb action-btn abDelete"
                onClick={() => handleDeleteProgram(deleteProgram.id)}
              >
                Obriši
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="main">
        <div className="karticaZadatka" style={{ overflow: 'visible' }}>
          <div className="div-row">
            <span style={{color: 'rgb(var(--isticanje))'}}>
              {activeFilter === 'all' 
                ? `Ukupno programa: ${programs?.length || 0}`
                : `Filtrirani programi: ${filteredPrograms?.length || 0} / ${programs?.length || 0}`
              }
            </span>
            <div className="p">
              Programi predstavljaju obrazovne cjeline koje škola nudi. Svaki učenik mora biti dodijeljen programu kako bi mogao pristupiti rasporedu i nastavnim materijalima.
            </div>
          </div>

          {/* Filter buttons */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '1rem',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={() => setActiveFilter('all')}
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                background: activeFilter === 'all' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                color: activeFilter === 'all' ? 'var(--pozadina)' : 'var(--tekst)',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon icon="solar:list-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Svi programi
            </button>
            <button
              onClick={() => setActiveFilter('withPrices')}
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                background: activeFilter === 'withPrices' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                color: activeFilter === 'withPrices' ? 'var(--pozadina)' : 'var(--tekst)',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon icon="solar:euro-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              S cijenama
            </button>
            <button
              onClick={() => setActiveFilter('inSignup')}
              style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: 500,
                background: activeFilter === 'inSignup' ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                color: activeFilter === 'inSignup' ? 'var(--pozadina)' : 'var(--tekst)',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon icon="solar:eye-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Vidljivi pri prijavi
            </button>
          </div>

          {/* Desktop action */}
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
              onClick={() => setOdabranoDodajProgram(true)}
            >
              <Icon icon="solar:add-circle-broken" /> Dodaj program
            </button>
          </div>

          {/* Mobile action */}
          <div className="mobile-actions" style={{
            fontSize: '0.7rem',
            display: 'none',
            alignItems: 'center',
            marginTop: '1rem',
            gap: '0.5rem'
          }}>
            <button
              className="action-btn abEdit"
              onClick={() => setOdabranoDodajProgram(true)}
              style={{ flex: 1 }}
            >
              <Icon icon="solar:add-circle-broken" fontSize="large" /> Dodaj program
            </button>
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

        <div className="karticaZadatka" style={{ alignItems: 'stretch' }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, width: '100%' }}>Popis programa</h3>
          
          {filteredPrograms.length > 0 ? (
            <div className="tablica" style={{ width: '100%' }}>
              {filteredPrograms.map((program) => (
                <div key={program.id} className="tr redak">
                  <div style={{ gridColumn: '1 / -1', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: '200px' }}>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          {program.naziv}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                          {program.tipovi && program.tipovi.length > 0 && (
                            <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                              <Icon icon="solar:euro-broken" style={{ verticalAlign: 'middle' }} /> {program.tipovi.length} {program.tipovi.length === 1 ? 'cijena' : 'cijene'}
                            </span>
                          )}
                          {program.showInSignup && (
                            <span style={{ fontSize: '0.8rem', color: 'rgb(var(--zelena))' }}>
                              <Icon icon="solar:eye-broken" style={{ verticalAlign: 'middle' }} /> Vidljiv pri prijavi
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          className="action-btn abEdit"
                          onClick={() => handleEditProgram(program)}
                          title="Uredi program"
                        >
                          <Icon icon="solar:pen-broken" />
                        </button>
                        <button
                          className="action-btn abDelete"
                          onClick={() => setDeleteProgram(program)}
                          title="Obriši program"
                        >
                          <Icon icon="solar:trash-bin-trash-broken" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ width: '100%' }}>
              {activeFilter === 'all' 
                ? 'Nema dostupnih programa.' 
                : 'Nema programa koji zadovoljavaju odabrani filter.'}
            </p>
          )}
        </div>
      </div>
      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
        />
      )}
    </>
  );
};

export default Programs;
