import React, { useEffect, useState } from 'react';
import ApiConfig from '../../components/apiConfig';
import Navigacija from '../navigacija';
import NavTop from '../nav-top';
import LoadingShell from '../../components/LoadingShell';
import KorisnikDetalji from '../administracija/KorisnikDetalji.jsx';
import { useNavigate } from 'react-router-dom';

const StudentSelfService = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const otvoreno = 'ucenik';
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
  if (!user?.isStudent) return null;

  return (
    <>
      <NavTop user={user} naslov={'Učenik - Moj profil'} />
      <Navigacija user={user} otvoreno={otvoreno} />
      <KorisnikDetalji korisnikId={user.id} onCancel={() => navigate('/profil')} selfService />
    </>
  );
};

export default StudentSelfService;


