import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useNotifications } from '../../context/NotificationContext';
import ApiConfig from '../../components/apiConfig';
import { fetchProfileImageOrNull, toDataUrl } from '../../utils/profileImage';

const Navigacija = ({ user, chat, otvoreno, unreadChatsCount = 0 }) => {
  const [activeItem, setActiveItem] = useState(otvoreno);
  const { notifications } = useNotifications();
  const location = useLocation();
  const [navProfileUrl, setNavProfileUrl] = useState(null);

  // We don't need to check for unpaid invoices here since it's already in the user object
  // and will update automatically when the user object updates

  const handleItemClick = (item) => {
    if (item === activeItem) return;
    setActiveItem(item);
  };

  // Check for unread items
  const hasUnreadNotifications = notifications.length > 0;

  useEffect(() => {
    let isMounted = true;
    const loadProfileImage = async () => {
      if (!user?.id) {
        if (isMounted) setNavProfileUrl(null);
        return;
      }
      try {
        const pic = await fetchProfileImageOrNull(user.id);
        if (isMounted) setNavProfileUrl(toDataUrl(pic));
      } catch (_) {
        if (isMounted) setNavProfileUrl(null);
      }
    };
    loadProfileImage();
    return () => { isMounted = false; };
  }, [user?.id]);

  const navItems = [
    {
      id: 'naslovna',
      path: '/user',
      icon: 'solar:music-notes-broken',
      label: 'Naslovna',
      hasUnread: false
    },
    {
      id: 'raspored',
      path: '/raspored',
      icon: 'solar:calendar-broken',
      label: 'Raspored',
      hasUnread: false
    },
    {
      id: 'obavijesti',
      path: '/obavijesti',
      icon: 'solar:bell-broken',
      label: 'Obavijesti',
      hasUnread: hasUnreadNotifications
    },
    {
      id: 'chat',
      path: '/chat',
      icon: 'solar:chat-line-broken',
      label: 'Chat',
      hasUnread: unreadChatsCount > 0
    },
    {
      id: 'racuni',
      path: '/racuni',
      icon: 'solar:bill-list-broken',
      label: 'Računi',
      hasUnread: user?.isStudent && user.hasUnpaidInvoice
    },
    {
      id: 'dokumenti',
      path: '/dokumenti',
      icon: 'solar:link-circle-broken',
      label: 'Poveznice',
      hasUnread: false
    },
    {
      id: 'profil',
      path: '/profil',
      icon: 'solar:user-circle-broken',
      label: 'Profil',
      hasUnread: false,
      renderIcon: () => (
        navProfileUrl ? (
          <img
            src={navProfileUrl}
            alt="Profil"
            className="nav-profile-avatar"
            style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <Icon className="icon" icon="solar:user-circle-broken" aria-hidden="true" />
        )
      )
    }
  ];

  return (
    <header className={chat ? 'chat-active' : ''}>
      <nav role="navigation" aria-label="Glavna navigacija">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={activeItem === item.id ? 'otvoreno' : ''}
            onClick={() => handleItemClick(item.id)}
          >
            <Link
              className="link"
              to={item.path}
              aria-label={`${item.label}${item.hasUnread ? ' (ima nove poruke)' : ''}`}
              aria-current={activeItem === item.id ? 'page' : undefined}
            >
              {item.renderIcon ? item.renderIcon() : (
                <Icon className="icon" icon={item.icon} aria-hidden="true" />
              )}
              {item.hasUnread && (
                <div
                  className="dot"
                  style={{ position: 'absolute', top: '-2px', right: '-2px' }}
                  aria-label="Nove poruke"
                ></div>
              )}
            </Link>
          </div>
        ))}
      </nav>
    </header>
  );
};

export default Navigacija;
