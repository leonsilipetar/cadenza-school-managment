import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import ApiConfig from './apiConfig';
import Modal from './Modal';

const ShareDocumentModal = ({ document, onShare, onCancel }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchTerm]);

  const searchUsers = async () => {
    try {
      const response = await ApiConfig.api.get('/api/search/users', {
        params: { query: searchTerm }
      });
      setUsers(response.data.results || []);
    } catch (error) {
      console.error('Error searching users:', error);
    }
  };

  const toggleUserSelection = (user) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onShare({
      userIds: selectedUsers.map(u => u.id)
    });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title={
        <>
          <Icon icon="solar:share-broken" />
          Dijeli poveznicu
        </>
      }
      maxWidth="800px"
      isFormModal={true}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* User Search */}
        <div>
          <label htmlFor="user-search" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
            Pretraži korisnike
          </label>
          <input
            id="user-search"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Unesite ime ili prezime..."
            className="input-login-signup"
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: '0.25rem' }}>
            Unesite najmanje 2 znaka za pretragu
          </div>
        </div>

        {/* Search Results */}
        {searchTerm.length >= 2 && (
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Rezultati pretrage
            </h3>
            {users.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {users
                  .filter(user => !selectedUsers.some(su => su.id === user.id))
                  .map(user => (
                    <div
                      key={user.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'rgba(var(--isticanje2), 0.05)',
                        border: '1px solid rgba(var(--isticanje2), 0.2)',
                        borderRadius: 'var(--radius)'
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{user.ime} {user.prezime}</span>
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => toggleUserSelection(user)}
                        style={{
                          background: 'rgb(var(--isticanje))',
                          color: 'var(--pozadina)'
                        }}
                      >
                        <Icon icon="solar:add-circle-broken" /> Dodaj
                      </button>
                    </div>
                  ))}
              </div>
            ) : (
              <p style={{ textAlign: 'center', opacity: 0.7, padding: '1rem' }}>
                Nema rezultata pretrage
              </p>
            )}
          </div>
        )}

        {/* Selected Users */}
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Odabrani korisnici ({selectedUsers.length})
          </h3>
          {selectedUsers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedUsers.map(user => (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: 'rgba(var(--isticanje), 0.1)',
                    border: '1px solid rgba(var(--isticanje), 0.3)',
                    borderRadius: 'var(--radius)'
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{user.ime} {user.prezime}</span>
                  <button
                    type="button"
                    className="action-btn abDelete"
                    onClick={() => toggleUserSelection(user)}
                  >
                    <Icon icon="solar:trash-bin-trash-broken" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', opacity: 0.7, padding: '1rem', background: 'rgba(var(--isticanje2), 0.05)', borderRadius: 'var(--radius)' }}>
              Nema odabranih korisnika
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="div-radio">
          <button
            type="button"
            className="action-btn zatvoriBtn"
            onClick={onCancel}
          >
            <Icon icon="solar:close-circle-broken" /> Odustani
          </button>
          <button
            type="submit"
            className="action-btn spremiBtn"
            disabled={selectedUsers.length === 0}
          >
            <Icon icon="solar:share-broken" /> Dijeli
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ShareDocumentModal; 