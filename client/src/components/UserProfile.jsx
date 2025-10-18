import React, { useState, useEffect, memo } from 'react';
import { Icon } from '@iconify/react';
import ApiConfig from './apiConfig';
import LoadingShell from './LoadingShell';
import Modal from './Modal';

const UserProfile = memo(({ userId, loggedInUser, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);
  const [profilePicture, setProfilePicture] = useState(null);

  // Check if logged-in user has permission to view sensitive data
  const canViewSensitiveData = loggedInUser && (loggedInUser.isAdmin || loggedInUser.isMentor || loggedInUser.id === userId);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        // Try to fetch user data first
        try {
          const response = await ApiConfig.api.get(`/api/korisnik/${userId}`);
          setUserData({ ...response.data.user, type: 'student' });
        } catch (userError) {
          // If user not found, try to fetch mentor data
          try {
            const mentorResponse = await ApiConfig.api.get(`/api/mentori/${userId}`);
            setUserData({ ...mentorResponse.data, type: 'mentor' });
          } catch (mentorError) {
            throw new Error('User not found');
          }
        }

        // Fetch profile picture
        try {
          const pictureResponse = await ApiConfig.cachedApi.get(`/api/profile-picture/${userId}`, { headers: { 'Cache-Control': 'no-cache' } });
          if (pictureResponse?.success && pictureResponse?.profilePicture) {
            setProfilePicture(pictureResponse.profilePicture);
          }
        } catch (pictureError) {
          console.error('Error fetching profile picture:', pictureError);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Greška pri dohvaćanju podataka o korisniku');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  if (loading) return (
    <Modal isOpen={true} onClose={onClose} title="Učitavanje..." maxWidth="700px">
      <LoadingShell />
    </Modal>
  );

  if (error) return (
    <Modal isOpen={true} onClose={onClose} title="Greška" maxWidth="500px">
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>{error}</div>
    </Modal>
  );

  if (!userData) return null;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <>
          <Icon icon={userData.type === 'mentor' ? "solar:user-speak-broken" : "solar:user-id-broken"} />
          {userData.ime} {userData.prezime}
        </>
      }
      maxWidth="700px"
      isFormModal={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Profile Picture & Basic Info */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.5rem',
          background: 'rgba(var(--isticanje), 0.05)',
          borderRadius: 'var(--radius)',
          border: '1px solid rgba(var(--isticanje), 0.2)'
        }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '4px solid rgb(var(--isticanje))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(var(--isticanje2), 0.1)'
          }}>
            {profilePicture ? (
              <img
                src={`data:${profilePicture.contentType};base64,${profilePicture.data}`}
                alt="Profile"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <Icon icon="solar:user-broken" style={{ fontSize: '4rem', color: 'rgb(var(--isticanje))' }} />
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: userData.type === 'mentor' ? 'rgba(var(--isticanje), 0.15)' : 'rgba(var(--isticanje2), 0.15)',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}>
              <Icon icon={userData.type === 'mentor' ? "solar:user-speak-broken" : "solar:book-bookmark-broken"} />
              {userData.type === 'mentor' ? 'Mentor' : 'Učenik'}
            </div>
          </div>
        </div>

        {/* Notes (if visible) */}
        {canViewSensitiveData && userData.napomene && Array.isArray(userData.napomene) && userData.napomene.length > 0 && (
          <div style={{
            background: 'rgba(var(--isticanje2), 0.1)',
            padding: '1rem',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(var(--isticanje2), 0.3)'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon icon="solar:notes-broken" style={{ fontSize: '1.2rem' }} />
              Napomene
            </div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {Array.isArray(userData.napomene) ? userData.napomene.join('\n') : userData.napomene}
            </p>
          </div>
        )}

        {/* Basic Information */}
        <div>
          <h3 style={{
            fontSize: '1rem',
            marginBottom: '1rem',
            color: 'rgb(var(--isticanje))',
            borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
            paddingBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Icon icon="solar:info-circle-broken" />
            Osnovne informacije
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{
              background: 'rgba(var(--isticanje2), 0.05)',
              padding: '0.75rem',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(var(--isticanje2), 0.2)',
              flex: '1 1 200px'
            }}>
              <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Email</div>
              <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{userData.email}</div>
            </div>

            {userData.type === 'student' && canViewSensitiveData && userData.datumRodjenja && (
              <div style={{
                background: 'rgba(var(--isticanje2), 0.05)',
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(var(--isticanje2), 0.2)',
                flex: '1 1 200px'
              }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Datum rođenja</div>
                <div style={{ fontWeight: 600 }}>
                  {new Date(userData.datumRodjenja).toLocaleDateString('hr-HR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
            )}

            {userData.type === 'student' && userData.school && (
              <div style={{
                background: 'rgba(var(--isticanje2), 0.05)',
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(var(--isticanje2), 0.2)',
                flex: '1 1 200px'
              }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Škola</div>
                <div style={{ fontWeight: 600 }}>{userData.school.name || 'Nije uneseno'}</div>
              </div>
            )}

            {userData.type === 'student' && userData.programs && userData.programs.length > 0 && (
              <div style={{
                background: 'rgba(var(--isticanje2), 0.05)',
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(var(--isticanje2), 0.2)',
                flex: '1 1 100%'
              }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>
                  Programi ({userData.programs.length})
                </div>
                <div style={{ fontWeight: 600 }}>
                  {userData.programs.map(program => program.naziv).join(', ')}
                </div>
              </div>
            )}

            {userData.type === 'mentor' && userData.predmet && (
              <div style={{
                background: 'rgba(var(--isticanje2), 0.05)',
                padding: '0.75rem',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(var(--isticanje2), 0.2)',
                flex: '1 1 200px'
              }}>
                <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Predmet</div>
                <div style={{ fontWeight: 600 }}>{userData.predmet}</div>
              </div>
            )}
          </div>
        </div>

        {/* Contact Information */}
        {canViewSensitiveData && userData.type === 'student' && (
          <div>
            <h3 style={{
              fontSize: '1rem',
              marginBottom: '1rem',
              color: 'rgb(var(--isticanje))',
              borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
              paddingBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Icon icon="solar:phone-broken" />
              Kontakt informacije
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {userData.brojMobitela && (
                <div style={{
                  background: 'rgba(var(--isticanje2), 0.05)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgba(var(--isticanje2), 0.2)',
                  flex: '1 1 200px'
                }}>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Telefon</div>
                  <div style={{ fontWeight: 600 }}>{userData.brojMobitela}</div>
                </div>
              )}

              {userData.adresa && (
                <div style={{
                  background: 'rgba(var(--isticanje2), 0.05)',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid rgba(var(--isticanje2), 0.2)',
                  flex: '1 1 100%'
                }}>
                  <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Adresa</div>
                  <div style={{ fontWeight: 600 }}>
                    {typeof userData.adresa === 'object'
                      ? `${userData.adresa.ulica} ${userData.adresa.kucniBroj}, ${userData.adresa.mjesto}`
                      : userData.adresa}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Parent Information */}
        {canViewSensitiveData && userData.type === 'student' && (
          <>
            {userData.roditelj1 && userData.roditelj1.ime && userData.roditelj1.prezime && (
              <div>
                <h3 style={{
                  fontSize: '1rem',
                  marginBottom: '1rem',
                  color: 'rgb(var(--isticanje))',
                  borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
                  paddingBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Icon icon="solar:users-group-rounded-broken" />
                  Roditelj/Skrbnik 1
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{
                    background: 'rgba(var(--isticanje2), 0.05)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid rgba(var(--isticanje2), 0.2)',
                    flex: '1 1 200px'
                  }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Ime i prezime</div>
                    <div style={{ fontWeight: 600 }}>{`${userData.roditelj1.ime} ${userData.roditelj1.prezime}`}</div>
                  </div>
                  {userData.roditelj1.brojMobitela && (
                    <div style={{
                      background: 'rgba(var(--isticanje2), 0.05)',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid rgba(var(--isticanje2), 0.2)',
                      flex: '1 1 200px'
                    }}>
                      <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Telefon</div>
                      <div style={{ fontWeight: 600 }}>{userData.roditelj1.brojMobitela}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {userData.roditelj2 && userData.roditelj2.ime && userData.roditelj2.prezime && (
              <div>
                <h3 style={{
                  fontSize: '1rem',
                  marginBottom: '1rem',
                  color: 'rgb(var(--isticanje))',
                  borderBottom: '2px solid rgba(var(--isticanje), 0.2)',
                  paddingBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <Icon icon="solar:users-group-rounded-broken" />
                  Roditelj/Skrbnik 2
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{
                    background: 'rgba(var(--isticanje2), 0.05)',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid rgba(var(--isticanje2), 0.2)',
                    flex: '1 1 200px'
                  }}>
                    <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Ime i prezime</div>
                    <div style={{ fontWeight: 600 }}>{`${userData.roditelj2.ime} ${userData.roditelj2.prezime}`}</div>
                  </div>
                  {userData.roditelj2.brojMobitela && (
                    <div style={{
                      background: 'rgba(var(--isticanje2), 0.05)',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid rgba(var(--isticanje2), 0.2)',
                      flex: '1 1 200px'
                    }}>
                      <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.25rem' }}>Telefon</div>
                      <div style={{ fontWeight: 600 }}>{userData.roditelj2.brojMobitela}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
});

export default UserProfile;
