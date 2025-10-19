import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import ApiConfig from '../components/apiConfig';
import { useDispatch } from 'react-redux';
import { authActions } from '../store';
import '../components/auth-pages.css';

const SchoolRegister = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    // School Info
    schoolName: '',
    street: '',
    location: '',
    webOpis: '',
    
    // Admin Info
    ime: '',
    prezime: '',
    email: '',
    password: '',
    confirmPassword: '',
    brojMobitela: '',
    oib: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Lozinke se ne podudaraju');
      return;
    }

    if (formData.password.length < 6) {
      setError('Lozinka mora imati najmanje 6 znakova');
      return;
    }

    setLoading(true);

    try {
      const response = await ApiConfig.api.post('/api/schools/register', {
        schoolName: formData.schoolName,
        street: formData.street,
        location: formData.location,
        webOpis: formData.webOpis,
        ime: formData.ime,
        prezime: formData.prezime,
        email: formData.email,
        password: formData.password,
        brojMobitela: formData.brojMobitela,
        oib: formData.oib
      });

      // Auto-login with returned token
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        ApiConfig.setAuthToken(response.data.token);
        
        // Update Redux state
        dispatch(authActions.updateUser(response.data.mentor));
        
        // Show success message and navigate
        alert(`Čestitamo! Škola "${response.data.school.name}" i vaš admin račun su uspješno kreirani!`);
        navigate('/user');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.message || 'Greška pri registraciji. Pokušajte ponovno.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container auth-signup-container">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo-section">
            <img src="/logo512.png" alt="Cadenza Logo" className="auth-main-logo" />
          </div>
          <div className="auth-branding">
            <h1 className="auth-brand-title">Cadenza</h1>
            <p className="auth-subtitle">Registriraj svoju školu</p>
          </div>
        </div>

        {/* Main Form */}
        <div className="auth-main">
          <div className="auth-signup-content">
            <div className="auth-signup-header">
              <h3 className="auth-signup-title">Registracija škole</h3>
              <p className="auth-signup-subtitle">Kreirajte svoju školu i administratorski račun</p>
            </div>

          <form onSubmit={handleSubmit} className="auth-signup-form">
            {error && (
              <div className="auth-error-message">
                <Icon icon="solar:close-circle-broken" />
                <span>{error}</span>
              </div>
            )}

            {/* School Information Section */}
            <div className="auth-signup-section">
              <div className="auth-section-header">
                <Icon icon="solar:buildings-2-broken" />
                <h4>Informacije o školi</h4>
              </div>
              
              <div className="auth-signup-row">
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Naziv škole <span className="auth-required">*</span></label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:buildings-2-broken" className="auth-input-icon" />
                    <input
                      type="text"
                      name="schoolName"
                      value={formData.schoolName}
                      onChange={handleChange}
                      placeholder="npr. Glazbena škola Osijek"
                      required
                      className="auth-signup-input"
                    />
                  </div>
                </div>
              </div>

              <div className="auth-signup-row">
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Ulica</label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:map-point-broken" className="auth-input-icon" />
                    <input
                      type="text"
                      name="street"
                      value={formData.street}
                      onChange={handleChange}
                      placeholder="npr. Trg bana Jelačića 5"
                      className="auth-signup-input"
                    />
                  </div>
                </div>
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Grad</label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:map-point-broken" className="auth-input-icon" />
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleChange}
                      placeholder="npr. Osijek"
                      className="auth-signup-input"
                    />
                  </div>
                </div>
              </div>

              <div className="auth-signup-row">
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Opis škole</label>
                  <div className="auth-input-wrapper">
                    <textarea
                      name="webOpis"
                      value={formData.webOpis}
                      onChange={handleChange}
                      placeholder="Kratki opis vaše glazbene škole..."
                      rows="3"
                      className="auth-signup-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Information Section */}
            <div className="auth-signup-section">
              <div className="auth-section-header">
                <Icon icon="solar:user-broken" />
                <h4>Vaši podaci (administrator škole)</h4>
              </div>

              <div className="auth-signup-row">
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Ime <span className="auth-required">*</span></label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:user-broken" className="auth-input-icon" />
                    <input
                      type="text"
                      name="ime"
                      value={formData.ime}
                      onChange={handleChange}
                      required
                      className="auth-signup-input"
                      placeholder="Vaše ime"
                    />
                  </div>
                </div>
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Prezime <span className="auth-required">*</span></label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:user-broken" className="auth-input-icon" />
                    <input
                      type="text"
                      name="prezime"
                      value={formData.prezime}
                      onChange={handleChange}
                      required
                      className="auth-signup-input"
                      placeholder="Vaše prezime"
                    />
                  </div>
                </div>
              </div>

              <div className="auth-signup-row">
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Email <span className="auth-required">*</span></label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:letter-broken" className="auth-input-icon" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="vas@email.com"
                      required
                      className="auth-signup-input"
                    />
                  </div>
                  <small className="auth-field-note">Email će biti vaše korisničko ime</small>
                </div>
              </div>

              <div className="auth-signup-row">
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Lozinka <span className="auth-required">*</span></label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:lock-password-broken" className="auth-input-icon" />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Minimalno 6 znakova"
                      required
                      className="auth-signup-input"
                    />
                  </div>
                </div>
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Potvrdi lozinku <span className="auth-required">*</span></label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:lock-password-broken" className="auth-input-icon" />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Ponovi lozinku"
                      required
                      className="auth-signup-input"
                    />
                  </div>
                </div>
              </div>

              <div className="auth-signup-row">
                <div className="auth-signup-group">
                  <label className="auth-signup-label">Broj mobitela</label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:phone-broken" className="auth-input-icon" />
                    <input
                      type="tel"
                      name="brojMobitela"
                      value={formData.brojMobitela}
                      onChange={handleChange}
                      placeholder="099 123 4567"
                      className="auth-signup-input"
                    />
                  </div>
                </div>
                <div className="auth-signup-group">
                  <label className="auth-signup-label">OIB</label>
                  <div className="auth-input-wrapper">
                    <Icon icon="solar:id-card-broken" className="auth-input-icon" />
                    <input
                      type="text"
                      name="oib"
                      value={formData.oib}
                      onChange={handleChange}
                      placeholder="12345678901"
                      maxLength="11"
                      className="auth-signup-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="auth-signup-actions">
              <button
                type="submit"
                disabled={loading}
                className={`auth-submit-button ${loading ? 'auth-submit-button-loading' : ''}`}
              >
                {loading ? (
                  <>
                    <div className="auth-loading-spinner"></div>
                    Kreiranje škole...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-broken" />
                    Registriraj školu
                  </>
                )}
              </button>

              {loading && (
                <p className="auth-loading-info">
                  Molimo pričekajte, kreiramo vašu školu...
                </p>
              )}
            </div>

            {/* Info Box */}
            <div className="auth-info-box">
              <Icon icon="solar:info-circle-broken" />
              <div>
                <strong>Što dobivate?</strong>
                <ul>
                  <li>Potpuno besplatna platforma za upravljanje školom</li>
                  <li>Administratorski pristup s punim ovlastima</li>
                  <li>Mogućnost dodavanja mentora i učenika</li>
                  <li>Raspored nastave, računi, dokumenti i više</li>
                </ul>
              </div>
            </div>

            {/* Back Link */}
            <div className="auth-links">
              <Link to="/" className="auth-link auth-link-primary">
                <Icon icon="solar:alt-arrow-left-broken" />
                Povratak na početnu
              </Link>
            </div>
          </form>
          </div>
        </div>

        {/* Footer */}
        <div className="auth-footer">
          <div className="auth-footer-links">
            <Link to="/about" className="auth-footer-link">O aplikaciji</Link>
            <span className="auth-footer-separator">|</span>
            <Link to="/login" className="auth-footer-link">Prijavi se</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SchoolRegister;

