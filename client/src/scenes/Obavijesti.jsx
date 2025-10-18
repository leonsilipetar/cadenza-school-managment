import React, { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import Navigacija from './navigacija';
import NavTop from './nav-top';
import ApiConfig from '../components/apiConfig.js';
import LoadingShell from '../components/LoadingShell';
import { showNotification } from '../components/Notifikacija';
import { useNotifications as useNotificationsContext } from '../context/NotificationContext';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../hooks/useNotifications';
import './Obavijesti.css';

const Obavijesti = ({ user, unreadChatsCount }) => {
  // REACT QUERY: Use hook for notifications - automatic updates!
  const { data: notifications = [], isLoading: loading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('all');
  const { markNotificationsAsRead } = useNotificationsContext();

  // Filter options
  const filters = [
    { id: 'all', label: 'Sve', icon: 'solar:bell-broken' },
    { id: 'post', label: 'Objave', icon: 'solar:document-text-broken' },
    { id: 'schedule', label: 'Raspored', icon: 'solar:calendar-broken' },
    { id: 'pending_user', label: 'Zahtjevi', icon: 'solar:user-plus-broken' },
    { id: 'message', label: 'Poruke', icon: 'solar:chat-line-broken' },
    { id: 'invoice', label: 'Računi', icon: 'solar:bill-list-broken' }
  ];

  // REACT QUERY: No more manual fetching! Notifications load automatically
  // Removed fetchNotifications and useEffect - React Query handles it

  // Handle notification click
  const handleNotificationClick = async (notification) => {
    if (!notification || !notification.id) {
      console.error('Invalid notification:', notification);
      return;
    }

    try {
      // REACT QUERY: Use mutation to mark as read
      await markRead.mutateAsync(notification.id);

      // Navigate based on notification type
      switch (notification.type) {
        case 'post':
          navigate('/user');
          break;
        case 'schedule':
          navigate('/raspored');
          break;
        case 'pending_user':
          navigate('/pending-users');
          break;
        case 'message':
        case 'group_message':
          navigate('/chat');
          break;
        case 'invoice':
          // Navigate to appropriate invoice page based on user role
          if (user?.isAdmin) {
            navigate('/racuni-admin');
          } else {
            navigate('/racuni');
          }
          break;
        case 'document':
          navigate('/dokumenti');
          break;
        case 'group':
          navigate('/chat');
          break;
        case 'poll':
          navigate('/user');
          break;
        default:
          // For any other notification types, stay on notifications page
          break;
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      showNotification('error', 'Greška pri označavanju obavijesti kao pročitane');
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      // Use context method (which calls API) or directly call mutation
      await markNotificationsAsRead();
      // REACT QUERY: Trigger refetch with mutation
      await markAllRead.mutateAsync();
      showNotification('success', 'Sve obavijesti označene kao pročitane');
    } catch (error) {
      console.error('Error marking all as read:', error);
      showNotification('error', 'Greška pri označavanju obavijesti');
    }
  };

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    if (!Array.isArray(notifications)) {
      console.warn('Notifications is not an array:', notifications);
      return [];
    }
    return notifications.filter(notification => {
      if (activeFilter === 'all') return true;
      // Handle message filter to include both message and group_message types
      if (activeFilter === 'message') {
        return notification.type === 'message' || notification.type === 'group_message';
      }
      return notification.type === activeFilter;
    });
  }, [notifications, activeFilter]);

  // Format date
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString('hr-HR', options);
  };

  if (loading) return <LoadingShell />;

  return (
    <>
      <Navigacija user={user} otvoreno="obavijesti" unreadChatsCount={unreadChatsCount}/>
      <NavTop user={user} naslov="Obavijesti" />

      <div className='main'>
        <div className="karticaZadatka">
          <div className="notification-filters">
            {filters.map(filter => (
              <button
                key={filter.id}
                className={`filter-btn ${activeFilter === filter.id ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter.id)}
              >
                <Icon icon={filter.icon} />
                {filter.label}
              </button>
            ))}

            <button
              className="gumb action-btn saveBtn"
              onClick={handleMarkAllAsRead}
            >
              <Icon icon="solar:check-read-broken" />
              Označi sve kao pročitano
            </button>
          </div>

          <div className="notifications-list">
            {filteredNotifications.length > 0 ? (
              filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    <Icon
                      icon={
                        notification.type === 'post' ? 'solar:document-text-broken' :
                        notification.type === 'schedule' ? 'solar:calendar-broken' :
                        notification.type === 'pending_user' ? 'solar:user-plus-broken' :
                        notification.type === 'message' || notification.type === 'group_message' ? 'solar:chat-line-broken' :
                        notification.type === 'invoice' ? 'solar:bill-list-broken' :
                        notification.type === 'document' ? 'solar:document-broken' :
                        notification.type === 'group' ? 'solar:users-group-rounded-broken' :
                        notification.type === 'poll' ? 'solar:list-check-broken' :
                        'solar:bell-broken'
                      }
                    />
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">{formatDate(notification.createdAt)}</div>
                  </div>
                  {!notification.read && <div className="unread-indicator"></div>}
                </div>
              ))
            ) : (
              <div className="no-notifications">
                <Icon icon="solar:bell-off-broken" />
                <p>Nema obavijesti</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Obavijesti;