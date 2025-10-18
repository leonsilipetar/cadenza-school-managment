import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Icon } from '@iconify/react';
import ApiConfig from '../../components/apiConfig';
import { showNotification } from '../../components/Notifikacija';
import Modal from '../../components/Modal';
import "../../styles/styles.css"

const DodajTermin = ({ onCancel, studentID, dodajRasporedTeorija, user }) => {
  const [isDodajMentoraDisabled, setIsDodajMentoraDisabled] = useState(false);
  const [selectedDay, setSelectedDay] = useState('pon');
  const [selectedInterval, setSelectedInterval] = useState(45);
  const [selectedStartTime, setSelectedStartTime] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState('');
  const [existingSlots, setExistingSlots] = useState([]);
  const [terms, setTerms] = useState([]);
  const [inputs, setInputs] = useState({
    mentor: '',
  });
  const [selectedDuration, setSelectedDuration] = useState(45);
  const [customDuration, setCustomDuration] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [minutes, setMinutes] = useState(0);
  const [dvorana, setDvorana] = useState('');
  const [mentor, setMentor] = useState('');
  const [error, setError] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(null);

  const days = [
    { id: 'pon', label: 'Ponedjeljak' },
    { id: 'uto', label: 'Utorak' },
    { id: 'sri', label: 'Srijeda' },
    { id: 'cet', label: 'Četvrtak' },
    { id: 'pet', label: 'Petak' },
    { id: 'sub', label: 'Subota' }
  ];

  const intervals = [
    { value: 45, label: '45 minuta' },
    { value: 60, label: '1 sat' },
    { value: 90, label: '1 sat i 30 min' },
    { value: 'custom', label: 'Proizvoljno' }
  ];

  const durations = [
    { value: 45, label: '45 minuta' },
    { value: 60, label: '1 sat' },
    { value: 90, label: '1 sat i 30 min' },
    { value: 'custom', label: 'Proizvoljno' }
  ];

  const weeks = [
    { id: null, label: 'Svaki tjedan' },
    { id: 'A', label: 'A tjedan' },
    { id: 'B', label: 'B tjedan' }
  ];

  // Fetch classrooms on component mount
  useEffect(() => {
    const fetchClassrooms = async () => {
      try {
        // Add schoolId to the request if user has one
        const schoolId = user?.schoolId;
        const endpoint = schoolId
          ? `/api/classrooms?schoolId=${schoolId}`
          : '/api/classrooms';

        const res = await ApiConfig.api.get(endpoint);
        setClassrooms(res.data);
      } catch (err) {
        console.error('Error fetching classrooms:', err);
        showNotification('error', 'Greška pri dohvaćanju učionica');
      }
    };
    fetchClassrooms();
  }, [user?.schoolId]); // Add schoolId to dependency array

  // Helper function to convert time to minutes
  const timeToMinutes = (time) => {
    const [hours, minutes = 0] = time.toString().split(':').map(Number);
    return hours * 60 + Number(minutes);
  };

  // Helper function to convert minutes to time string
  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Function to map out occupied and non-occupied intervals
  const mapTimeIntervals = (existingSlots) => {
    const START_OF_DAY = 8 * 60; // 08:00 in minutes
    const END_OF_DAY = 22 * 60;  // 22:00 in minutes

    // Sort slots by start time
    const sortedSlots = [...existingSlots].sort((a, b) => {
      return timeToMinutes(a.vrijeme) - timeToMinutes(b.vrijeme);
    });

    const occupied = [];
    const nonOccupied = [];
    let currentTime = START_OF_DAY;

    sortedSlots.forEach(slot => {
      const slotStart = timeToMinutes(slot.vrijeme);
      const slotEnd = slotStart + slot.duration;

      // If there's a gap before this slot, add it to non-occupied
      if (currentTime < slotStart) {
        nonOccupied.push({
          start: minutesToTime(currentTime),
          end: minutesToTime(slotStart),
          duration: slotStart - currentTime
        });
      }

      // Add the occupied slot
      occupied.push({
        start: minutesToTime(slotStart),
        end: minutesToTime(slotEnd),
        duration: slot.duration,
        type: slot.type,
        mentor: slot.mentor
      });

      currentTime = slotEnd;
    });

    // Add final non-occupied period if there is one
    if (currentTime < END_OF_DAY) {
      nonOccupied.push({
        start: minutesToTime(currentTime),
        end: minutesToTime(END_OF_DAY),
        duration: END_OF_DAY - currentTime
      });
    }

    return { occupied, nonOccupied };
  };

  // Update useEffect to create the intervals when slots change
  useEffect(() => {
    if (selectedClassroom) {
      const fetchSlots = async () => {
        try {
          const classroom = classrooms.find(c => c.id.toString() === selectedClassroom.toString());
          if (!classroom || classroom.schoolId !== user?.schoolId) {
            showNotification('error', 'Nemate pristup ovoj učionici');
            setExistingSlots([]);
            return;
          }

          const endpoint = `/api/raspored/${selectedDay}/${selectedClassroom}`;
          const res = await ApiConfig.api.get(endpoint, {
            params: {
              schoolId: user?.schoolId,
              week: selectedWeek // Send selected week to backend
            }
          });

          // Filter slots based on week type
          const filteredSlots = res.data.filter(slot => {
            // If no week is selected (show all slots) or slot has no week specified (shows in both weeks)
            if (!selectedWeek || !slot.week) return true;
            // If week is selected, only show slots for that week or slots with no week specified
            return slot.week === selectedWeek;
          });

          setExistingSlots(filteredSlots);
          const intervals = mapTimeIntervals(filteredSlots);
        } catch (err) {
          console.error('Error fetching slots:', err);
          showNotification('error', 'Greška pri dohvaćanju termina');
        }
      };
      fetchSlots();
    }
  }, [selectedDay, selectedClassroom, user?.schoolId, classrooms, selectedWeek]); // Include selectedWeek in dependencies

  // Helper function to check if a time range is available
  const isTimeRangeAvailable = (startMinutes, duration, existingSlots) => {
    const endMinutes = startMinutes + duration;

    // Check against all existing slots
    const isOverlapping = existingSlots.some(slot => {
      const slotStart = timeToMinutes(slot.vrijeme);
      const slotEnd = slotStart + slot.duration;

      // Check if the new slot would overlap with an existing slot
      const hasOverlap = (startMinutes < slotEnd && endMinutes > slotStart);

      // If a slot ends exactly at our start time, it's not an overlap
      if (slotEnd === startMinutes) return false;

      // If our slot ends exactly at the start of another slot, it's not an overlap
      if (endMinutes === slotStart) return false;

      return hasOverlap;
    });

    return !isOverlapping;
  };

  // Helper function to find available minutes in an hour
  const findAvailableMinutesInHour = (hour, nonOccupied) => {
    const hourStart = hour * 60;
    const hourEnd = (hour + 1) * 60;

    return nonOccupied
      .filter(interval => {
        const start = timeToMinutes(interval.start);
        const end = timeToMinutes(interval.end);
        return start < hourEnd && end > hourStart;
      })
      .map(interval => {
        const start = Math.max(hourStart, timeToMinutes(interval.start));
        const end = Math.min(hourEnd, timeToMinutes(interval.end));
        return {
          start: start % 60,
          end: end % 60,
          duration: end - start
        };
      });
  };

  // Update handleTimeClick to allow selecting any slot
  const handleTimeClick = (time) => {
    const hour = parseInt(time);
    const hourStart = hour * 60;
    const hourEnd = (hour + 1) * 60;

    // Find any terms that end in this hour
    const endingTerms = existingSlots.filter(slot => {
      const slotStart = timeToMinutes(slot.vrijeme);
      const slotEnd = slotStart + slot.duration;
      return slotEnd > hourStart && slotEnd <= hourEnd;
    });

    // Set minutes to the latest ending time in this hour, or 0 if none
    let startMinutes = 0;
    if (endingTerms.length > 0) {
      const latestEnd = Math.max(...endingTerms.map(slot =>
        timeToMinutes(slot.vrijeme) + slot.duration
      ));
      startMinutes = latestEnd % 60;
    }

    setSelectedStartTime(time);
    setMinutes(startMinutes);
  };

  // Update handleMinutesChange to respect occupied slots
  const handleMinutesChange = (increment) => {
    if (!selectedStartTime) return;

    const hour = parseInt(selectedStartTime);
    const currentTimeInMinutes = hour * 60 + minutes;
    const newMinutes = minutes + increment;

    // Find any overlapping slots
    const hasOverlap = existingSlots.some(slot => {
      const slotStart = timeToMinutes(slot.vrijeme);
      const slotEnd = slotStart + slot.duration;

      // Check if new time would overlap
      return currentTimeInMinutes + increment >= slotStart &&
             currentTimeInMinutes + increment < slotEnd;
    });

    if (!hasOverlap && newMinutes >= 0 && newMinutes < 60) {
      setMinutes(newMinutes);
    }
  };

  // Add this helper function to get occupied slots in an hour
  const getOccupiedSlotsInHour = (hour, existingSlots) => {
    const hourStart = hour * 60;
    const hourEnd = (hour + 1) * 60;

    return existingSlots
      .filter(slot => {
        const slotStart = timeToMinutes(slot.vrijeme);
        const slotEnd = slotStart + slot.duration;
        return slotStart < hourEnd && slotEnd > hourStart;
      })
      .map(slot => {
        const slotStart = timeToMinutes(slot.vrijeme);
        const slotEnd = slotStart + slot.duration;

        // Calculate relative position within the hour
        const startInHour = Math.max(hourStart, slotStart);
        const endInHour = Math.min(hourEnd, slotEnd);

        return {
          type: slot.type || 'učenik',
          mentor: slot.mentor,
          topOffset: ((startInHour - hourStart) / 60) * 100,
          height: ((endInHour - startInHour) / 60) * 100,
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(slotEnd)
        };
      });
  };

  // Update generateTimeSlots to allow selecting any slot
  const generateTimeSlots = () => {
    const slots = [];

    for (let hour = 8; hour < 22; hour++) {
      const time = String(hour);
      const occupiedSlots = getOccupiedSlotsInHour(hour, existingSlots);

      slots.push(
        <div
          key={time}
          className={`timeline-slot ${selectedStartTime === time ? 'selected' : ''}`}
          onClick={() => handleTimeClick(time)}
        >
          <span className="time-label">{hour}:00</span>
          <div className="slot-content">
            {occupiedSlots.map((indicator, index) => (
              <div
                key={index}
                className={`occupied-indicator type-${indicator.type}`}
                style={{
                  top: `${indicator.topOffset}%`,
                  height: `${indicator.height}%`,
                  minHeight: '24px'
                }}
              >
                <div className="indicator-content">
                  <div className="time-info">
                    <span className="slot-type">
                      {indicator.type === 'teorija' ? 'Teorija' : 'Učenik'}
                    </span>
                    <span className="slot-duration">
                      {indicator.startTime} - {indicator.endTime}
                    </span>
                  </div>
                  {indicator.mentor && (
                    <div className="mentor-info">{indicator.mentor}</div>
                  )}
                </div>
              </div>
            ))}

            {selectedStartTime === time && (
              <div className="minutes-selector">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMinutesChange(-5);
                  }}
                  className="time-btn"
                >
                  -
                </button>
                <span className="minutes-display">
                  {minutes.toString().padStart(2, '0')}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMinutesChange(5);
                  }}
                  className="time-btn"
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return slots;
  };

  // Update the validateNewTerm function to handle week validation
  const validateNewTerm = (newTerm, existingTerms) => {
    // Check if duration is valid
    if (!newTerm.duration || newTerm.duration < 15 || newTerm.duration > 180) {
      return 'Trajanje mora biti između 15 i 180 minuta';
    }

    // Check if time is valid
    const timeMinutes = timeToMinutes(newTerm.vrijeme);
    if (timeMinutes < 8 * 60 || timeMinutes > 22 * 60) {
      return 'Vrijeme mora biti između 08:00 i 22:00';
    }

    // Check if the term is for the correct school
    if (user?.schoolId && newTerm.schoolId !== user.schoolId) {
      return 'Termin mora biti za vašu školu';
    }

    // Check for overlaps only within the same school and week
    const overlap = existingTerms.some(term => {
      if (term.day !== newTerm.day ||
          term.dvorana !== newTerm.dvorana ||
          term.schoolId !== newTerm.schoolId) return false;

      // If terms are in different weeks (A/B), they don't overlap
      if (term.week && newTerm.week && term.week !== newTerm.week) return false;

      // If one term is for all weeks and other is week-specific, they overlap
      if ((term.week && !newTerm.week) || (!term.week && newTerm.week)) return true;

      const termStart = timeToMinutes(term.vrijeme);
      const termEnd = termStart + term.duration;
      const newTermStart = timeMinutes;
      const newTermEnd = newTermStart + newTerm.duration;

      return (newTermStart < termEnd && newTermEnd > termStart);
    });

    if (overlap) {
      return 'Termin se preklapa s postojećim terminom u odabranom tjednu';
    }

    return null;
  };

  // Update the handleAddTerm function to include week information
  const handleAddTerm = () => {
    if (!selectedDay || !selectedClassroom || !selectedStartTime) {
      showNotification('error', 'Molimo odaberite sve potrebne podatke!');
      return;
    }

    const selectedRoom = classrooms.find(c => c.id.toString() === selectedClassroom.toString());
    const formattedTime = `${selectedStartTime}:${minutes.toString().padStart(2, '0')}`;
    const duration = selectedDuration === 'custom' ? Number(customDuration) : Number(selectedDuration);

    const newTerm = {
      day: selectedDay,
      dvorana: selectedRoom?.name || '',
      vrijeme: formattedTime,
      mentor: inputs.mentor || '',
      duration: duration,
      type: dodajRasporedTeorija ? 'teorija' : 'učenik',
      schoolId: user?.schoolId,
      week: selectedWeek // This can be null (every week), 'A', or 'B'
    };

    // Validate the new term
    const validationError = validateNewTerm(newTerm, [...terms, ...existingSlots]);
    if (validationError) {
      showNotification('error', validationError);
      return;
    }

    // Add the term and reset selection
    setTerms(prevTerms => [...prevTerms, newTerm]);
    setSelectedStartTime(null);
    setMinutes(0);
    setInputs(prev => ({ ...prev, mentor: '' }));

    showNotification('success', 'Termin dodan!');

    // Refresh the available slots
    const updatedSlots = [...existingSlots, newTerm];
    setExistingSlots(updatedSlots);
  };

  const saveTerms = async (terms) => {
    try {
      let res;
      const termData = terms.map(term => ({
        day: term.day,
        dvorana: term.dvorana,
        vrijeme: term.vrijeme,
        mentor: term.mentor || '',
        duration: Number(term.duration),
        schoolId: user?.schoolId,
        type: dodajRasporedTeorija ? 'teorija' : 'učenik',
        week: term.week
      }));


      if (dodajRasporedTeorija) {
        // For teorija schedule, we need to merge with existing terms
        res = await ApiConfig.api.post('/api/uredi/teorija', {
          raspored: termData,
          schoolId: user?.schoolId,
          updateSchoolId: user?.schoolId,
          merge: true  // Add this flag to indicate we want to merge
        });
      } else if (studentID) {
        res = await ApiConfig.api.post(`/api/uredi/ucenik-raspored/${studentID}`, {
          raspored: termData,
          schoolId: user?.schoolId
        });
      }

      if (res?.data) {
        return res.data;
      }
      throw new Error('No response data');
    } catch (err) {
      console.error('Error saving terms:', err);
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsDodajMentoraDisabled(true);

    try {
      const result = await saveTerms(terms);
      if (result) {
        // Invalidate the cache
        await ApiConfig.invalidateCache();

        showNotification('success', 'Raspored je uspješno dodan!');
        setTerms([]);

        // Close the form
        onCancel();
      }
    } catch (error) {
      console.error('Save error:', error);
      showNotification('error', 'Došlo je do greške pri spremanju rasporeda!');
    } finally {
      setIsDodajMentoraDisabled(false);
    }
  };


  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={
        <>
          <Icon icon="solar:calendar-add-broken" />
          {dodajRasporedTeorija ? 'Dodaj termin teorije' : 'Dodaj termin'}
        </>
      }
      maxWidth="1000px"
      isFormModal={true}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Added Terms Display */}
        {terms.length > 0 && (
          <div style={{
            padding: '1rem',
            background: 'rgba(var(--isticanje), 0.1)',
            border: '1px solid rgba(var(--isticanje), 0.3)',
            borderRadius: 'var(--radius)'
          }}>
            <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Icon icon="solar:calendar-mark-broken" />
              Dodani termini ({terms.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {terms.map((term, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem',
                  background: 'var(--iznad)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.9rem'
                }}>
                  <div>
                    <strong>{days.find(d => d.id === term.day)?.label}:</strong> {term.dvorana}, {term.vrijeme} - {minutesToTime(timeToMinutes(term.vrijeme) + term.duration)} ({term.duration} min)
                    {term.mentor && <span style={{ opacity: 0.8 }}> • {term.mentor}</span>}
                    {term.week && <span style={{ opacity: 0.8 }}> • Tjedan {term.week}</span>}
                  </div>
                  <button
                    type="button"
                    className="action-btn abDelete"
                    onClick={() => setTerms(prev => prev.filter((_, i) => i !== index))}
                    style={{ padding: '0.5rem', minWidth: 'auto' }}
                  >
                    <Icon icon="solar:trash-bin-trash-broken" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Week Selection */}
        <div>
          <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Odabir tjedna
          </label>
          <div className="notification-filters">
            {weeks.map((week) => (
              <button
                key={week.id || 'all'}
                type="button"
                className={`filter-btn ${selectedWeek === week.id ? 'active' : ''}`}
                onClick={() => setSelectedWeek(week.id)}
                style={{
                  background: selectedWeek === week.id ? 'rgb(var(--isticanje))' : 'rgb(var(--isticanje2))',
                  color: selectedWeek === week.id ? 'var(--pozadina)' : 'var(--tekst)'
                }}
              >
                {week.label}
              </button>
            ))}
          </div>
        </div>

        {/* Day Selection */}
        <div>
          <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Odabir dana <span style={{ color: 'red' }}>*</span>
          </label>
          <div className="div-radio raspored-divs" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            {days.map((day) => (
              <div
                key={day.id}
                className={`radio-item ${selectedDay === day.id ? 'checked' : ''}`}
                onClick={() => setSelectedDay(day.id)}
                style={{
                  flex: '1 1 calc(33.333% - 0.5rem)',
                  minWidth: '120px',
                  textAlign: 'center',
                  padding: '0.75rem',
                  background: selectedDay === day.id ? 'rgba(var(--isticanje), 0.1)' : 'rgba(var(--isticanje2), 0.05)',
                  border: `2px solid ${selectedDay === day.id ? 'rgb(var(--isticanje))' : 'rgba(var(--isticanje2), 0.3)'}`,
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: selectedDay === day.id ? 600 : 400
                }}
              >
                {day.label}
              </div>
            ))}
          </div>
        </div>

        {/* Classroom and Duration */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div>
            <label htmlFor="dvorana" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
              Dvorana <span style={{ color: 'red' }}>*</span>
            </label>
            <select
              id="dvorana"
              className="input-login-signup"
              name="dvorana"
              value={selectedClassroom}
              onChange={(e) => setSelectedClassroom(e.target.value)}
              disabled={isDodajMentoraDisabled}
              style={{ width: '100%' }}
            >
              <option value="">Odaberite dvoranu</option>
              {classrooms.map(classroom => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="duration" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
              Trajanje <span style={{ color: 'red' }}>*</span>
            </label>
            <select
              id="duration"
              className="input-login-signup"
              value={selectedDuration}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDuration(value === 'custom' ? 'custom' : Number(value));
              }}
              disabled={isDodajMentoraDisabled}
              style={{ width: '100%' }}
            >
              {durations.map(duration => (
                <option key={duration.value} value={duration.value}>
                  {duration.label}
                </option>
              ))}
            </select>

            {selectedDuration === 'custom' && (
              <input
                type="number"
                className="input-login-signup"
                placeholder="Unesite minute (15-180)"
                value={customDuration}
                onChange={(e) => setCustomDuration(e.target.value)}
                min="15"
                max="180"
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            )}
          </div>
        </div>

        {/* Time Selection */}
        <div>
          <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Odabir vremena <span style={{ color: 'red' }}>*</span>
          </label>
          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem' }}>
            Kliknite na sat za odabir. Zelena = slobodno, Crvena = zauzeto
          </div>
          <div className="timeline-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {generateTimeSlots()}
          </div>
        </div>

        {/* Notes/Mentor Field */}
        <div>
          <label htmlFor="mentor" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Napomena
          </label>
          <input
            id="mentor"
            className="input-login-signup"
            value={inputs.mentor}
            onChange={(e) => setInputs({ ...inputs, mentor: e.target.value })}
            type="text"
            name="mentor"
            placeholder="Mentor, program ili dodatna napomena..."
            style={{ width: '100%' }}
          />
        </div>

        {/* Add Term Button */}
        <button
          type="button"
          className={`gumb action-btn ${isDodajMentoraDisabled ? 'disabledSpremiBtn' : ''}`}
          onClick={handleAddTerm}
          disabled={!selectedStartTime || isDodajMentoraDisabled}
          style={{
            background: selectedStartTime && !isDodajMentoraDisabled ? 'rgb(var(--isticanje))' : undefined,
            color: selectedStartTime && !isDodajMentoraDisabled ? 'var(--pozadina)' : undefined
          }}
        >
          <Icon icon="solar:add-circle-broken" /> Dodaj termin
        </button>

        {/* Action Buttons */}
        <div className="div-radio">
          <button
            type="button"
            className="gumb action-btn zatvoriBtn"
            onClick={onCancel}
          >
            <Icon icon="solar:close-circle-broken" /> Odustani
          </button>
          <button
            type="submit"
            className={`gumb action-btn spremiBtn ${isDodajMentoraDisabled ? 'disabledSpremiBtn' : ''}`}
            disabled={isDodajMentoraDisabled || terms.length === 0}
          >
            <Icon icon={isDodajMentoraDisabled ? "solar:loading-bold-duotone" : "solar:diskette-broken"} className={isDodajMentoraDisabled ? "spin" : ""} />
            {isDodajMentoraDisabled ? 'Spremanje...' : 'Spremi raspored'}
          </button>
        </div>
      </form>
    </Modal>
  );
};


export default DodajTermin;