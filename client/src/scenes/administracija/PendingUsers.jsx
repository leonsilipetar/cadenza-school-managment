import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import NavigacijaAdmin from './NavigacijaAdmin';
import NavTopAdministracija from './NavTopAdmin';
import ApiConfig from '../../components/apiConfig';
import LoadingShell from '../../components/LoadingShell';
import Notifikacija from '../../components/Notifikacija';

const PendingUsers = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [notification, setNotification] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const otvoreno = 'pending-users';

  const fetchPendingUsers = async () => {
    try {
      const response = await ApiConfig.api.get('/api/admin/pending-users');
      console.log('Pending users response:', response);
      
      // Ensure we're working with an array
      const users = Array.isArray(response.data) ? response.data : 
                   response.data?.pendingUsers ? response.data.pendingUsers : [];
      
      console.log('Processed users array:', users);
      setPendingUsers(users);
      setError(null);
    } catch (err) {
      console.error('Error fetching pending users:', err);
      setNotification({
        type: 'error',
        message: 'Greška pri dohvaćanju zahtjeva za registraciju.'
      });
      setPendingUsers([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const buildSignupPayload = (pu) => {
    // Normalize address JSON
    const adresa = pu.adresa && typeof pu.adresa === 'object' ? pu.adresa : {
      ulica: pu.adresa?.ulica || '',
      kucniBroj: pu.adresa?.kucniBroj || '',
      mjesto: pu.adresa?.mjesto || ''
    };

    // Determine programId (prefer explicit field, fallback to embedded program)
    const programId = pu.programId || pu.program?.id || null;

    // Normalize roditelj objects
    const roditelj1 = pu.roditelj1 && typeof pu.roditelj1 === 'object' ? pu.roditelj1 : { ime: '', prezime: '', brojMobitela: '' };
    const roditelj2 = pu.roditelj2 && typeof pu.roditelj2 === 'object' ? pu.roditelj2 : { ime: '', prezime: '', brojMobitela: '' };

    return {
      email: pu.email,
      ime: pu.ime,
      prezime: pu.prezime,
      brojMobitela: pu.brojMobitela || '',
      adresa,
      oib: pu.oib || null,
      datumRodjenja: pu.datumRodjenja || null,
      pohadjaTeoriju: !!pu.pohadjaTeoriju,
      maiZbor: !!pu.maiZbor,
      maloljetniClan: !!pu.maloljetniClan,
      roditelj1,
      roditelj2,
      schoolId: pu.schoolId || 1,
      programId,
      napomene: pu.napomene || ''
    };
  };

  const handleApprove = async (userId) => {
    try {
      const userToApprove = pendingUsers.find(user => user.id === userId);
      if (!userToApprove) {
        throw new Error('User not found');
      }

      // First create the user using the signup endpoint with a minimal, validated payload
      const signupData = buildSignupPayload(userToApprove);

      try {
        await ApiConfig.api.post('/api/signup', signupData);
      } catch (err) {
        const status = err.response?.status;
        const serverMsg = err.response?.data?.message;
        const errorText = err.response?.data?.errorText;

        // Specific handling for common validation/unique issues
        if (status === 400) {
          if (serverMsg?.toLowerCase().includes('email') || errorText?.toLowerCase?.().includes('email')) {
            setNotification({
              type: 'error',
              message: 'Korisnik s ovom email adresom već postoji. Molimo provjerite email.'
            });
            return;
          }
          if (serverMsg?.toLowerCase().includes('oib') || errorText?.toLowerCase?.().includes('oib')) {
            setNotification({
              type: 'error',
              message: 'Korisnik s ovim OIB-om već postoji. Molimo provjerite OIB.'
            });
            return;
          }
        }

        // Fallback generic error
        setNotification({
          type: 'error',
          message: serverMsg || 'Greška prilikom registracije.'
        });
        return;
      }

      // If signup successful, mark the pending user as approved on the server
      await ApiConfig.api.post(`/api/admin/pending-users/${userId}/approve`);

      setNotification({
        type: 'success',
        message: 'Zahtjev za registraciju je odobren.'
      });
      
      fetchPendingUsers(); // Refresh the list
    } catch (err) {
      console.error('Error approving user:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Greška pri odobravanju zahtjeva.'
      });
    }
  };

  const handleDecline = async (userId) => {
    try {
      await ApiConfig.api.post(`/api/admin/pending-users/${userId}/decline`);
      setNotification({
        type: 'success',
        message: 'Zahtjev za registraciju je odbijen.'
      });
      fetchPendingUsers(); // Refresh the list
    } catch (err) {
      console.error('Error declining user:', err);
      setNotification({
        type: 'error',
        message: 'Greška pri odbijanju zahtjeva.'
      });
    }
  };

  // Bulk and checkbox selection removed per request

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('hr-HR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <NavigacijaAdmin otvoreno={otvoreno} />
      <NavTopAdministracija naslov={'Administracija - Zahtjevi za registraciju'} />
      <div className="main">
        {loading ? (
          <LoadingShell />
        ) : (
          <>
            <div className="karticaZadatka">
              <div className="div-row">
                <span style={{color: 'rgb(var(--isticanje))'}}>
                  Ukupno zahtjeva: {pendingUsers.length}
                </span>
                <div className="p">
                  Ovdje možete pregledati i upravljati zahtjevima za registraciju novih korisnika.
                  Zahtjevi stariji od 14 dana se automatski brišu.
                </div>
              </div>
            </div>

            <div className="karticaZadatka" style={{ alignItems: 'stretch' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600, width: '100%' }}>Popis zahtjeva</h3>

              {pendingUsers.length > 0 ? (
                <div className="tablica" style={{ width: '100%' }}>
                  <div className="tr naziv">
                    <div className="th">Ime i prezime</div>
                    <div className="th">Email</div>
                    <div className="th">OIB</div>
                    <div className="th">Program</div>
                    <div className="th">Datum zahtjeva</div>
                    <div className="th">Akcije</div>
                  </div>

                  {pendingUsers.map((user) => (
                    <div key={user.id} className="tr redak">
                      <div className="th">{`${user.ime} ${user.prezime}`}</div>
                      <div className="th">{user.email}</div>
                      <div className="th">{user.oib}</div>
                      <div className="th">{user.program?.naziv || 'N/A'}</div>
                      <div className="th">{formatDate(user.createdAt)}</div>
                      <div className="th">
                        <div className="action-buttons">
                          <button
                            className="action-btn abExpand"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Icon icon="solar:eye-broken" />
                            Detalji
                          </button>
                          <button
                            className="action-btn spremiBtn"
                            onClick={() => handleApprove(user.id)}
                          >
                            <Icon icon="solar:check-circle-broken" />
                            Odobri
                          </button>
                          <button
                            className="action-btn zatvoriBtn"
                            onClick={() => handleDecline(user.id)}
                          >
                            <Icon icon="solar:close-circle-broken" />
                            Odbij
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ width: '100%' }}>Nema zahtjeva za registraciju.</p>
              )}
            </div>

            {selectedUser && (
              <div className="popup">
                <div className="div">
                  <h3>Detalji zahtjeva</h3>
                  <div className="tablica">
                    <div className="tr naziv">
                      <div className="th">Polje</div>
                      <div className="th">Vrijednost</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">Ime i prezime</div>
                      <div className="th">{`${selectedUser.ime} ${selectedUser.prezime}`}</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">Email</div>
                      <div className="th">{selectedUser.email}</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">OIB</div>
                      <div className="th">{selectedUser.oib}</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">Datum rođenja</div>
                      <div className="th">{formatDate(selectedUser.datumRodjenja)}</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">Adresa</div>
                      <div className="th">
                        {selectedUser.adresa.ulica} {selectedUser.adresa.kucniBroj}, {selectedUser.adresa.mjesto}
                      </div>
                    </div>
                    {selectedUser.maloljetniClan && (
                      <>
                        <div className="tr redak">
                          <div className="th">Roditelj 1</div>
                          <div className="th">
                            {`${selectedUser.roditelj1.ime} ${selectedUser.roditelj1.prezime}`}
                            <br />
                            {`Tel: ${selectedUser.roditelj1.brojMobitela}`}
                          </div>
                        </div>
                        {selectedUser.roditelj2?.ime && (
                          <div className="tr redak">
                            <div className="th">Roditelj 2</div>
                            <div className="th">
                              {`${selectedUser.roditelj2.ime} ${selectedUser.roditelj2.prezime}`}
                              <br />
                              {`Tel: ${selectedUser.roditelj2.brojMobitela}`}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    <div className="tr redak">
                      <div className="th">Program</div>
                      <div className="th">{selectedUser.program?.naziv || 'N/A'}</div>
                    </div>
                    <div className="tr redak">
                      <div className="th">Pohađa teoriju</div>
                      <div className="th">{selectedUser.pohadjaTeoriju ? 'Da' : 'Ne'}</div>
                    </div>
                    {selectedUser.napomene && (
                      <div className="tr redak">
                        <div className="th">Napomene</div>
                        <div className="th">{selectedUser.napomene}</div>
                      </div>
                    )}
                  </div>
                  <div className="div-radio">
                    <button
                      className="gumb action-btn zatvoriBtn"
                      onClick={() => setSelectedUser(null)}
                    >
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
        <Notifikacija
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default PendingUsers; 