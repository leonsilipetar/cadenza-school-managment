import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import ApiConfig from '../../components/apiConfig';
import Modal from '../../components/Modal';
import { toast } from 'react-toastify';
import moment from 'moment';
import 'moment/locale/hr';

const PostavkeRasporeda = ({ onClose, user }) => {
  const [currentWeek, setCurrentWeek] = useState(null);
  const [weekDates, setWeekDates] = useState([]);

  useEffect(() => {
    // Get current week's dates
    const today = moment();
    const monday = today.clone().startOf('isoWeek');
    const dates = [];

    for (let i = 0; i < 7; i++) {
      dates.push(monday.clone().add(i, 'days'));
    }
    setWeekDates(dates);

    // Fetch current week type
    fetchCurrentWeekType();
  }, []);

  const fetchCurrentWeekType = async () => {
    try {
      const response = await ApiConfig.api.get('/api/schedule/week-type');
      setCurrentWeek(response.data.weekType);
    } catch (error) {
      console.error('Error fetching week type:', error);
      toast.error('Greška pri dohvaćanju tipa tjedna');
    }
  };

  const handleSetWeekType = async (type) => {
    try {
      await ApiConfig.api.post('/api/schedule/set-week-type', {
        weekType: type,
        date: moment().format('YYYY-MM-DD')
      });
      setCurrentWeek(type);
      toast.success(`Uspješno postavljen ${type} tjedan`);
    } catch (error) {
      console.error('Error setting week type:', error);
      toast.error('Greška pri postavljanju tipa tjedna');
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <>
          <Icon icon="solar:settings-broken" />
          Postavke rasporeda
        </>
      }
      maxWidth="700px"
      isFormModal={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Info Section */}
        <div style={{
          padding: '1rem',
          background: 'rgba(var(--isticanje), 0.1)',
          border: '1px solid rgba(var(--isticanje), 0.3)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem'
        }}>
          <Icon icon="solar:info-circle-broken" fontSize="1.5rem" style={{ color: 'rgb(var(--isticanje))', flexShrink: 0 }} />
          <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
            Odaberite tip trenutnog tjedna (A ili B). Ova postavka određuje koji termini će biti prikazani u rasporedu.
            Sljedeći tjedan će automatski biti obrnut tip.
          </div>
        </div>

        {/* Current Week Display */}
        <div>
          <label style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'block', fontSize: '1rem' }}>
            <Icon icon="solar:calendar-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Trenutni tjedan
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
            gap: '0.5rem',
            marginBottom: '1rem',
            padding: '1rem',
            background: 'var(--iznad)',
            borderRadius: 'var(--radius)'
          }}>
            {weekDates.map((date, index) => {
              const isToday = date.isSame(moment(), 'day');
              return (
                <div
                  key={index}
                  style={{
                    padding: '0.5rem',
                    textAlign: 'center',
                    background: isToday ? 'rgba(var(--isticanje), 0.2)' : 'var(--pozadina)',
                    borderRadius: 'var(--radius)',
                    border: isToday ? '2px solid rgb(var(--isticanje))' : '1px solid rgba(var(--isticanje2), 0.2)',
                    fontSize: '0.85rem',
                    fontWeight: isToday ? 600 : 400
                  }}
                >
                  <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                    {date.format('ddd')}
                  </div>
                  <div>{date.format('D.M.')}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Week Type Selection */}
        <div>
          <label style={{ fontWeight: 600, marginBottom: '0.75rem', display: 'block', fontSize: '1rem' }}>
            <Icon icon="solar:calendar-mark-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Odabir tipa tjedna
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem'
          }}>
            <button
              onClick={() => handleSetWeekType('A')}
              style={{
                padding: '1.5rem 1rem',
                border: `2px solid ${currentWeek === 'A' ? 'rgb(var(--isticanje))' : 'rgba(var(--isticanje2), 0.3)'}`,
                borderRadius: 'var(--radius)',
                background: currentWeek === 'A' ? 'rgba(var(--isticanje), 0.1)' : 'var(--iznad)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: currentWeek === 'A' ? 700 : 400,
                fontSize: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Icon
                icon={currentWeek === 'A' ? "solar:check-circle-bold" : "solar:circle-broken"}
                fontSize="2rem"
                style={{ color: currentWeek === 'A' ? 'rgb(var(--isticanje))' : 'rgba(var(--tekst), 0.5)' }}
              />
              <span>A tjedan</span>
            </button>

            <button
              onClick={() => handleSetWeekType('B')}
              style={{
                padding: '1.5rem 1rem',
                border: `2px solid ${currentWeek === 'B' ? 'rgb(var(--isticanje))' : 'rgba(var(--isticanje2), 0.3)'}`,
                borderRadius: 'var(--radius)',
                background: currentWeek === 'B' ? 'rgba(var(--isticanje), 0.1)' : 'var(--iznad)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontWeight: currentWeek === 'B' ? 700 : 400,
                fontSize: '1.1rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Icon
                icon={currentWeek === 'B' ? "solar:check-circle-bold" : "solar:circle-broken"}
                fontSize="2rem"
                style={{ color: currentWeek === 'B' ? 'rgb(var(--isticanje))' : 'rgba(var(--tekst), 0.5)' }}
              />
              <span>B tjedan</span>
            </button>
          </div>
        </div>

        {/* Status Message */}
        {currentWeek && (
          <div style={{
            padding: '1rem',
            background: 'rgba(var(--isticanje), 0.05)',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(var(--isticanje2), 0.2)',
            fontSize: '0.9rem',
            textAlign: 'center'
          }}>
            <Icon icon="solar:calendar-date-broken" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Trenutni tjedan je <strong>{currentWeek} tjedan</strong>.
            <br />
            Sljedeći tjedan će biti <strong>{currentWeek === 'A' ? 'B' : 'A'} tjedan</strong>.
          </div>
        )}
      </div>
    </Modal>
  );
};

export default PostavkeRasporeda;