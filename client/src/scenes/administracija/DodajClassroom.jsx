import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import ApiConfig from '../../components/apiConfig';
import Notification from '../../components/Notifikacija';
import Modal from '../../components/Modal';

const DodajClassroom = ({ onDodajClassroom, onCancel, schools }) => {
  const [inputs, setInputs] = useState({
    name: '',
    schoolId: '', // Change to schoolId
  });
  const [notification, setNotification] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setInputs((prev) => ({
      ...prev,
      [name]: name === 'schoolId' ? parseInt(value, 10) : value, // Parse schoolId as an integer
    }));
  };

  const dodajClassroom = async () => {
    try {
      const res = await ApiConfig.api.post('/api/classrooms', inputs);
      return res.data;
    } catch (err) {
      console.error('Error adding classroom:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.error || 'Greška pri dodavanju učionice'
      });
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await dodajClassroom();
    if (result) {
      setNotification({
        type: 'success',
        message: 'Učionica uspješno dodana!',
      });
      if (typeof onDodajClassroom === 'function') {
        onDodajClassroom(); // Notify parent component if it's a function
      }
    } else {
      setNotification({
        type: 'error',
        message: 'Došlo je do greške! Pokušajte ponovno.',
      });
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={
        <>
          <Icon icon="solar:add-circle-broken" />
          Dodaj učionicu
        </>
      }
      maxWidth="600px"
      isFormModal={true}
    >
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Naziv učionice */}
          <div>
            <label htmlFor="classroom-name" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
              Naziv učionice <span style={{ color: 'red' }}>*</span>
            </label>
            <input
              className="input-login-signup"
              value={inputs.name}
              onChange={handleChange}
              type="text"
              name="name"
              id="classroom-name"
              placeholder="Npr. Učionica 1"
              required
              style={{ width: '100%' }}
            />
          </div>

          {/* Škola */}
          <div>
            <label htmlFor="classroom-school" style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
              Škola <span style={{ color: 'red' }}>*</span>
            </label>
            <select
              className="input-login-signup"
              value={inputs.schoolId}
              onChange={handleChange}
              name="schoolId"
              id="classroom-school"
              required
              style={{ width: '100%' }}
            >
              <option value="">Odaberi školu</option>
              {schools?.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="div-radio" style={{
            borderTop: '1px solid rgba(var(--isticanje2), 0.3)'
          }}>
            <button
              className="gumb action-btn zatvoriBtn"
              type="button"
              onClick={onCancel}
            >
              <Icon icon="solar:close-circle-broken" /> Odustani
            </button>
            <button
              className="gumb action-btn spremiBtn"
              type="submit"
            >
              <Icon icon="solar:add-circle-broken" /> Dodaj učionicu
            </button>
          </div>
        </div>
      </form>

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}
    </Modal>
  );
};

export default DodajClassroom;
