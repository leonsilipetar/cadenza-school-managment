export function register() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log('ServiceWorker registration successful');

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Show update notification - don't auto-reload immediately
                window.dispatchEvent(new CustomEvent('swUpdateAvailable', {
                  detail: { registration, newWorker }
                }));
                
                // Store that an update is available
                sessionStorage.setItem('swUpdateAvailable', 'true');
                
                // Auto-activate after a delay to give user time to finish what they're doing
                setTimeout(() => {
                  try {
                    newWorker.postMessage({ type: 'SKIP_WAITING' });
                  } catch (_) {}
                }, 3000);
              }
            });
          });

          // Periodic update check (every 30 minutes)
          setInterval(() => {
            registration.update();
          }, 30 * 60 * 1000);
        })
        .catch(error => {
          console.log('ServiceWorker registration failed:', error);
        });

      // Handle updates across tabs/windows - improved
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          
          // Clear caches before reload to prevent stale data
          if ('caches' in window) {
            caches.keys().then(names => {
              names.forEach(name => {
                // Only clear old caches, keep the new one
                if (name.includes('cadenza-cache-v')) {
                  const version = name.split('v')[1];
                  if (version) {
                    caches.delete(name);
                  }
                }
              });
            });
          }
          
          // Reload to safe route to prevent error loops
          const currentPath = window.location.pathname;
          if (currentPath === '/error' || currentPath === '/') {
            // If on error page or root, go to login/user after reload
            sessionStorage.setItem('redirectAfterSWUpdate', 'true');
          }
          
          // Small delay to ensure caches are cleared
          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.unregister();
      })
      .catch(error => {
        console.error(error.message);
      });
  }
}