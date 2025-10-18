import React, { useEffect, useState, Suspense, useCallback, useMemo } from 'react';
import { useUnreadCount, useInvalidateChats } from './hooks/useChats';
import { useActivePolls } from './hooks/usePolls';
import { useDispatch, useSelector } from 'react-redux';
import { Routes, Route, useNavigate, Navigate, Outlet } from 'react-router-dom';
import { authActions } from './store/index.js';
import ApiConfig from './components/apiConfig.js';
import Login from './components/Login.jsx';
import Welcome from './components/Welcome.jsx';
import SignUpForm from './scenes/SignUpForm.jsx';
import Naslovna from './scenes/naslovna/Naslovna.jsx';
import Profil from './scenes/Profile.jsx';
// Route-level code splitting for heavy scenes
const Chat = React.lazy(() => import('./scenes/Chat.jsx'));
const Racuni = React.lazy(() => import('./scenes/Racuni.jsx'));
const Raspored = React.lazy(() => import('./scenes/Raspored.jsx'));
const Admin = React.lazy(() => import('./scenes/administracija/Admin.jsx'));
const Korisnici = React.lazy(() => import('./scenes/administracija/Korisnici.jsx'));
const RacuniAdmin = React.lazy(() => import('./scenes/administracija/RacuniAdmin.jsx'));
const Mentori = React.lazy(() => import('./scenes/administracija/Mentori.jsx'));
const Classrooms = React.lazy(() => import('./scenes/administracija/Classroom.jsx'));
const Delete = React.lazy(() => import('./scenes/administracija/Delete.jsx'));
const Obavijesti = React.lazy(() => import('./scenes/Obavijesti.jsx'));
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { io } from 'socket.io-client';
const Programs = React.lazy(() => import('./scenes/administracija/Programs.jsx'));
const MentorSelfService = React.lazy(() => import('./scenes/mentori/MentorSelfService.jsx'));
const StudentSelfService = React.lazy(() => import('./scenes/ucenici/StudentSelfService.jsx'));
import { initializeApp } from 'firebase/app'; // Correct import
import { getToken, onMessage } from 'firebase/messaging'; // Correct imports
import Error from './components/Error.jsx';
import LoadingShell from './components/LoadingShell.jsx';
import Notifikacija from './components/Notifikacija';
import { ToastContainer, toast } from 'react-toastify';
import { messaging } from './firebase-config';
import 'react-toastify/dist/ReactToastify.css';
import About from './scenes/About';
import CookieConsent from './components/CookieConsent';
import TermsAndWelcome from './components/TermsAndWelcome';
import { NotificationProvider } from './context/NotificationContext';
import InstallPWA from './components/InstallPWA';
import ReportProblem from './scenes/ReportProblem';
// Analytics import removed for performance optimization
import { getMessagingInstance } from './firebase-config';
import PollIndicator from './components/PollIndicator';
const PendingUsers = React.lazy(() => import('./scenes/administracija/PendingUsers.jsx'));
import SpecialOccasionPopup from './components/SpecialOccasionPopup';
import ResetPassword from './components/ResetPassword.jsx';
const Documents = React.lazy(() => import('./scenes/Documents.jsx'));
import EnrollmentConfirm from './scenes/EnrollmentConfirm.jsx';
const EnrollmentDashboard = React.lazy(() => import('./scenes/administracija/EnrollmentDashboard.jsx'));
import MentorSignUpForm from './scenes/MentorSignUpForm.jsx';
import NetworkStatus from './components/NetworkStatus.jsx';


// Initialize socket outside component
let socket = io(ApiConfig.socketUrl, {
  withCredentials: true,
  transports: ['websocket', 'polling'],
  autoConnect: false // Don't connect automatically
});

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCulVokylkRYHA6wXnQkcEbO9b0pgON00w",
  authDomain: "cadenza-d5776.firebaseapp.com",
  projectId: "cadenza-d5776",
  storageBucket: "cadenza-d5776.appspot.com",
  messagingSenderId: "975125523948",
  appId: "1:975125523948:web:86c084bdc5e3d7ae30a4c9",
  measurementId: "G-DZT5CQ2WL3"
};

