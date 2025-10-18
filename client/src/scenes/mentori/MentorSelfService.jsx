import React, { useEffect, useState } from 'react';
import ApiConfig from '../../components/apiConfig';
import Navigacija from '../navigacija';
import NavTop from '../nav-top';
import LoadingShell from '../../components/LoadingShell';
import MentorDetalji from '../administracija/MentoriDetalji.jsx';
import { useNavigate } from 'react-router-dom';

const MentorSelfService = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const otvoreno = 'mentor';
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetchMe = async () => {
      try {
        const res = await ApiConfig.api.get('/api/user');
        if (mounted) setUser(res.data.user);
      } catch (e) {
        console.error('Error fetching current user:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchMe();
    return () => { mounted = false; };
  }, []);

  if (loading) return <LoadingShell />;
  if (!user?.isMentor) return null;

  return (
    <>
      <NavTop user={user} naslov={'Mentor - Moj profil i učenici'} />
      <Navigacija user={user} otvoreno={otvoreno} />
      {/* Reuse MentoriDetalji in self-service mode; Close navigates back to profile */}
      <MentorDetalji korisnikId={user.id} onCancel={() => navigate('/profil')} selfService />
    </>
  );
};

export default MentorSelfService;


