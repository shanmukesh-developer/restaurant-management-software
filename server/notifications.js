const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseApp;
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

// Priority: 1. Environment Variable (JSON string), 2. Local File
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized from environment variable.');
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var:', err);
  }
} else if (fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = require(serviceAccountPath);
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized from serviceAccountKey.json.');
  } catch (err) {
    console.error('Failed to initialize Firebase Admin from file:', err);
  }
} else {
  console.warn('Firebase credentials not found (env var or file). Notifications will be disabled.');
}

async function sendNotification(role, title, body, data = {}) {
  if (!firebaseApp) return;

  const { getDb } = require('./db');
  const db = await getDb();
  
  // Get all tokens for this role
  const tokens = await db.all('SELECT token FROM staff_tokens WHERE role = ?', [role]);
  
  if (tokens.length === 0) return;

  const registrationTokens = tokens.map(t => t.token);
  
  const message = {
    notification: { title, body },
    data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
    tokens: registrationTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Successfully sent ${response.successCount} notifications to ${role}`);
    
    // Clean up invalid tokens if any
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error.code;
          if (errorCode === 'messaging/registration-token-not-registered' || 
              errorCode === 'messaging/invalid-registration-token') {
            failedTokens.push(registrationTokens[idx]);
          }
        }
      });
      
      if (failedTokens.length > 0) {
        const placeholders = failedTokens.map((_, i) => `$${i + 1}`).join(',');
        await db.run(`DELETE FROM staff_tokens WHERE token IN (${placeholders})`, failedTokens);
        console.log(`Cleaned up ${failedTokens.length} invalid tokens for ${role}`);
      }
    }
  } catch (error) {
    console.error('Error sending multicast message:', error);
  }
}

module.exports = { sendNotification };
