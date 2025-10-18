import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigacija from './navigacija/index';
import NavTop from './nav-top/index';
import ApiConfig from '../components/apiConfig';
import Notification from '../components/Notifikacija';
import AddDocumentModal from '../components/AddDocumentModal';
import ShareDocumentModal from '../components/ShareDocumentModal';
import Modal from '../components/Modal';
import './Documents.css';


// File type icons mapping
const FILE_ICONS = {
  url: 'solar:link-circle-broken'
};

const Documents = ({ user, unreadChatsCount }) => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [view, setView] = useState('all'); // 'all' or 'my'
  const [files, setFiles] = useState([]);
  const [totalCounts, setTotalCounts] = useState({ total: 0, myDocuments: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentDetails, setShowDocumentDetails] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDocument, setEditedDocument] = useState(null);
  const otvoreno = 'dokumenti';

  useEffect(() => {
    if (documentId) {
      fetchDocument(documentId);
    } else {
      fetchFiles(true);
    }
  }, [view, documentId]);

  const fetchFiles = async (skipNotification = true) => {
    try {
      setIsLoading(true);
      // Fetch all documents
      const allDocsResponse = await ApiConfig.cachedApi.get('/api/documents', {
        params: {
          view,
          userId: user.id,
          excludeOwn: view === 'all'
        }
      });

      // Set total counts and files
      setTotalCounts({
        total: allDocsResponse.length,
        myDocuments: allDocsResponse.filter(doc => doc.creatorId === user.id).length
      });
      setFiles(allDocsResponse);
    } catch (error) {
      console.error('Error fetching files:', error);
      if (!skipNotification) {
        setNotification({
          type: 'error',
          message: 'Greška pri dohvaćanju datoteka'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocument = async (id) => {
    try {
      setIsLoading(true);
      const document = await ApiConfig.cachedApi.get(`/api/documents/${id}`);
      
      // Open document details without updating URL (since URL already has the document ID)
      setNotification(null);
      setSelectedDocument(document);
      setShowDocumentDetails(true);
      setEditedDocument(null);
      setIsEditing(false);

      // Fetch shared users if document has sharedToIds
      if (document.sharedToIds && document.sharedToIds.length > 0 && (!document.sharedWith || document.sharedWith.length === 0)) {
        try {
          const sharedUserPromises = document.sharedToIds.map(async (userId) => {
            try {
              const userResponse = await ApiConfig.api.get(`/api/korisnik-osnovno/${userId}`);
              return userResponse.data.user;
            } catch (userError) {
              try {
                const mentorResponse = await ApiConfig.api.get(`/api/mentori-osnovno/${userId}`);
                return mentorResponse.data;
              } catch (mentorError) {
                console.error('Error fetching shared user details:', mentorError);
                return { id: userId, ime: 'Unknown', prezime: 'User' };
              }
            }
          });

          const sharedUsers = await Promise.all(sharedUserPromises);
          setSelectedDocument(prev => ({
            ...prev,
            sharedWith: sharedUsers
          }));
        } catch (error) {
          console.error('Error fetching shared users:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching document:', error);
      setNotification({
        type: 'error',
        message: 'Greška pri dohvaćanju dokumenta'
      });
      // Navigate back to documents list on error
      navigate('/dokumenti', { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClick = () => {
    setShowAddModal(true);
  };

  const handleAddDocument = async (data) => {
    try {
      await ApiConfig.api.post('/api/documents', data);

      setNotification({
        type: 'success',
        message: 'Poveznica uspješno dodana'
      });
      setShowAddModal(false);
      // Invalidate cache before fetching new data
      ApiConfig.invalidateCache();
      fetchFiles();
    } catch (error) {
      console.error('Error adding document:', error);
      setNotification({
        type: 'error',
        message: error.response?.data?.message ||
                (error.response?.data?.error === 'You have reached the maximum limit of 10 documents'
                  ? `Dosegnuli ste limit - imate ${totalCounts.myDocuments}/10 poveznica`
                  : 'Greška pri dodavanju poveznice')
      });
    }
  };

  const handleShare = async (document) => {
    setSelectedDocument(document);
    setShowShareModal(true);
  };

  const handleShareSubmit = async (shareData) => {
    try {
      await ApiConfig.api.post(`/api/documents/${selectedDocument.id}/share`, shareData);
      setNotification({
        type: 'success',
        message: 'Poveznica uspješno podijeljena'
      });
      setShowShareModal(false);
      // Navigate back to documents list
      navigate('/dokumenti', { replace: true });
      fetchFiles();
    } catch (error) {
      console.error('Error sharing document:', error);
      setNotification({
        type: 'error',
        message: 'Greška pri dijeljenju poveznice'
      });
    }
  };

  const handleDocumentClick = async (document) => {
    // Update URL to include document ID
    navigate(`/documents/${document.id}`, { replace: false });
    
    setNotification(null);
    setSelectedDocument(document);
    setShowDocumentDetails(true);
    setEditedDocument(null);
    setIsEditing(false);

    // Fetch shared users if document has sharedToIds
    if (document.sharedToIds && document.sharedToIds.length > 0 && (!document.sharedWith || document.sharedWith.length === 0)) {
      try {
        const sharedUserPromises = document.sharedToIds.map(async (userId) => {
          try {
            // Try to fetch user details
            const userResponse = await ApiConfig.api.get(`/api/korisnik-osnovno/${userId}`);
            return userResponse.data.user;
          } catch (userError) {
            try {
              // If user not found, try to fetch mentor details
              const mentorResponse = await ApiConfig.api.get(`/api/mentori-osnovno/${userId}`);
              return mentorResponse.data;
            } catch (mentorError) {
              console.error('Error fetching shared user details:', mentorError);
              return { id: userId, ime: 'Unknown', prezime: 'User' };
            }
          }
        });

        const sharedUsers = await Promise.all(sharedUserPromises);
        setSelectedDocument(prev => ({
          ...prev,
          sharedWith: sharedUsers
        }));
      } catch (error) {
        console.error('Error fetching shared users:', error);
      }
    }
  };

  const handleViewDocument = async (document) => {
    // Open URL in new tab
    if (document.content) {
      window.open(document.content, '_blank', 'noopener,noreferrer');
    }
  };


  const handleDelete = async (document) => {
    if (!window.confirm('Jeste li sigurni da želite obrisati ovaj dokument?')) {
      return;
    }

    try {
      await ApiConfig.api.delete(`/api/documents/${document.id}`);
      setNotification({
        type: 'success',
        message: 'Poveznica uspješno obrisana'
      });
      // Close the modal and navigate back
      setShowDocumentDetails(false);
      setSelectedDocument(null);
      navigate('/dokumenti', { replace: true });
      // Invalidate cache before fetching new data
      ApiConfig.invalidateCache();
      await fetchFiles(true);
    } catch (error) {
      console.error('Error deleting document:', error);
      setNotification({
        type: 'error',
        message: 'Greška pri brisanju poveznice'
      });
    }
  };

  const handleEdit = () => {
    setNotification(null);
    setIsEditing(true);
    setEditedDocument({
      ...selectedDocument,
      name: selectedDocument.name,
      content: selectedDocument.content
    });
  };

  const handleSaveEdit = async () => {
    try {
      // Basic URL validation
      try {
        new URL(editedDocument.content);
      } catch (error) {
        setNotification({
          type: 'error',
          message: 'Molimo unesite valjan URL (npr. https://example.com)'
        });
        return;
      }

      // Save the document
      const response = await ApiConfig.api.put(`/api/documents/${editedDocument.id}`, editedDocument);

      // Update local state with the response data
      setSelectedDocument(response.data);
      setIsEditing(false);

      // Update the document in the files list without fetching
      setFiles(prevFiles =>
        prevFiles.map(file =>
          file.id === response.data.id ? response.data : file
        )
      );

      // Show notification for successful save
      setNotification({
        type: 'success',
        message: 'Poveznica uspješno ažurirana'
      });

      // Just invalidate the cache for next time
      ApiConfig.invalidateCache();

    } catch (error) {
      console.error('Error updating document:', error);
      setNotification({
        type: 'error',
        message: 'Greška pri ažuriranju poveznice'
      });
    }
  };

  const handleCancelEdit = () => {
    setNotification(null);
    setIsEditing(false);
    setEditedDocument(null);
    // Stay on the document details page when canceling edit
  };

  // Add a useEffect to clear notification after a timeout
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000); // Clear after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const renderFileIcon = (type) => {
    return <Icon icon={FILE_ICONS[type] || 'solar:link-circle-broken'} />;
  };

  const renderFileRow = (file) => {
    return (
      <div key={file.id} className="tr redak">
        <div className="th">
          <div className="file-title" style={{
            maxWidth: '300px',
            overflow: 'auto',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {renderFileIcon(file.type)}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
            {file.isPublic && (
              <Icon icon="solar:global-broken" style={{ color: 'rgb(var(--isticanje))', fontSize: '1.2rem' }} title="Javno" />
            )}
            {file.sharedToIds?.length > 0 && (
              <Icon icon="solar:users-group-rounded-bold-duotone" style={{ color: 'rgb(var(--isticanje))', fontSize: '1.2rem'}} title="Podijeljeno s korisnicima" />
            )}
          </div>
        </div>
        <div className="th mobile-none">
          {file.creatorName}
        </div>
        <div className="th mobile-none">
          {new Date(file.createdAt).toLocaleDateString('hr-HR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </div>
        <div className="th">
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div
              className="action-btn btn"
              onClick={() => handleDocumentClick(file)}
              style={{
                backgroundColor: 'var(--isticanje-svijetlo)',
                position: 'relative',
                cursor: 'pointer'
              }}
              title="Detalji"
            >
              <Icon icon="solar:round-double-alt-arrow-down-broken" />
            </div>
          </div>
        </div>
      </div>
    );
  };


  return (
    <>
      <Navigacija user={user} otvoreno={otvoreno} unreadChatsCount={unreadChatsCount} />
      <NavTop user={user} naslov="Poveznice" />

      {notification && (
        <Notification
          type={notification.type}
          message={notification.message}
          onClose={() => setNotification(null)}
        />
      )}

      <div className="main">
        <div className="tabs">
          <button
            className={`tab ${view === 'all' ? 'active' : ''}`}
            onClick={() => setView('all')}
          >
            <Icon className="icon" icon="solar:documents-broken" />
          </button>
          <button
            className={`tab ${view === 'my' ? 'active' : ''}`}
            onClick={() => setView('my')}
          >
            <Icon className="icon" icon="solar:user-id-broken" />
          </button>
        </div>

        <button
          className="floating-action-btn"
          onClick={handleAddClick}
        >
          <Icon icon="solar:add-circle-broken" />
        </button>

        <div className="document-counter" style={{
            padding: '1rem',
            marginBottom: '1rem',
            fontSize: '0.7rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div>
                {view === 'all' ? (
                  <span>Ukupno: {totalCounts.total}</span>
                ) : (
                  <>
                    <span style={{ marginRight: '1rem' }}>
                      Moje poveznice: {totalCounts.myDocuments}
                    </span>
                    {user.isMentor && (
                      <span style={{ color: 'var(--text-secondary)' }}>
                        Limit: {totalCounts.myDocuments}/10 poveznica
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        <div className="karticaZadatka">
          {/* Document Counter */}


          {files.length > 0 ? (
            <div className="tablica">
              <div className="tr naziv">
                <div className="th">Naziv</div>
                <div className="th mobile-none">Kreirao</div>
                <div className="th mobile-none">Datum</div>
                <div className="th">Akcije</div>
              </div>
              {files.map(file => renderFileRow(file))}
            </div>
          ) : (
            <p className="no-posts">Nema poveznica za prikaz.</p>
          )}
        </div>
      </div>

      {showDocumentDetails && selectedDocument && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowDocumentDetails(false);
            setSelectedDocument(null);
            setIsEditing(false);
            // Navigate back to documents list
            navigate('/dokumenti', { replace: true });
          }}
          title={
            <>
              <Icon icon="solar:link-circle-broken" />
              {isEditing ? 'Uredi poveznicu' : selectedDocument.name}
            </>
          }
          maxWidth="900px"
          isFormModal={isEditing}
        >
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <label htmlFor="edit-name" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                  Naziv <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  id="edit-name"
                  className="input-login-signup"
                  type="text"
                  value={editedDocument.name}
                  onChange={(e) => setEditedDocument({ ...editedDocument, name: e.target.value })}
                  placeholder="Unesite naziv poveznice"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label htmlFor="edit-url" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                  URL <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  id="edit-url"
                  className="input-login-signup"
                  type="url"
                  value={editedDocument.content}
                  onChange={(e) => setEditedDocument({ ...editedDocument, content: e.target.value })}
                  placeholder="https://example.com/document"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="div-radio">
                <button className="gumb action-btn zatvoriBtn" onClick={handleCancelEdit}>
                  <Icon icon="solar:close-circle-broken" /> Odustani
                </button>
                <button className="gumb action-btn spremiBtn" onClick={handleSaveEdit}>
                  <Icon icon="solar:diskette-broken" /> Spremi
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="tablica">
                  <div className="tr naziv">
                    <div className="th">Informacije</div>
                    <div className="th">Vrijednost</div>
                  </div>
                  <div className="tr redak">
                    <div className="th">Naziv</div>
                    <div className="th">{selectedDocument.name}</div>
                  </div>
                  <div className="tr redak">
                    <div className="th">URL</div>
                    <div className="th">
                      <a
                        href={selectedDocument.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'rgb(var(--isticanje))',
                          textDecoration: 'none',
                          wordBreak: 'break-all'
                        }}
                        onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                      >
                        {selectedDocument.content}
                      </a>
                    </div>
                  </div>
                  <div className="tr redak">
                    <div className="th">Kreirao</div>
                    <div className="th">{selectedDocument.creatorName}</div>
                  </div>
                  <div className="tr redak">
                    <div className="th">Datum kreiranja</div>
                    <div className="th">
                      {new Date(selectedDocument.createdAt).toLocaleDateString('hr-HR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                  <div className="tr redak">
                    <div className="th">Vidljivost</div>
                    <div className="th" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedDocument.creatorId === user.id ? (
                        <div className="toggle-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            className={`toggle-switch ${selectedDocument.isPublic ? 'active' : ''}`}
                            onClick={async () => {
                              try {
                                await ApiConfig.api.put(`/api/documents/${selectedDocument.id}`, {
                                  ...selectedDocument,
                                  isPublic: !selectedDocument.isPublic
                                });
                                setSelectedDocument({
                                  ...selectedDocument,
                                  isPublic: !selectedDocument.isPublic
                                });
                                fetchFiles();
                                setNotification({
                                  type: 'success',
                                  message: `Poveznica je sada ${!selectedDocument.isPublic ? 'javna' : 'privatna'}`
                                });
                              } catch (error) {
                                console.error('Error updating document visibility:', error);
                                setNotification({
                                  type: 'error',
                                  message: 'Greška pri promjeni vidljivosti poveznice'
                                });
                              }
                            }}
                            style={{
                              width: '48px',
                              height: '24px',
                              backgroundColor: selectedDocument.isPublic ? 'rgb(var(--isticanje))' : 'rgba(var(--isticanje), 0.3)',
                              borderRadius: '12px',
                              position: 'relative',
                              cursor: 'pointer',
                              transition: 'background-color 0.3s ease'
                            }}
                          >
                            <div
                              style={{
                                width: '20px',
                                height: '20px',
                                backgroundColor: 'white',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: '2px',
                                left: selectedDocument.isPublic ? '26px' : '2px',
                                transition: 'left 0.3s ease',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)'
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                            {selectedDocument.isPublic ? 'Javno' : 'Privatno'}
                          </span>
                        </div>
                      ) : (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: selectedDocument.isPublic ? 'rgb(var(--isticanje))' : 'var(--text)'
                        }}>
                          <Icon
                            icon={selectedDocument.isPublic ? "solar:global-broken" : "solar:lock-keyhole-minimalistic-linear"}
                            style={{ fontSize: '1.2rem' }}
                          />
                          {selectedDocument.isPublic ? 'Javno' : 'Privatno'}
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedDocument.sharedToIds && selectedDocument.sharedToIds.length > 0 && (
                    <div className="tr redak">
                      <div className="th">Dijeljeno s</div>
                      <div className="th">
                        <div className="shared-users">
                          {selectedDocument.sharedToIds.map((userId, index) => (
                            <span key={userId} className="shared-user">
                              {selectedDocument.sharedWith?.[index]?.ime} {selectedDocument.sharedWith?.[index]?.prezime}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="div-radio">
                  {(selectedDocument.creatorId === user.id || selectedDocument.sharedToIds?.includes(user.id)) && (
                    <button
                      className="gumb action-btn"
                      onClick={handleEdit}
                    >
                      <Icon icon="solar:pen-broken" /> Uredi
                    </button>
                  )}

                  <button
                    className="gumb action-btn"
                    onClick={() => handleViewDocument(selectedDocument)}
                  >
                    <Icon icon="solar:eye-broken" /> Otvori link
                  </button>

                  {selectedDocument.creatorId === user.id && (
                    <>
                      <button
                        className="gumb action-btn"
                        onClick={() => {
                          setShowShareModal(true);
                          setShowDocumentDetails(false);
                        }}
                      >
                        <Icon icon="solar:share-broken" /> Dijeli
                      </button>

                      <button
                        className="gumb action-btn abDelete"
                        onClick={() => handleDelete(selectedDocument)}
                      >
                        <Icon icon="solar:trash-bin-trash-broken" /> Obriši
                      </button>
                    </>
                  )}
                </div>
            </div>
          )}
        </Modal>
      )}

      {showAddModal && (
        <AddDocumentModal
          onAdd={handleAddDocument}
          onCancel={() => setShowAddModal(false)}
        />
      )}

      {showShareModal && selectedDocument && (
        <ShareDocumentModal
          document={selectedDocument}
          onShare={handleShareSubmit}
          onCancel={() => {
            setShowShareModal(false);
            // Navigate back to documents list
            navigate('/dokumenti', { replace: true });
          }}
        />
      )}
    </>
  );
};

export default Documents;
