import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import NavigacijaAdmin from './NavigacijaAdmin';
import NavTopAdministracija from './NavTopAdmin.jsx';
import DodajClassroom from './DodajClassroom';
import ApiConfig from '../../components/apiConfig';
import LoadingShell from '../../components/LoadingShell';
import Notifikacija from '../../components/Notifikacija';

const Classrooms = () => {
  const [odabranoDodajClassroom, setOdabranoDodajClassroom] = useState(false);
  const [classroomDetaljiOtvoreno, setClassroomDetaljiOtvoreno] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [schools, setSchools] = useState([]);
  const [isHovered, setIsHovered] = useState(false);
  const [notification, setNotification] = useState(null);
  const [classroomToDelete, setClassroomToDelete] = useState(null);
  const otvoreno = 'classrooms';
  const [isLoading, setIsLoading] = useState(true);

  const sendRequestClassrooms = async () => {
    try {
      const res = await ApiConfig.api.get('/api/classrooms');
      return res.data || [];
    } catch (err) {
      if (err.message !== 'canceled') {
        console.error('Error fetching classrooms:', err);
        setNotification({
          type: 'error',
          message: 'Greška pri dohvaćanju učionica'
        });
      }
      return [];
    }
  };

  const sendRequestSchools = async () => {
    try {
      const res = await ApiConfig.api.get('/api/schools');
      return res.data || [];
    } catch (err) {
      if (err.message !== 'canceled') {
        console.error('Error fetching schools:', err);
        setNotification({
          type: 'error',
          message: 'Greška pri dohvaćanju škola'
        });
      }
      return [];
    }
  };

  const handleDodajClassroom = () => {
    setOdabranoDodajClassroom(true);
  };

  const handleCancelDodajClassroom = () => {
    setOdabranoDodajClassroom(false);
  };

  const handleDeleteClassroom = async (id) => {
    try {
      await ApiConfig.api.delete(`/api/classrooms/${id}`);
      const updatedClassrooms = await sendRequestClassrooms();
      setClassrooms(updatedClassrooms);
      setNotification({
        type: 'success',
        message: 'Učionica uspješno obrisana'
      });
    } catch (err) {
      console.error('Error deleting classroom:', err);
      setNotification({
        type: 'error',
        message: 'Greška pri brisanju učionice'
      });
    }
  };

  const handleDeleteClick = (classroom) => {
    setClassroomToDelete(classroom);
  };

  const handleConfirmDelete = async () => {
    if (!classroomToDelete) return;
    
    try {
      await handleDeleteClassroom(classroomToDelete.id);
      setClassroomToDelete(null);
    } catch (error) {
      console.error('Error in delete confirmation:', error);
    }
  };

  const handleCancelDelete = () => {
    setClassroomToDelete(null);
  };

  useEffect(() => {
    let mounted = true;
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const [classroomsData, schoolsData] = await Promise.all([
          sendRequestClassrooms(),
          sendRequestSchools()
        ]);

        if (mounted) {
          setClassrooms(classroomsData);
          setSchools(schoolsData);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
        if (mounted) {
          setNotification({
            type: 'error',
            message: 'Greška pri dohvaćanju podataka'
          });
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <>
      <NavigacijaAdmin otvoreno={otvoreno} />
      <NavTopAdministracija naslov={'Administracija - Učionice'} />
      {isLoading ? (
        <LoadingShell />
      ) : (
        <>
          {odabranoDodajClassroom && (
            <DodajClassroom
              onDodajClassroom={async () => {
                const newClassrooms = await sendRequestClassrooms();
                setClassrooms(newClassrooms);
                setOdabranoDodajClassroom(false);
              }}
              onCancel={handleCancelDodajClassroom}
              schools={schools}
            />
          )}
          {classroomToDelete && (
            <div className="popup">
              <div className="div">
                <h3>Potvrda brisanja</h3>
                <p>Jeste li sigurni da želite obrisati učionicu {classroomToDelete.name}?</p>
                <div className="div-radio">

                <button className="gumb action-btn zatvoriBtn" onClick={handleCancelDelete}>
                    Odustani
                  </button>
                  
                  <button className="gumb action-btn abDelete" onClick={handleConfirmDelete}>
                    Obriši
                  </button>
                  
                </div>
              </div>
            </div>
          )}
          <div className="main">
            <div className="karticaZadatka" style={{ overflow: 'visible' }}>
              <div className="div-row">
                <span style={{color: 'rgb(var(--isticanje))'}}>Ukupno učionica: {classrooms?.length || 0}</span>
                <div className="p">
                  Učionice predstavljaju fizičke prostore u kojima se održava nastava. Svaka učionica mora biti dodijeljena školi.
                </div>
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
                  onClick={handleDodajClassroom}
                >
                  <Icon icon="solar:add-circle-broken" /> Dodaj učionicu
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
                  onClick={handleDodajClassroom}
                  style={{ flex: 1 }}
                >
                  <Icon icon="solar:add-circle-broken" fontSize="large" /> Dodaj učionicu
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
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, width: '100%' }}>Popis učionica</h3>
              
              {classrooms.length > 0 ? (
                <div className="tablica" style={{ width: '100%' }}>
                  <div className="tr naziv">
                    <div className="th">Naziv učionice</div>
                    <div className="th">Škola</div>
                    <div className="th">Akcije</div>
                  </div>
                  {classrooms.map((classroom) => {
                    const school = schools.find((s) => s.id === classroom.schoolId);
                    return (
                      <div
                        className={`tr redak ${isHovered ? 'hovered' : ''}`}
                        onMouseEnter={() => setIsHovered(true)}
                        onMouseLeave={() => setIsHovered(false)}
                        key={classroom.id}
                      >
                        <div className="th">{classroom.name}</div>
                        <div className="th">{school?.name || 'N/A'}</div>
                        <div className="th">
                          <button
                            className="action-btn abDelete"
                            onClick={() => handleDeleteClick(classroom)}
                          >
                            <Icon icon="solar:trash-bin-trash-broken" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ width: '100%' }}>Nema učionica u bazi!</p>
              )}
            </div>
          </div>
          {notification && (
            <Notifikacija
              type={notification.type}
              message={notification.message}
              onClose={() => setNotification(null)}
            />
          )}
        </>
      )}
    </>
  );
};

export default Classrooms;
