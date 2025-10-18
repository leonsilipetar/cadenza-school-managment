import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import ApiConfig from './apiConfig';
import LoadingShell from './LoadingShell';
import Modal from './Modal';
import './FullSchedulePopup.css';

const FullSchedulePopup = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [scheduleData, setScheduleData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [classrooms, setClassrooms] = useState([]);
  const [error, setError] = useState(null);
  const [expandedDays, setExpandedDays] = useState({});

  const days = ['Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];

  // Add toggle function for day sections
  const toggleDay = (day) => {
    setExpandedDays(prev => ({
      ...prev,
      [day]: !prev[day]
    }));
  };

  // Add function to sort schedule items by time
  const sortByTime = (a, b) => {
    const timeA = a.vrijeme_od.split(':').map(Number);
    const timeB = b.vrijeme_od.split(':').map(Number);
    return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
  };

  // Group schedule items by day and type
  const groupScheduleItems = (items) => {
    const grouped = {};
    days.forEach(day => {
      const dayItems = items.filter(item => item.dan === day);
      if (dayItems.length > 0) {
        grouped[day] = {
          teorija: dayItems.filter(item => item.type === 'teorija').sort(sortByTime),
          individualna: dayItems.filter(item => item.type === 'individualna').sort(sortByTime)
        };
      }
    });
    return grouped;
  };

  useEffect(() => {
    const fetchAllSchedules = async () => {
      try {
        setLoading(true);
        const [teorijaResponse, individualnaResponse] = await Promise.all([
          ApiConfig.api.get('/api/rasporedTeorija'),
          ApiConfig.api.get('/api/allStudentSchedules')
        ]);

        // Process teorija data - flatten the day-wise schedule
        const teorijaData = [];
        const teorijaDays = teorijaResponse?.data?.teorija?.[0] || {};
        
        // Map day abbreviations to full names
        const dayMapping = {
          pon: 'Ponedjeljak',
          uto: 'Utorak',
          sri: 'Srijeda',
          cet: 'Četvrtak',
          pet: 'Petak',
          sub: 'Subota'
        };

        // Process each day's schedule for teorija
        Object.entries(dayMapping).forEach(([shortDay, fullDay]) => {
          const daySchedule = teorijaDays[shortDay] || [];
          daySchedule.forEach(item => {
            teorijaData.push({
              id: item.id,
              dan: fullDay,
              vrijeme_od: item.vrijeme,
              vrijeme_do: calculateEndTime(item.vrijeme, item.duration),
              ucionica: item.dvorana,
              mentor: item.mentor,
              type: 'teorija',
              title: `Teorija - ${item.dvorana}`
            });
          });
        });

        // Process individual lessons data - flatten all days into single array
        const individualnaData = [];
        const schedules = individualnaResponse?.data || [];
        
        schedules.forEach(schedule => {
          Object.entries(dayMapping).forEach(([shortDay, fullDay]) => {
            const daySchedule = schedule[shortDay] || [];
            daySchedule.forEach(item => {
              individualnaData.push({
                id: item.id,
                dan: fullDay,
                vrijeme_od: item.vrijeme,
                vrijeme_do: calculateEndTime(item.vrijeme, item.duration),
                ucionica: item.dvorana,
                mentor: item.mentor,
                type: 'individualna',
                title: `Individualna nastava - ${schedule.ucenik_ime} ${schedule.ucenik_prezime}`,
                ucenik_ime: schedule.ucenik_ime,
                ucenik_prezime: schedule.ucenik_prezime
              });
            });
          });
        });

        // Combine all data
        const combined = [...teorijaData, ...individualnaData];

        // Extract unique classrooms from teorija data
        const uniqueClassrooms = [...new Set(teorijaData
          .map(item => item.ucionica))]
          .sort();

        setClassrooms(uniqueClassrooms);
        setScheduleData(combined);
        setFilteredData(combined);
      } catch (error) {
        console.error('Error fetching schedules:', error);
        setError('Greška pri dohvaćanju rasporeda');
      } finally {
        setLoading(false);
      }
    };

    // Helper function to calculate end time based on start time and duration
    const calculateEndTime = (startTime, durationMinutes) => {
      const [hours, minutes] = startTime.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes + (durationMinutes || 45);
      const endHours = Math.floor(totalMinutes / 60);
      const endMinutes = totalMinutes % 60;
      return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
    };

    fetchAllSchedules();
  }, []);

  useEffect(() => {
    let filtered = [...scheduleData];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) ||
        (item.ucenik_ime && item.ucenik_ime.toLowerCase().includes(query)) ||
        (item.ucenik_prezime && item.ucenik_prezime.toLowerCase().includes(query)) ||
        (item.mentor && item.mentor.toLowerCase().includes(query))
      );
    }

    if (selectedDay) {
      filtered = filtered.filter(item => item.dan === selectedDay);
    }

    if (selectedClassroom) {
      filtered = filtered.filter(item => item.ucionica === selectedClassroom);
    }

    // Add time interval filtering
    if (startTime || endTime) {
      filtered = filtered.filter(item => {
        const itemTime = item.vrijeme_od.split(':').map(Number);
        const itemMinutes = itemTime[0] * 60 + itemTime[1];

        if (startTime && endTime) {
          const start = startTime.split(':').map(Number);
          const end = endTime.split(':').map(Number);
          const startMinutes = start[0] * 60 + start[1];
          const endMinutes = end[0] * 60 + end[1];
          return itemMinutes >= startMinutes && itemMinutes <= endMinutes;
        } else if (startTime) {
          const start = startTime.split(':').map(Number);
          const startMinutes = start[0] * 60 + start[1];
          return itemMinutes >= startMinutes;
        } else if (endTime) {
          const end = endTime.split(':').map(Number);
          const endMinutes = end[0] * 60 + end[1];
          return itemMinutes <= endMinutes;
        }
        return true;
      });
    }

    setFilteredData(filtered);
  }, [searchQuery, selectedDay, selectedClassroom, startTime, endTime, scheduleData]);

  const groupedSchedule = groupScheduleItems(filteredData);
  const totalTerms = filteredData.length;
  const teorijaCount = filteredData.filter(item => item.type === 'teorija').length;
  const individualnaCount = filteredData.filter(item => item.type === 'individualna').length;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={
        <>
          <Icon icon="solar:calendar-search-broken" />
          Kompletan raspored
        </>
      }
      maxWidth="1200px"
      isFormModal={false}
    >
      {loading ? (
        <LoadingShell />
      ) : error ? (
        <div style={{
          padding: '2rem',
          textAlign: 'center',
          color: 'rgb(var(--red))',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <Icon icon="solar:danger-triangle-broken" fontSize="3rem" />
          <p>{error}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem',
            padding: '1rem',
            background: 'rgba(var(--isticanje), 0.05)',
            borderRadius: 'var(--radius)',
            border: '1px solid rgba(var(--isticanje2), 0.2)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'rgb(var(--isticanje))' }}>
                {totalTerms}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Ukupno termina</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'rgb(var(--isticanje))' }}>
                {teorijaCount}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Teorija</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'rgb(var(--isticanje))' }}>
                {individualnaCount}
              </div>
              <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>Individualna nastava</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1rem',
            background: 'var(--iznad)',
            borderRadius: 'var(--radius)'
          }}>
            <label style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon icon="solar:filter-broken" />
              Filteri
            </label>

            {/* Search Bar */}
            <div className="search-bar" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem',
              background: 'var(--pozadina)',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(var(--isticanje2), 0.3)'
            }}>
              <Icon icon="solar:magnifer-broken" />
              <input
                type="text"
                placeholder="Pretraži po imenu učenika, mentora ili napomeni..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  color: 'var(--tekst)'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    color: 'var(--tekst)',
                    opacity: 0.6
                  }}
                >
                  <Icon icon="solar:close-circle-broken" />
                </button>
              )}
            </div>

            {/* Filter Controls */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem'
            }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block', opacity: 0.8 }}>
                  Dan
                </label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="input-login-signup"
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Svi dani</option>
                  {days.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block', opacity: 0.8 }}>
                  Učionica
                </label>
                <select
                  value={selectedClassroom}
                  onChange={(e) => setSelectedClassroom(e.target.value)}
                  className="input-login-signup"
                  style={{ width: '100%', padding: '0.5rem' }}
                >
                  <option value="">Sve učionice</option>
                  {classrooms.map(classroom => (
                    <option key={classroom} value={classroom}>{classroom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', display: 'block', opacity: 0.8 }}>
                  Vremenski interval
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input-login-signup"
                    placeholder="Od"
                    style={{ flex: 1, padding: '0.5rem' }}
                  />
                  <span style={{ opacity: 0.5 }}>-</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input-login-signup"
                    placeholder="Do"
                    style={{ flex: 1, padding: '0.5rem' }}
                  />
                </div>
              </div>
            </div>

            {/* Clear Filters Button */}
            {(searchQuery || selectedDay || selectedClassroom || startTime || endTime) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedDay('');
                  setSelectedClassroom('');
                  setStartTime('');
                  setEndTime('');
                }}
                className="gumb action-btn"
                style={{
                  alignSelf: 'flex-start',
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem'
                }}
              >
                <Icon icon="solar:restart-broken" /> Poništi filtere
              </button>
            )}
          </div>

          {/* Schedule List */}
          <div className="schedule-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.keys(groupedSchedule).length > 0 ? (
              Object.entries(groupedSchedule).map(([day, schedules]) => (
                <div key={day} className="day-section" style={{
                  border: '1px solid rgba(var(--isticanje2), 0.3)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  background: 'var(--iznad)'
                }}>
                  <div 
                    className={`day-header ${expandedDays[day] ? 'expanded' : ''}`}
                    onClick={() => toggleDay(day)}
                    style={{
                      padding: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: expandedDays[day] ? 'rgba(var(--isticanje), 0.1)' : 'transparent',
                      borderBottom: expandedDays[day] ? '1px solid rgba(var(--isticanje2), 0.3)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <h3 style={{ 
                      margin: 0, 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      fontWeight: 600,
                      fontSize: '1.1rem'
                    }}>
                      <Icon icon={expandedDays[day] ? "solar:alt-arrow-down-broken" : "solar:alt-arrow-right-broken"} />
                      {day}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      background: 'rgba(var(--isticanje), 0.2)',
                      borderRadius: '1rem',
                      fontSize: '0.85rem',
                      fontWeight: 600
                    }}>
                      {schedules.teorija.length + schedules.individualna.length} termina
                    </span>
                  </div>
                  
                  {expandedDays[day] && (
                    <div className="day-content" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      {schedules.teorija.length > 0 && (
                        <div className="type-section">
                          <h4 style={{ 
                            margin: '0 0 0.75rem 0', 
                            fontSize: '1rem', 
                            fontWeight: 600,
                            color: 'rgb(var(--isticanje))',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <Icon icon="solar:users-group-rounded-broken" />
                            Teorija ({schedules.teorija.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {schedules.teorija.map((item, index) => (
                              <div key={`teorija-${index}`} className="schedule-item teorija" style={{
                                display: 'flex',
                                gap: '1rem',
                                padding: '0.75rem',
                                background: 'var(--pozadina)',
                                borderRadius: 'var(--radius)',
                                borderLeft: '3px solid rgb(var(--isticanje))'
                              }}>
                                <div style={{ 
                                  minWidth: '100px',
                                  fontWeight: 600,
                                  color: 'rgb(var(--isticanje))'
                                }}>
                                  {item.vrijeme_od} - {item.vrijeme_do}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600 }}>{item.title}</div>
                                  {item.mentor && <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Mentor: {item.mentor}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {schedules.individualna.length > 0 && (
                        <div className="type-section">
                          <h4 style={{ 
                            margin: '0 0 0.75rem 0', 
                            fontSize: '1rem', 
                            fontWeight: 600,
                            color: 'rgb(var(--isticanje))',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <Icon icon="solar:user-broken" />
                            Individualna nastava ({schedules.individualna.length})
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {schedules.individualna.map((item, index) => (
                              <div key={`individualna-${index}`} className="schedule-item individualna" style={{
                                display: 'flex',
                                gap: '1rem',
                                padding: '0.75rem',
                                background: 'var(--pozadina)',
                                borderRadius: 'var(--radius)',
                                borderLeft: '3px solid rgba(var(--isticanje), 0.5)'
                              }}>
                                <div style={{ 
                                  minWidth: '100px',
                                  fontWeight: 600,
                                  color: 'rgb(var(--isticanje))'
                                }}>
                                  {item.vrijeme_od} - {item.vrijeme_do}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600 }}>
                                    {item.ucenik_ime} {item.ucenik_prezime}
                                  </div>
                                  <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Učionica: {item.ucionica}</div>
                                  {item.mentor && <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Mentor: {item.mentor}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{
                padding: '3rem',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                opacity: 0.6
              }}>
                <Icon icon="solar:calendar-broken" fontSize="3rem" />
                <p>Nema pronađenih termina</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};

export default FullSchedulePopup; 