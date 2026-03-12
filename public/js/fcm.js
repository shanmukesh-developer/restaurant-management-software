/**
 * Besta — FCM Registration Script
 * Handles push notification permissions and token registration for the Android app.
 */

async function initFCM(role) {
    if (!window.Capacitor) {
        console.log('Not running in a Capacitor environment. Push notifications disabled.');
        return;
    }

    const { PushNotifications } = window.Capacitor.Plugins;

    if (!PushNotifications) {
        console.warn('PushNotifications plugin not found.');
        return;
    }

    try {
        // 1. Request Permission
        let permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive !== 'granted') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.error('Push notification permission denied.');
            return;
        }

        // 2. Register for Push Notifications
        await PushNotifications.register();

        // 3. Handle Registration Success (get token)
        PushNotifications.addListener('registration', async (token) => {
            console.log('Push registration success, token:', token.value);
            
            // Register token with backend
            const authToken = sessionStorage.getItem('bestaToken');
            if (authToken) {
                try {
                    const response = await fetch('/api/auth/register-token', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`
                        },
                        body: JSON.stringify({
                            role: role,
                            token: token.value
                        })
                    });
                    const result = await response.json();
                    if (result.ok) {
                        console.log('FCM token registered with backend successfully.');
                    }
                } catch (err) {
                    console.error('Failed to register FCM token with backend:', err);
                }
            }
        });

        // 4. Handle Registration Error
        PushNotifications.addListener('registrationError', (error) => {
            console.error('Push registration error:', error);
        });

        // 5. Handle Incoming Notifications
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('Push received:', notification);
            // Optionally show an in-app alert or sound if needed
        });

        // 6. Handle Notification Action
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('Push action performed:', notification);
        });

    } catch (err) {
        console.error('FCM initialization failed:', err);
    }
}

// Automatically init if we have a role and token in session
document.addEventListener('DOMContentLoaded', () => {
    const role = sessionStorage.getItem('bestaRole');
    const token = sessionStorage.getItem('bestaToken');
    if (role && token) {
        initFCM(role);
    }
});
