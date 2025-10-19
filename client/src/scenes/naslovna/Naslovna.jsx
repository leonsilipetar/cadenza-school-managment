import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import Navigacija from '../navigacija';
import NavTop from '../nav-top';
import ApiConfig from '../../components/apiConfig.js';
import { Icon } from '@iconify/react';
import PostEditor from '../../components/PostEditor.jsx';
import PostEditorOpened from '../../components/PostEditorOpened.jsx';
import LoadingShell from '../../components/LoadingShell';
import UserProfile from '../../components/UserProfile';
import "../../styles/Posts.css";
import { showNotification } from '../../components/Notifikacija';
import { useNavigate, useLocation } from 'react-router-dom';
import moment from 'moment';
import Modal from '../../components/Modal';
import { usePosts, useDeletePost } from '../../hooks/usePosts';
import { useQueryClient } from '@tanstack/react-query';

axios.defaults.withCredentials = true;

const Naslovna = ({ user, unreadChatsCount }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // REACT QUERY: Use hook for posts - automatic caching and updates!
  const { data: posts = [], isLoading: loading, refetch: refetchPosts, isFetching: isRefetchingPosts } = usePosts();
  const deletePost = useDeletePost();
  const queryClient = useQueryClient();
  
  // Local state for polls (temporary until we create usePolls hook)
  const [activePolls, setActivePolls] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState('posts');
  const [showPostEditor, setShowPostEditor] = useState(false);
  const [showPostEditorOpened, setShowPostEditorOpened] = useState(false);
  const [currentPost, setCurrentPost] = useState(null);
  const [expandedPosts, setExpandedPosts] = useState(new Set());
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [showPollForm, setShowPollForm] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['Da', 'Ne']);
  const [pollEndDate, setPollEndDate] = useState('');
  const [showPostDetails, setShowPostDetails] = useState(false);
  const [detailedPost, setDetailedPost] = useState(null);

  // Handle URL parameters and set active tab
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    } else if (activePolls.length > 0 && (user.isMentor || user.pohadjaTeoriju)) {
      // Automatically set polls tab if there are active polls and user has access
      setActiveTab('polls');
      // Update URL without causing a navigation
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('tab', 'polls');
      window.history.replaceState({}, '', newUrl);
    }
  }, [location.search, activePolls.length, user]);

  const otvoreno = 'naslovna';

  // Fetch active polls on mount
  useEffect(() => {
    const fetchPolls = async () => {
      try {
        const response = await ApiConfig.api.get('/api/polls/active');
        setActivePolls(response.data.polls || []);
      } catch (error) {
        console.error('Error fetching polls:', error);
      }
    };
    
    if (user && (user.isMentor || user.pohadjaTeoriju)) {
      fetchPolls();
    }
  }, [user]);

  const isExpired = (endDate) => {
    return new Date(endDate) <= new Date();
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const response = await ApiConfig.cachedApi.get('/api/search/users', {
        params: { query }
      });
      setSearchResults(response.results || []);
    } catch (error) {
      console.error('Error searching:', error);
      showNotification('error', 'Error searching users');
    }
  };

  const handleCreatePost = () => {
    setShowPostEditor(true);
  };

  const handleEditPost = (post) => {
    setCurrentPost(post);
    setShowPostEditorOpened(true);
  };

  const handlePostSaved = async () => {
    // React Query automatically refreshes after mutations
    queryClient.invalidateQueries({ queryKey: ['posts', 'list'] });
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Jeste li sigurni da želite obrisati ovu objavu?')) {
      return;
    }

    try {
      await deletePost.mutateAsync(postId);
      showNotification('success', 'Objava uspješno obrisana');
    } catch (error) {
      console.error('Error deleting post:', error);
      showNotification('error', error.response?.data?.message || 'Greška pri brisanju objave');
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('hr-HR', options);
  };

  const togglePostExpansion = (postId) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  const handleOpenPost = (post) => {
    setDetailedPost(post);
    setShowPostDetails(true);
  };

  const handleClosePostDetails = () => {
    setShowPostDetails(false);
    setDetailedPost(null);
  };

  const handleCreatePoll = async () => {
    if (!pollQuestion || pollOptions.length < 2 || !pollEndDate) {
      showNotification('error', 'Molimo popunite sva polja');
      return;
    }

    try {
      await ApiConfig.api.post('/api/polls', {
        question: pollQuestion,
        options: pollOptions,
        type: 'teorija',
        endDate: pollEndDate
      });

      showNotification('success', 'Anketa je uspješno kreirana');
      setShowPollForm(false);
      setPollQuestion('');
      setPollOptions(['Da', 'Ne']);
      setPollEndDate('');
      const response = await ApiConfig.api.get('/api/polls/active');
      setActivePolls(response.data.polls || []);
    } catch (error) {
      console.error('Error creating poll:', error);
      showNotification('error', 'Greška pri kreiranju ankete');
    }
  };

  const handleVote = async (pollId, option) => {
    try {
      await ApiConfig.api.post(`/api/polls/${pollId}/vote`, {
        response: option,
        userId: user.id,
        ime: user.ime,
        prezime: user.prezime,
        timestamp: new Date().toISOString()
      });

      // After successful vote, fetch the updated poll without cache
      const response = await ApiConfig.api.get('/api/polls/active', {
        headers: { 'Cache-Control': 'no-cache' }
      });
      const updatedPolls = response.data.polls || [];
      setActivePolls(updatedPolls);

      // Update the selected poll if it's currently open
      const updatedPoll = updatedPolls.find(p => p.id === pollId);
      if (updatedPoll) {
        setSelectedPoll(updatedPoll);
      }

      showNotification('success', 'Vaš odgovor je zabilježen');
    } catch (error) {
      console.error('Error submitting vote:', error);
      showNotification('error', error.response?.data?.message || 'Greška pri glasanju');
    }
  };

  const addPollOption = () => {
    setPollOptions([...pollOptions, '']);
  };

  const updatePollOption = (index, value) => {
    const newOptions = [...pollOptions];
    newOptions[index] = value;
    setPollOptions(newOptions);
  };

  const removePollOption = (index) => {
    if (pollOptions.length > 2) {
      const newOptions = pollOptions.filter((_, i) => i !== index);
      setPollOptions(newOptions);
    }
  };

  const calculatePercentage = (responses, option) => {
    if (!responses || responses.length === 0) return 0;
    const count = responses.filter(r => r.response === option).length;
    return Math.round((count / responses.length) * 100);
  };

  const handleDeletePoll = async (pollId) => {
    if (!window.confirm('Jeste li sigurni da želite obrisati ovu anketu?')) {
      return;
    }

    try {
      await ApiConfig.api.delete(`/api/polls/${pollId}`);
      showNotification('success', 'Anketa uspješno obrisana');
      const response = await ApiConfig.api.get('/api/polls/active');
      setActivePolls(response.data.polls || []);
    } catch (error) {
      console.error('Error deleting poll:', error);
      showNotification('error', error.response?.data?.message || 'Greška pri brisanju ankete');
    }
  };

  const getRemainingVoteTime = (responses, userId) => {
    if (!responses) return null;
    const userResponse = responses.find(r => r.userId === userId);
    if (!userResponse) return null;

    const voteTime = new Date(userResponse.timestamp);
    const timeDiff = (new Date() - voteTime) / 1000 / 60; // Convert to minutes
    const remainingTime = Math.max(0, 10 - Math.floor(timeDiff));
    return remainingTime;
  };

  const getMinutesText = (minutes) => {
    if (minutes === 1) return 'minutu';
    if (minutes >= 2 && minutes <= 4) return 'minute';
    return 'minuta';
  };

  if (loading) return <LoadingShell />;

  return (
    <>
      <Navigacija user={user} otvoreno={otvoreno} unreadChatsCount={unreadChatsCount} />
      <NavTop user={user} naslov={'Naslovna'} />

      <div className="main">
        <div className="karticaZadatka posts">
          <div className="notification-filters">
            <button
              className={`filter-btn ${isRefetchingPosts ? 'active' : ''}`}
              onClick={() => refetchPosts()}
              title="Osvježi objave"
              disabled={isRefetchingPosts}
            >
              <Icon icon={isRefetchingPosts ? "solar:loading-bold-duotone" : "solar:refresh-broken"} className={isRefetchingPosts ? "spin" : ""} />
              {isRefetchingPosts ? 'Učitavanje...' : 'Osvježi'}
            </button>
            <button
              className={`filter-btn ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              <Icon icon="solar:card-search-broken" />
              Pretraži
            </button>
            <button
              className={`filter-btn ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              <Icon icon="solar:document-text-broken" />
              Objave
            </button>
            {user?.isMentor && (
              <button
                className={`filter-btn ${activeTab === 'my-posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-posts')}
              >
                <Icon icon="solar:clapperboard-edit-broken" />
                Moje objave
              </button>
            )}
            <button
              className={`filter-btn ${activeTab === 'polls' ? 'active' : ''}`}
              onClick={() => setActiveTab('polls')}
            >
              <Icon icon="solar:chart-2-broken" />
              Ankete {activePolls.length > 0 && <span className="poll-count">{activePolls.length}</span>}
            </button>
            <button className={`filter-btn`}>
              <a href="https://cadenza.com.hr" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
                <Icon icon="solar:link-broken" />
                Posjeti cadenza.com.hr
              </a>
            </button>
          </div>
        </div>

        {/* Floating action button - OUTSIDE karticaZadatka to prevent hover issues */}
        {user?.isMentor && activeTab === 'polls' && (
          <button
            className="floating-action-btn"
            onClick={() => setShowPollForm(true)}
          >
            <Icon icon="solar:add-circle-broken" />
          </button>
        )}

        {user?.isMentor && activeTab !== 'polls' && activeTab !== 'search' && (
          <button
            className="floating-action-btn"
            onClick={handleCreatePost}
          >
            <Icon icon="solar:add-circle-broken" />
          </button>
        )}

        {loading ? (
          <div className="popup">
            <LoadingShell />
          </div>
        ) : (
          <>
            {/* Quick Actions Card - Prominent on Posts Tab */}
            {activeTab === 'posts' && (
              <div className="karticaZadatka" style={{
                background: 'linear-gradient(135deg, rgba(var(--isticanje), 0.08) 0%, rgba(var(--isticanje2), 0.05) 100%)',
                border: '2px solid rgba(var(--isticanje), 0.2)',
                marginBottom: '1.5rem'
              }}>
                <div style={{ marginBottom: '1rem' }}>
                  <h2 style={{
                    margin: '0 0 0.5rem 0',
                    color: 'rgb(var(--isticanje))',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <Icon icon="solar:hand-stars-broken" style={{ fontSize: '1.5rem' }} />
                    Brze akcije
                  </h2>
                  <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>
                    Što želite napraviti?
                  </p>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  justifyContent: 'flex-start',
                  alignItems: 'stretch'
                }}>
                  <button
                    className="action-btn spremiBtn"
                    onClick={() => navigate('/raspored')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: '1 1 140px',
                      gap: '0.5rem',
                      padding: '1.25rem',
                      fontSize: '1rem',
                      minHeight: '100px',
                      justifyContent: 'center'
                    }}
                  >
                    <Icon icon="solar:calendar-mark-broken" style={{ fontSize: '2rem' }} />
                    <span>Provjeri raspored</span>
                  </button>

                  <button
                    className="action-btn spremiBtn"
                    onClick={() => navigate('/chat')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: '1 1 140px',
                      gap: '0.5rem',
                      padding: '1.25rem',
                      fontSize: '1rem',
                      minHeight: '100px',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                  >
                    <Icon icon="solar:chat-line-broken" style={{ fontSize: '2rem' }} />
                    <span>Pošalji poruku</span>
                    {unreadChatsCount > 0 && (
                      <span style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        background: 'rgb(var(--danger))',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {unreadChatsCount}
                      </span>
                    )}
                  </button>

                  <button
                    className="action-btn spremiBtn"
                    onClick={() => navigate('/racuni')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: '1 1 140px',
                      gap: '0.5rem',
                      padding: '1.25rem',
                      fontSize: '1rem',
                      minHeight: '100px',
                      justifyContent: 'center'
                    }}
                  >
                    <Icon icon="solar:bill-list-broken" style={{ fontSize: '2rem' }} />
                    <span>Vidi račune</span>
                  </button>

                  <button
                    className="action-btn spremiBtn"
                    onClick={() => navigate('/profil')}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: '1 1 140px',
                      gap: '0.5rem',
                      padding: '1.25rem',
                      fontSize: '1rem',
                      minHeight: '100px',
                      justifyContent: 'center'
                    }}
                  >
                    <Icon icon="solar:user-circle-broken" style={{ fontSize: '2rem' }} />
                    <span>Uredi profil</span>
                  </button>

                  {user?.isMentor && (
                    <button
                      className="action-btn spremiBtn"
                      onClick={() => navigate('/admin')}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flex: '1 1 140px',
                        gap: '0.5rem',
                        padding: '1.25rem',
                        fontSize: '1rem',
                        minHeight: '100px',
                        justifyContent: 'center',
                        background: 'rgb(var(--isticanje))',
                        color: 'white'
                      }}
                    >
                      <Icon icon="solar:settings-broken" style={{ fontSize: '2rem' }} />
                      <span>Administracija</span>
                    </button>
                  )}

                  {(user?.isMentor || user?.pohadjaTeoriju) && activePolls.length > 0 && (
                    <button
                      className="action-btn abEdit"
                      onClick={() => setActiveTab('polls')}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flex: '1 1 140px',
                        gap: '0.5rem',
                        padding: '1.25rem',
                        fontSize: '1rem',
                        minHeight: '100px',
                        justifyContent: 'center',
                        position: 'relative'
                      }}
                    >
                      <Icon icon="solar:clipboard-list-broken" style={{ fontSize: '2rem' }} />
                      <span>Aktivne ankete</span>
                      <span style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        background: 'rgb(var(--isticanje))',
                        color: 'white',
                        borderRadius: '50%',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {activePolls.length}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'polls' ? (
              <div className="karticaZadatka polls posts">
                {!user.isMentor && !user.pohadjaTeoriju ? (
                  <div className="no-access-message">
                    <Icon icon="solar:lock-broken" style={{ fontSize: '2rem', marginBottom: '1rem' }} />
                    <p>Samo učenici koji pohađaju teorijsku nastavu mogu vidjeti ankete.</p>
                  </div>
                ) : activePolls.length > 0 ? (
                  activePolls.map(poll => (
                    <div key={poll.id} className="poll-card">
                      <div className="poll-header">
                        <h3>{poll.question}</h3>
                        {isExpired(poll.endDate) && (
                          <span className="expired-badge">Isteklo</span>
                        )}
                        {user.isMentor && poll.creatorId === user.id && (
                          <button
                            className="action-btn abDelete"
                            onClick={() => handleDeletePoll(poll.id)}
                            aria-label="Delete poll"
                          >
                            <Icon icon="solar:trash-bin-trash-broken" />
                          </button>
                        )}
                      </div>
                      <div className="poll-meta">
                        <span>Završava: {moment(poll.endDate).format('DD.MM.YYYY. HH:mm')}</span>
                        <span>{poll.responses?.length || 0} odgovora</span>
                      </div>
                      <div className="poll-options">
                        <button
                          className={`poll-option-btn ${poll.responses?.find(r => r.userId === user.id)?.response === 'da' ? 'selected' : ''}`}
                          onClick={() => handleVote(poll.id, 'da')}
                          disabled={isExpired(poll.endDate) || getRemainingVoteTime(poll.responses, user.id) === 0}
                          style={poll.responses?.length > 0 ? {
                            '--percentage-width': `${calculatePercentage(poll.responses, 'da')}%`
                          } : {}}
                        >
                          <span>Da</span>
                          {poll.responses?.find(r => r.userId === user.id) && (
                            <span className="poll-percentage">
                              {calculatePercentage(poll.responses, 'da')}%
                            </span>
                          )}
                        </button>
                        <button
                          className={`poll-option-btn ${poll.responses?.find(r => r.userId === user.id)?.response === 'ne' ? 'selected' : ''}`}
                          onClick={() => handleVote(poll.id, 'ne')}
                          disabled={isExpired(poll.endDate) || getRemainingVoteTime(poll.responses, user.id) === 0}
                          style={poll.responses?.length > 0 ? {
                            '--percentage-width': `${calculatePercentage(poll.responses, 'ne')}%`
                          } : {}}
                        >
                          <span>Ne</span>
                          {poll.responses?.find(r => r.userId === user.id) && (
                            <span className="poll-percentage">
                              {calculatePercentage(poll.responses, 'ne')}%
                            </span>
                          )}
                        </button>
                      </div>
                      {poll.responses?.find(r => r.userId === user.id) && getRemainingVoteTime(poll.responses, user.id) > 0 && (
                        <div className="poll-vote-timer">
                          Možete promijeniti svoj glas još {getRemainingVoteTime(poll.responses, user.id)} {getMinutesText(getRemainingVoteTime(poll.responses, user.id))}
                        </div>
                      )}
                      {user.isMentor && (
                        <button
                          className="poll-stats-btn"
                          onClick={() => setSelectedPoll(poll)}
                          aria-label="View poll statistics"
                        >
                          <span className="iconify" data-icon="mdi:chart-box"></span>
                          Statistika odgovora
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="no-polls">Trenutno nema aktivnih anketa.</p>
                )}
              </div>
            ) : activeTab === 'search' ? (
              <div className="karticaZadatka">
                <input
                  className="input-login-signup "
                  type="text"
                  placeholder="Pretraži korisnike..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {searchResults && searchResults.length > 0 && (
                  searchResults.map((result) => (
                    <div key={result.id} className="search-result-item">
                      <div>
                        <div>
                          <p>{result.ime} {result.prezime}</p>
                          <p className='txt-min2'>{result.email}</p>
                        </div>
                        <p className='txt-min'>{result.school?.name} | {result.uloga}</p>
                      </div>
                      <div>
                        <button
                          className="action-btn"
                          onClick={() => {
                            setSelectedUserId(result.id);
                            setShowUserProfile(true);
                          }}
                          style={{ padding: '0.3rem 0.8rem' }}
                        >
                          <Icon icon="solar:user-id-broken" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="karticaZadatka posts">
                {Array.isArray(posts) && posts.length > 0 ? (
                  posts
                    .filter(post => activeTab === 'my-posts' ? post.author.id === user.id : true)
                    .map((post) => (
                    <div key={post.id} className="post-card">
                      <div className="post-header">
                        <h3>{post.title}</h3>
                        {user?.id === post.author.id && (
                          <div className="post-actions">
                            <button
                              className="action-btn abEdit"
                              onClick={() => handleEditPost(post)}
                            >
                              <Icon icon="solar:pen-broken" />
                            </button>
                            <button
                              className="action-btn abDelete"
                              onClick={() => handleDeletePost(post.id)}
                            >
                              <Icon icon="solar:trash-bin-trash-broken" />
                            </button>
                            <button
                            className="action-btn abExpand"
                            onClick={() => handleOpenPost(post)}
                            title="Prikaži detalje"
                          >
                            <Icon icon="solar:eye-broken" />
                          </button>
                          </div>
                        )}
                      </div>
                      <div
                        className={`post-content ${expandedPosts.has(post.id) ? 'expanded' : ''}`}
                        dangerouslySetInnerHTML={{ __html: post.content }}
                      />
                      <button
                        className="show-more-btn"
                        onClick={() => togglePostExpansion(post.id)}
                      >
                        {expandedPosts.has(post.id) ? 'Prikaži manje' : 'Prikaži više'}
                      </button>
                      <div className="post-footer">
                        <span>
                          {formatDate(post.createdAt)}
                        </span>
                        <span>{post.author.ime} {post.author.prezime}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-posts">
                    {activeTab === 'my-posts'
                      ? 'Nemate objavljenih objava.'
                      : 'Nema objava za prikaz.'}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {showPostEditor && (
        <PostEditor
          onClose={() => setShowPostEditor(false)}
          onSave={handlePostSaved}
        />
      )}

      {showPostEditorOpened && currentPost && (
        <PostEditorOpened
          post={currentPost}
          onClose={() => {
            setShowPostEditorOpened(false);
            setCurrentPost(null);
          }}
          onSave={handlePostSaved}
        />
      )}

      {showPostDetails && detailedPost && (
        <Modal
          isOpen={true}
          onClose={handleClosePostDetails}
          title={
            <>
              <Icon icon="solar:document-text-broken" />
              {detailedPost.title}
            </>
          }
          maxWidth="900px"
          isFormModal={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Post metadata */}
            <div style={{
              display: 'flex',
              gap: '1.5rem',
              padding: '0.75rem 1rem',
              background: 'rgba(var(--isticanje2), 0.1)',
              borderRadius: 'var(--radius)',
              fontSize: '0.9rem',
              flexWrap: 'wrap'
            }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon icon="solar:user-id-broken" style={{ color: 'rgb(var(--isticanje))' }} />
                <strong>{detailedPost.author?.ime} {detailedPost.author?.prezime}</strong>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Icon icon="solar:calendar-broken" style={{ color: 'rgb(var(--isticanje))' }} />
                {formatDate(detailedPost.createdAt)}
              </span>
            </div>

            {/* Post content */}
            <div
              className="post-content expanded"
              style={{
                padding: '1rem',
                background: 'rgba(var(--isticanje2), 0.05)',
                borderRadius: 'var(--radius)',
                border: '1px solid rgba(var(--isticanje2), 0.2)'
              }}
              dangerouslySetInnerHTML={{ __html: detailedPost.content }}
            />
          </div>
        </Modal>
      )}

      {showUserProfile && selectedUserId && (
        <UserProfile
          userId={selectedUserId}
          loggedInUser={user}
          onClose={() => {
            setShowUserProfile(false);
            setSelectedUserId(null);
          }}
        />
      )}

      {showPollForm && (
        <Modal
          isOpen={true}
          onClose={() => setShowPollForm(false)}
          title={
            <>
              <Icon icon="solar:chart-2-broken" />
              Nova anketa
            </>
          }
          maxWidth="700px"
          isFormModal={true}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Question */}
            <div>
              <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                Pitanje ankete <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                className="input-login-signup"
                placeholder="Unesite pitanje ankete"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            {/* Options */}
            <div>
              <label style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                Opcije odgovora <span style={{ color: 'red' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {pollOptions.map((option, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="input-login-signup"
                      placeholder={`Opcija ${index + 1}`}
                      value={option}
                      onChange={(e) => updatePollOption(index, e.target.value)}
                      style={{ flex: 1 }}
                    />
                    {pollOptions.length > 2 && (
                      <button
                        className="action-btn abDelete"
                        onClick={() => removePollOption(index)}
                        style={{ padding: '0.5rem', minWidth: 'auto' }}
                      >
                        <Icon icon="solar:trash-bin-trash-broken" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="action-btn abEdit"
                  onClick={addPollOption}
                  style={{ alignSelf: 'flex-start' }}
                >
                  <Icon icon="solar:add-circle-broken" /> Dodaj opciju
                </button>
              </div>
            </div>

            {/* End Date */}
            <div>
              <label style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'block' }}>
                Završava <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="datetime-local"
                className="input-login-signup"
                value={pollEndDate}
                onChange={(e) => setPollEndDate(e.target.value)}
                min={moment().format('YYYY-MM-DDTHH:mm')}
                style={{ width: '100%' }}
              />
            </div>

            {/* Action Buttons */}
            <div className="div-radio">
              <button
                className="gumb action-btn zatvoriBtn"
                onClick={() => setShowPollForm(false)}
                type="button"
              >
                <Icon icon="solar:close-circle-broken" /> Odustani
              </button>
              <button
                className="gumb action-btn spremiBtn"
                onClick={handleCreatePoll}
                type="button"
              >
                <Icon icon="solar:add-square-broken" /> Kreiraj anketu
              </button>
            </div>
          </div>
        </Modal>
      )}

      {selectedPoll && user.isMentor && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedPoll(null)}
          title={
            <>
              <Icon icon="solar:chart-square-broken" />
              Statistika ankete
            </>
          }
          maxWidth="800px"
          isFormModal={false}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Question */}
            <div style={{
              background: 'rgba(var(--isticanje), 0.05)',
              padding: '1rem',
              borderRadius: 'var(--radius)',
              border: '1px solid rgba(var(--isticanje), 0.2)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{selectedPoll.question}</h3>
            </div>

            {/* Summary Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '1rem'
            }}>
              <div style={{
                background: 'rgba(var(--isticanje2), 0.1)',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'rgb(var(--isticanje))' }}>
                  {selectedPoll.responses?.length || 0}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Ukupno odgovora</div>
              </div>
              <div style={{
                background: 'rgba(40, 167, 69, 0.1)',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#28a745' }}>
                  {calculatePercentage(selectedPoll.responses, 'da')}%
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Da</div>
              </div>
              <div style={{
                background: 'rgba(220, 53, 69, 0.1)',
                padding: '1rem',
                borderRadius: 'var(--radius)',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc3545' }}>
                  {calculatePercentage(selectedPoll.responses, 'ne')}%
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>Ne</div>
              </div>
            </div>

            {/* Responses List */}
            {selectedPoll.responses && selectedPoll.responses.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '1rem', fontWeight: 600 }}>
                  Svi odgovori ({selectedPoll.responses.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                  {selectedPoll.responses.map((response, index) => (
                    <div
                      key={index}
                      style={{
                        background: response.response === 'da' ? 'rgba(40, 167, 69, 0.05)' : 'rgba(220, 53, 69, 0.05)',
                        border: `1px solid ${response.response === 'da' ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)'}`,
                        padding: '1rem',
                        borderRadius: 'var(--radius)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                          {response.ime} {response.prezime}
                        </div>
                        <div style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                          <Icon icon="solar:calendar-broken" style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                          {moment(response.timestamp).format('DD.MM.YYYY. HH:mm')}
                        </div>
                      </div>
                      <div style={{
                        padding: '0.5rem 1rem',
                        borderRadius: 'var(--radius)',
                        background: response.response === 'da' ? '#28a745' : '#dc3545',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.9rem'
                      }}>
                        {response.response.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default Naslovna;