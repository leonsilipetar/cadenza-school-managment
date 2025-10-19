import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../context/AuthContext';
import './auth-pages.css';

const Welcome = () => {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/user', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) return null;

  const features = [
    {
      icon: 'solar:users-group-rounded-broken',
      title: 'Multi-škola sustav',
      description: 'Podržava neograničen broj škola na jednoj platformi'
    },
    {
      icon: 'solar:calendar-broken',
      title: 'Raspored nastave',
      description: 'Jednostavno planiranje nastave i automatski podsjetnici'
    },
    {
      icon: 'solar:chat-line-broken',
      title: 'Komunikacija',
      description: 'Chat, obavijesti, ankete i grupne poruke'
    },
    {
      icon: 'solar:bill-list-broken',
      title: 'Upravljanje računima',
      description: 'Automatsko generiranje računa i praćenje plaćanja'
    },
    {
      icon: 'solar:document-text-broken',
      title: 'Dokumenti',
      description: 'Dijeljenje nota, materijala i upisa'
    },
    {
      icon: 'solar:shield-check-broken',
      title: '100% Besplatno',
      description: 'Bez pretplate, bez skrivenih troškova'
    }
  ];

  return (
    <div className="auth-page">
      <div className="auth-container auth-welcome-container">
        {/* Header Section */}
        <div className="auth-header">
          <div className="auth-logo-section">
            <img
              src="/logo512.png"
              alt="Cadenza Logo"
              className="auth-main-logo"
            />
          </div>
          <div className="auth-branding">
            <h1 className="auth-brand-title">Cadenza</h1>
            <p className="auth-subtitle">Besplatna platforma za glazbeno obrazovanje</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="auth-main">
          <div className="auth-welcome-content">
            <div className="auth-welcome-text">
              <h3 className="auth-welcome-title">Dobrodošli u Cadenza</h3>
              <p className="auth-welcome-description">
                Besplatna, sveobuhvatna platforma za upravljanje glazbenom školom.
                Organizirajte nastavu, komunicirajte s učenicima i mentorima, upravljajte računima i dokumentima -
                sve na jednom mjestu. Bez skrivenih troškova, potpuno besplatno za vaš school.
              </p>
            </div>

            {/* Features Grid */}
            <div className="auth-features-grid">
              {features.map((feature, index) => (
                <div key={index} className="auth-feature-card">
                  <div className="auth-feature-icon">
                    <Icon icon={feature.icon} />
                  </div>
                  <h4 className="auth-feature-title">{feature.title}</h4>
                  <p className="auth-feature-description">{feature.description}</p>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="auth-welcome-actions">
              <Link to="/school-register" className="auth-welcome-btn auth-welcome-btn-primary">
                <Icon icon="solar:buildings-2-broken" />
                Registriraj svoju školu
              </Link>
              <Link to="/login" className="auth-welcome-btn auth-welcome-btn-secondary">
                <Icon icon="solar:login-2-broken" />
                Prijavi se
              </Link>
              <Link to="/signup" className="auth-welcome-btn auth-welcome-btn-outline">
                <Icon icon="solar:user-plus-broken" />
                Registracija učenika
              </Link>
            </div>

            {/* Additional Info */}
            <div className="auth-welcome-info">
              <div className="auth-welcome-badge">
                <Icon icon="solar:shield-check-broken" />
                <span>Sigurna i pouzdana platforma</span>
              </div>
              <p className="auth-welcome-note">
                Cadenza je generička platforma za upravljanje glazbenim školama.
                Bilo da vodite malu privatnu školu ili veliku instituciju, Cadenza vam omogućuje
                kompletno digitalno upravljanje - potpuno besplatno.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          <div className="auth-footer-links">
            <Link to="/about" className="auth-footer-link">
              O aplikaciji
            </Link>
            <span className="auth-footer-separator">|</span>
            <a
              href="https://cadenza.com.hr"
              target="_blank"
              rel="noopener noreferrer"
              className="auth-footer-link"
            >
              cadenza.com.hr
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;































































































































































































































































































































































































































































































