const app = initializeApp(firebaseConfig);

// Error boundary implementation
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Process error details first
        const isCritical = this.isCriticalError(error);
        const errorDetails = {
            componentStack: errorInfo?.componentStack,
            type: 'React Component Error',
            time: new Date().toISOString(),
            props: this.props.componentProps || {}
        };

        // Then navigate to error page with processed data
        this.props.navigate('/error', {
            state: {
                error: error?.message || 'Component Error',
                stack: error?.stack,
                details: errorDetails,
                previousPath: window.location.pathname,
                isCritical
            }
        });
    }

    isCriticalError(error) {
        const criticalErrors = [
            'token expired',
            'unauthorized',
            'authentication failed'
        ];

        return criticalErrors.some(criticalError =>
            error.message?.toLowerCase().includes(criticalError.toLowerCase())
        );
    }

    render() {
        if (this.state.hasError) {
            return null; // Return null since we're navigating to error page
        }
        return this.props.children;
    }
}

const App = () => {
    const month = getCurrentSchoolYear();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const isLoggedIn = useSelector(state => state.isLoggedIn);
    const user = useSelector(state => state.user);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState(null);
    // unreadChatsCount moved to React Query hook below (line ~496)
    // activePolls moved to React Query hook below (useActivePolls)
    const [showPollIndicator, setShowPollIndicator] = useState(true);
    const [showSpecialPopup, setShowSpecialPopup] = useState(false);
    const [specialPopupData, setSpecialPopupData] = useState({
        title: '',
        message: '',
        image: ''
    });
    const [enrollmentChecked, setEnrollmentChecked] = useState(false);
    const [needsEnrollment, setNeedsEnrollment] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [networkNotification, setNetworkNotification] = useState(null);
    const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

    // Handle SW update notification and redirect after update
    useEffect(() => {
        const handleSWUpdate = (event) => {
            setSwUpdateAvailable(true);
            toast.info('Nova verzija aplikacije je dostupna. Aplikacija će se uskoro ažurirati...', {
                position: "top-center",
                autoClose: 3000,
                hideProgressBar: false,
                closeOnClick: false,
                pauseOnHover: false,
                draggable: false,
                theme: "light",
                style: {
                    background: 'var(--iznad)',
                    color: 'var(--tekst)',
                }
            });
        };

        window.addEventListener('swUpdateAvailable', handleSWUpdate);

        // Check if we just reloaded after SW update
        const redirectAfterUpdate = sessionStorage.getItem('redirectAfterSWUpdate');
        if (redirectAfterUpdate) {
            sessionStorage.removeItem('redirectAfterSWUpdate');
            // Clear API cache after SW update
            ApiConfig.invalidateCache();
            // If we're on error page after update, redirect to safe route
            if (window.location.pathname === '/error') {
                if (isLoggedIn) {
                    navigate('/user', { replace: true });
                } else {
                    navigate('/login', { replace: true });
                }
            }
        }

        return () => {
            window.removeEventListener('swUpdateAvailable', handleSWUpdate);
        };
    }, [isLoggedIn, navigate]);

    // Theme detection effect
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const savedColors = {
            isticanje: localStorage.getItem('isticanje'),
            isticanje2: localStorage.getItem('isticanje2'),
            isticanje3: localStorage.getItem('isticanje3'),
            pozadina: localStorage.getItem('pozadina')
        };

        if (savedTheme) {
            document.body.className = savedTheme;
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const initialTheme = prefersDark ? 'dark' : 'light';
            document.body.className = initialTheme;
            localStorage.setItem('theme', initialTheme);
        }

        // Apply saved colors if they exist
        if (savedColors.isticanje) {
            document.documentElement.style.setProperty('--isticanje', savedColors.isticanje);
            document.documentElement.style.setProperty('--isticanje2', savedColors.isticanje2);
            document.documentElement.style.setProperty('--isticanje3', savedColors.isticanje3);
            document.documentElement.style.setProperty('--pozadina', savedColors.pozadina);
        }

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleThemeChange = (e) => {
            if (!localStorage.getItem('theme')) { // Only auto-switch if user hasn't manually set a theme
                const newTheme = e.matches ? 'dark' : 'light';
                document.body.className = newTheme;
                localStorage.setItem('theme', newTheme);
            }
        };

        mediaQuery.addEventListener('change', handleThemeChange);
        return () => mediaQuery.removeEventListener('change', handleThemeChange);
    }, []);

    // Network status monitoring
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
        };

        const handleOffline = () => {
            setIsOnline(false);
        };

        // Check initial network status
        if (!navigator.onLine) {
            handleOffline();
        }

        // Add periodic network check for better reliability
        const checkNetworkStatus = () => {
            const currentStatus = navigator.onLine;
            if (currentStatus !== isOnline) {
                if (currentStatus) {
                    handleOnline();
                } else {
                    handleOffline();
                }
            }
        };

        // Check every 5 seconds
        const networkCheckInterval = setInterval(checkNetworkStatus, 5000);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(networkCheckInterval);
        };
    }, [isOnline]);

    // Global error handler for uncaught promises
    useEffect(() => {
        const handleUnhandledRejection = (event) => {

            const isCriticalError = criticalErrors.some(criticalError =>
                event.reason?.message?.toLowerCase().includes(criticalError.toLowerCase())
            );

            navigate('/error', {
                state: {
                    error: event.reason?.message || 'An unexpected error occurred',
                    stack: event.reason?.stack,
                    details: {
                        type: 'Unhandled Promise Rejection',
                        additionalInfo: event.reason
                    },
                    previousPath: window.location.pathname,
                    isCritical: isCriticalError
                }
            });
            event.preventDefault();
        };

        const criticalErrors = [
            'Token expired',
            'Invalid token',
            'Unauthorized',
            'Authentication failed',
            'Token validation failed'
        ];

        window.addEventListener('unhandledrejection', handleUnhandledRejection);
        return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    }, [navigate]);

    useEffect(() => {
        const initializeAppFunction = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');

                if (!token) {
                    dispatch(authActions.logout());
                    setLoading(false);
                    return;
                }

                // Check for first login or version mismatch
                const appVersion = '1.0.1'; // SECURITY UPDATE: Fixed cache cross-user leak
                const lastAppVersion = localStorage.getItem('appVersion');
                const lastLoginTime = localStorage.getItem('lastLoginTime');
                const now = Date.now();
                
                // Clear cache if:
                // 1. First time user (no lastLoginTime)
                // 2. Version mismatch (SECURITY: clears old insecure cache)
                // 3. Haven't logged in for more than 7 days
                if (!lastLoginTime || 
                    lastAppVersion !== appVersion || 
                    (now - parseInt(lastLoginTime)) > 7 * 24 * 60 * 60 * 1000) {
                    ApiConfig.invalidateCache();
                    localStorage.setItem('appVersion', appVersion);
                }
                
                localStorage.setItem('lastLoginTime', now.toString());

                // Analytics removed for performance optimization

                // Verify token and get user data with caching
                const response = await ApiConfig.cachedApi.get('/api/user');

                if (response?.user) {
                    dispatch(authActions.updateUser(response.user));

                    // Handle FCM token if needed
                    try {
                        const messagingInstance = getMessagingInstance();
                        if (messagingInstance) {
                            const fcmToken = await getToken(messagingInstance, {
                                vapidKey: "BB3Wbtcy5tB6mujuv50L9AVzlhE7kgq6pACMtQ-UZjWeY9MCMPHaFqpiCf6Iz5Tkk35YsLfOPTg4tGprkZRAGsU"
                            });
                            // Only update if token is different and not null
                            if (fcmToken && fcmToken !== response.user.fcmToken) {
                                await ApiConfig.api.post('/api/users/fcm-token',
                                    { fcmToken },
                                    {
                                        headers: {
                                            'Authorization': `Bearer ${token}`
                                        }
                                    }
                                );
                            } else {
                            }
                        } else {
                        }
                    } catch (fcmError) {
                    }
                } else {
                    dispatch(authActions.logout());
                    navigate('/login');
                }
            } catch (error) {
                // Clear cache on critical authentication errors
                const isCriticalError = error?.message?.toLowerCase().includes('token') ||
                                       error?.message?.toLowerCase().includes('unauthorized') ||
                                       error?.message?.toLowerCase().includes('authentication');
                if (isCriticalError) {
                    ApiConfig.invalidateCache();
                }
                dispatch(authActions.logout());
                navigate('/login');
            } finally {
                setLoading(false);
            }
        };

        initializeAppFunction();
    }, [dispatch, navigate]);

    // Add cache invalidation on logout
    useEffect(() => {
        if (!isLoggedIn) {
            ApiConfig.invalidateCache();
        }
    }, [isLoggedIn]);

    useEffect(() => {
        if (!isLoggedIn) return;
        const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
        const idleId = idle(async () => {
            try {
                if (!('Notification' in window)) {
                    toast.info('Vaš preglednik ne podržava push notifikacije. Nećete primati obavijesti o novim porukama.', {
                        position: "top-right",
                        autoClose: 8000,
                        hideProgressBar: false,
                        closeOnClick: true,
                        pauseOnHover: true,
                        draggable: true,
                        progress: undefined,
                        theme: "light",
                        style: {
                            background: 'var(--iznad)',
                            color: 'var(--tekst)',
                        }
                    });
                    return;
                }

                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    try {
                        const messagingInstance = getMessagingInstance();
                        if (messagingInstance) {
                            const fcmToken = await getToken(messagingInstance, {
                                vapidKey: "BB3Wbtcy5tB6mujuv50L9AVzlhE7kgq6pACMtQ-UZjWeY9MCMPHaFqpiCf6Iz5Tkk35YsLfOPTg4tGprkZRAGsU"
                            });
                            if (fcmToken) {
                                await ApiConfig.api.post('/api/users/fcm-token', { fcmToken });
                            }
                        } else {
                            toast.info('Vaš preglednik ne podržava push notifikacije. Nećete primati obavijesti o novim porukama.', {
                                position: "top-right",
                                autoClose: 8000,
                                hideProgressBar: false,
                                closeOnClick: true,
                                pauseOnHover: true,
                                draggable: true,
                                progress: undefined,
                                theme: "light",
                                style: {
                                    background: 'var(--iznad)',
                                    color: 'var(--tekst)',
                                }
                            });
                        }
                    } catch (tokenError) {}
                }
            } catch (error) {}
        });
        return () => {
            if (window.cancelIdleCallback) {
                window.cancelIdleCallback(idleId);
            }
        };
    }, [isLoggedIn]);

    // Socket connection effect
    useEffect(() => {

        if (isLoggedIn && user?.id) {
            // Configure socket auth
            socket.auth = { userId: user.id };

            // Connect socket if not connected
            if (!socket.connected) {
                socket.connect();
            }

            // Socket event listeners
            socket.on('connect', () => {
            });

            socket.on('connect_error', (error) => {
            });

            // Clean up on unmount
            return () => {
                socket.off('connect');
                socket.off('connect_error');
                if (socket.connected) {
                    socket.disconnect();
                }
            };
        } else if (!isLoggedIn && socket.connected) {
            socket.disconnect();
        }
    }, [isLoggedIn, user]);

    // REACT QUERY: Use hooks for chat data - automatic updates!
    const unreadChatsCount = useUnreadCount(user);
    const invalidateChats = useInvalidateChats();
    
    // REACT QUERY: Use hook for active polls - automatic polling every 30s!
    const { data: activePolls = [] } = useActivePolls();

    // Update the socket effect to handle unread count updates and notifications
    // OPTIMIZED: No more redundant API calls - just increment counter
    useEffect(() => {
        try {
            if (user && user.id && socket) {
                socket.on('newMessage', (newMessage) => {
                    // REACT QUERY: Invalidate chats to trigger refetch
                    invalidateChats();

                    // Always broadcast event for NavSideChat update
                    const chatUpdateEvent = new CustomEvent('chatUpdate', {
                        detail: newMessage
                    });
                    window.dispatchEvent(chatUpdateEvent);

                    // Only show toast notification if not in chat
                    const isOnChatRoute = window.location.pathname === '/chat';
                    if (!isOnChatRoute) {
                        toast.info(`Nova poruka od ${newMessage.sender?.ime + ' ' + newMessage.sender?.prezime || newMessage.senderMentor?.ime + ' ' + newMessage.senderMentor?.prezime }`, {
                            position: "top-right",
                            autoClose: 5000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            progress: undefined,
                            theme: "light",
                            style: {
                                background: 'var(--iznad)',
                                color: 'var(--tekst)',
                            },
                            onClick: () => {
                                window.focus();
                                navigate('/chat');
                            }
                        });
                    }
                });

                socket.on('newGroupMessage', (newMessage) => {
                    // REACT QUERY: Invalidate chats to trigger refetch
                    invalidateChats();

                    // Always broadcast event for NavSideChat update
                    const chatUpdateEvent = new CustomEvent('chatUpdate', {
                        detail: newMessage
                    });
                    window.dispatchEvent(chatUpdateEvent);

                    // Only show toast notification if not in chat
                    const isOnChatRoute = window.location.pathname === '/chat';
                    if (!isOnChatRoute) {
                        const senderName = newMessage.senderName || newMessage.senderMentor?.ime || 'korisnik';
                        toast.info(`${senderName} je poslao/la poruku u grupi ${newMessage.groupName || 'Grupa'}`, {
                            position: "top-right",
                            autoClose: 5000,
                            hideProgressBar: false,
                            closeOnClick: true,
                            pauseOnHover: true,
                            draggable: true,
                            progress: undefined,
                            theme: "light",
                            style: {
                                background: 'var(--iznad)',
                                color: 'var(--tekst)',
                            },
                            onClick: () => {
                                window.focus();
                                navigate('/chat');
                            }
                        });
                    }
                });

                return () => {
                    socket.off('newMessage');
                    socket.off('newGroupMessage');
                };
            }
        } catch (error) {
        }
    }, [user, socket, navigate, invalidateChats]);

    // Firebase messaging effect for in-app notifications
    useEffect(() => {
        if (!messaging) {
            return;
        }

        const messageHandler = (payload) => {
            const { notification } = payload.data || {};

            if (notification) {
                try {
                    const notificationData = JSON.parse(notification);
                    toast(notificationData.body, {
                        type: notificationData.type || 'info'
                    });

                    // Update unread count if it's a chat message
                    if (notificationData.type === 'chat') {
                        fetchUnreadCount();  // Use this instead of updateUnreadCount
                    }
                } catch (error) {
                }
            }
        };

        // QUICK WIN: Removed duplicate fetchUnreadCount call
        // Count is already fetched on mount in separate useEffect
        if (isLoggedIn && messaging) {
            onMessage(messaging, messageHandler);
        }
    }, [isLoggedIn]);

    // REACT QUERY: Polls now auto-refresh every 30 seconds via useActivePolls hook
    // Removed fetchActivePolls and manual interval - React Query handles it!

    // Special occasion popup check
    useEffect(() => {
        const run = () => {
            const today = new Date();
            const month = today.getMonth() + 1; // 0-indexed, so add 1
            const day = today.getDate();
            const year = today.getFullYear();
            const todayString = `${year}-${month}-${day}`;

            // Get the popup history from localStorage
            let popupHistory = {};
            try {
                const storedHistory = localStorage.getItem('popupHistory');
                if (storedHistory) {
                    popupHistory = JSON.parse(storedHistory);
                }
            } catch (error) {
                popupHistory = {};
            }

            // Function to check if a popup type has been shown today
            const hasShownToday = (popupType) => {
                return popupHistory[popupType] === todayString;
            };

            // Function to mark a popup as shown
            const markPopupShown = (popupType) => {
                popupHistory[popupType] = todayString;
                localStorage.setItem('popupHistory', JSON.stringify(popupHistory));
            };

            // For testing - show popup when user logs in
            const forceShowPopup = false; // Set to true to test popup
            if (forceShowPopup && isLoggedIn) {
                setSpecialPopupData({
                    title: 'Sretan Uskrs!',
                    message: 'Želimo vam sretan Uskrs ispunjen radošću i mirom.',
                    image: '/images/cadenza-easter.png',
                    type: 'test'
                });
                setShowSpecialPopup(true);
                return;
            }

            // Birthday check (if user is logged in and has birthday data)
            if (isLoggedIn && user?.datumRodjenja && !hasShownToday('birthday')) {
                try {
                    const birthDate = new Date(user.datumRodjenja);
                    if (!isNaN(birthDate.getTime())) { // Check if date is valid
                        const birthMonth = birthDate.getMonth() + 1;
                        const birthDay = birthDate.getDate();

                        if (month === birthMonth && day === birthDay) {
                            if (user?.ime) { // Make sure we have the user's name
                                setSpecialPopupData({
                                    title: 'Sretan Rođendan!',
                                    message: `${user.ime}, želimo Vam sve najbolje povodom rođendana!`,
                                    image: '/images/cadenza-birthday.png',  // Using birthday image
                                    type: 'birthday'
                                });
                                setShowSpecialPopup(true);
                                markPopupShown('birthday');
                                return; // Return early to prioritize birthday over other occasions
                            }
                        }
                    }
                } catch (error) {
                    // Just continue to other checks if there's an error
                }
            }

            // Easter check
            const isEaster =
                (month === 3 && day === 31 && year === 2024) ||
                (month === 4 && day === 20 && year === 2025);

            if (isEaster && !hasShownToday('easter')) {
                setSpecialPopupData({
                    title: 'Sretan Uskrs!',
                    message: 'Želimo vam sretan Uskrs ispunjen radošću i mirom.',
                    image: '/images/cadenza-easter.png',  // Using specific Easter image
                    type: 'easter'
                });
                setShowSpecialPopup(true);
                markPopupShown('easter');
                return;
            }

            // Christmas
            if (month === 12 && day === 25 && !hasShownToday('christmas')) {
                setSpecialPopupData({
                    title: 'Sretan Božić!',
                    message: 'Želimo vam Božić ispunjen radošću, mirom i ljubavlju.',
                    image: '/images/cadenza-christmas.png',  // Using Christmas image
                    type: 'christmas'
                });
                setShowSpecialPopup(true);
                markPopupShown('christmas');
                return;
            }

            // New Year
            if (month === 1 && day === 1 && !hasShownToday('newYear')) {
                setSpecialPopupData({
                    title: 'Sretna Nova Godina!',
                    message: 'Želimo vam puno sreće, zdravlja i uspjeha u novoj godini.',
                    image: '/images/cadenza-newyear.png',  // Using New Year image
                    type: 'newYear'
                });
                setShowSpecialPopup(true);
                markPopupShown('newYear');
            }
        };

        const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
        const idleId = idle(run);
        return () => {
            if (window.cancelIdleCallback) {
                window.cancelIdleCallback(idleId);
            }
        };
    }, [isLoggedIn, user]);

    // Admin: idle-time preload of heavy routes and warm first page of users
    useEffect(() => {
        if (!isLoggedIn || !user?.isAdmin) return;
        const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
        const idleId = idle(async () => {
            try {
                await Promise.all([
                    import('./scenes/administracija/Korisnici.jsx'),
                    import('./scenes/administracija/Mentori.jsx'),
                    import('./scenes/administracija/RacuniAdmin.jsx'),
                    import('./scenes/administracija/Programs.jsx'),
                    import('./scenes/administracija/Classroom.jsx'),
                    import('./scenes/administracija/Delete.jsx'),
                    import('./scenes/administracija/EnrollmentDashboard.jsx')
                ]);
            } catch (_) {}
            try {
                const profileRes = await ApiConfig.api.get('/api/profil');
                const schoolId = profileRes.data?.user?.schoolId;
                if (schoolId) {
                    await ApiConfig.cachedApi.get('/api/korisnici', { params: { schoolId } });
                }
            } catch (_) {}
        });
        return () => {
            if (window.cancelIdleCallback) {
                window.cancelIdleCallback(idleId);
            }
        };
    }, [isLoggedIn, user?.isAdmin]);

    function getCurrentSchoolYear() {
        const now = new Date();
        const month = now.getMonth();
        return month;
      }

    // Enrollment check effect
    useEffect(() => {
        const checkEnrollment = async () => {
            if (isLoggedIn && user && user?.isStudent) {
                try {
                    const res = await ApiConfig.api.get('/api/enrollment/current');
                    if (!res.data.enrollment || !res.data.enrollment.agreementAccepted) {
                        setNeedsEnrollment(true);
                    } else {
                        setNeedsEnrollment(false);
                    }
                } catch (err) {
                    setNeedsEnrollment(true);
                } finally {
                    setEnrollmentChecked(true);
                }
            } else {
                setEnrollmentChecked(true);
                setNeedsEnrollment(false);
            }
        };
        checkEnrollment();
    }, [isLoggedIn, user]);

    // Make socket available globally
    window.socket = socket;

    // Add network status check function for testing
    window.checkNetworkStatus = () => {
        return {
            navigatorOnLine: navigator.onLine,
            currentState: isOnline
        };
    };

    if (loading || !enrollmentChecked) {
        return <LoadingShell />;
    }

    if (isLoggedIn && needsEnrollment && user.isStudent && month >= 8) {
        return <EnrollmentConfirm user={user} />;
    }

    return (
        <ErrorBoundary navigate={navigate}>
            <Routes>
                <Route path="/" element={<Welcome />} />
                <Route path="/login" element={
                    isLoggedIn ? <Navigate to="/user" /> : <Login />
                } />
                <Route path="/signup" element={
                    isLoggedIn ? <Navigate to="/user" /> : <SignUpForm />
                } />
                <Route path="/signup/f8h3k2j9d5m7n1p4q6r8s0t2u4v6w8x0" element={<MentorSignUpForm />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/enroll" element={<EnrollmentConfirm user={user} />} />

                {/* Protected Routes with NotificationProvider */}
                <Route element={
                    isLoggedIn && user ? (
                        <NotificationProvider>
                            <ProtectedRoute>
                                <Outlet />
                            </ProtectedRoute>
                        </NotificationProvider>
                    ) : (
                        <Navigate to="/login" replace />
                    )
                }>
                    <Route path="/user" element={
                            <Naslovna user={user} unreadChatsCount={unreadChatsCount} activePolls={activePolls}/>
                    } />
                    <Route path="/profil" element={<Profil user={user} unreadChatsCount={unreadChatsCount}/>} />
                    <Route path="/chat" element={
                        <Suspense fallback={<LoadingShell />}>
                            <Chat
                                user={user}
                                socket={socket}
                                chat={true}
                                unreadChatsCount={unreadChatsCount}
                                onMessagesRead={async (count) => {
                                    // REACT QUERY: Just invalidate, it will refetch and update automatically
                                    invalidateChats();
                                    const chatUpdateEvent = new CustomEvent('chatUpdate');
                                    window.dispatchEvent(chatUpdateEvent);
                                }}
                            />
                        </Suspense>
                    } />
                    <Route path="/racuni" element={
                        <Suspense fallback={<LoadingShell />}>
                            <Racuni user={user} unreadChatsCount={unreadChatsCount}/>
                        </Suspense>
                    } />
                    <Route path="/raspored" element={
                        <Suspense fallback={<LoadingShell />}>
                            <Raspored user={user} unreadChatsCount={unreadChatsCount}/>
                        </Suspense>
                    } />
                    <Route path="/obavijesti" element={
                        <Suspense fallback={<LoadingShell />}>
                            <Obavijesti user={user} unreadChatsCount={unreadChatsCount}/>
                        </Suspense>
                    } />
                    <Route path="/dokumenti" element={
                        <Suspense fallback={<LoadingShell />}>
                            <Documents user={user} unreadChatsCount={unreadChatsCount}/>
                        </Suspense>
                    } />
                    <Route path="/documents/:documentId" element={
                        <Suspense fallback={<LoadingShell />}>
                            <Documents user={user} unreadChatsCount={unreadChatsCount}/>
                        </Suspense>
                    } />
                    <Route path="/report-problem" element={<ReportProblem />} />

                    {/* Admin routes */}
                    {user?.isAdmin && (
                        <>
                            <Route path="/admin/*" element={<Suspense fallback={<LoadingShell />}><Admin user={user} /></Suspense>} />
                            <Route path="/korisnici" element={<Suspense fallback={<LoadingShell />}><Korisnici user={user} /></Suspense>} />
                            <Route path="/mentori" element={<Suspense fallback={<LoadingShell />}><Mentori user={user} /></Suspense>} />
                            <Route path="/pending-users" element={<Suspense fallback={<LoadingShell />}><PendingUsers user={user} /></Suspense>} />
                            <Route path="/racuni-admin" element={<Suspense fallback={<LoadingShell />}><RacuniAdmin user={user} /></Suspense>} />
                            <Route path="/programi" element={<Suspense fallback={<LoadingShell />}><Programs user={user} /></Suspense>} />
                            <Route path="/classrooms" element={<Suspense fallback={<LoadingShell />}><Classrooms user={user} /></Suspense>} />
                            <Route path="/delete" element={<Suspense fallback={<LoadingShell />}><Delete user={user} /></Suspense>} />
                            <Route path='/enrollments' element={<Suspense fallback={<LoadingShell />}><EnrollmentDashboard /></Suspense>} />
                        </>
                    )}

                    {user?.isMentor && (
                        <Route path="/mentor" element={<Suspense fallback={<LoadingShell />}><MentorSelfService /></Suspense>} />
                    )}

                    {user?.isStudent && (
                        <Route path="/ucenik" element={<Suspense fallback={<LoadingShell />}><StudentSelfService /></Suspense>} />
                    )}
                </Route>

                <Route path="/error" element={<Error />} />
                <Route path="/about" element={<About />} />
                <Route path="*" element={
                    <Navigate to="/error" replace state={{
                        error: "Stranica nije pronađena",
                        details: {
                            type: "404",
                            path: window.location.pathname,
                            isStaleRoute: true
                        },
                        previousPath: window.location.pathname,
                        isCritical: false
                    }} />
                } />
            </Routes>
            <CookieConsent />
            <TermsAndWelcome />
            <InstallPWA />
            <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />
            {notification && (
                <Notifikacija
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
            {networkNotification && (
                <Notifikacija
                    message={networkNotification.message}
                    type={networkNotification.type}
                    duration={networkNotification.duration}
                    onClose={() => setNetworkNotification(null)}
                />
            )}
            {user && showPollIndicator && (user.isMentor || user.pohadjaTeoriju) && (
                <PollIndicator
                    user={user}
                    polls={activePolls}
                    onHide={() => setShowPollIndicator(false)}
                />
            )}
            <SpecialOccasionPopup
                isOpen={showSpecialPopup}
                onClose={() => setShowSpecialPopup(false)}
                title={specialPopupData.title}
                message={specialPopupData.message}
                image={specialPopupData.image}
            />
            <NetworkStatus isOnline={isOnline} />
            {/* Network test component - hidden per user request */}
            {/* {process.env.NODE_ENV === 'development' && <NetworkTest />} */}
        </ErrorBoundary>
    );
};

export default App;