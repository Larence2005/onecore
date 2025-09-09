import admin from 'firebase-admin';

// Check if the environment variable for the service account is set.
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
        const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
    } catch (e) {
        console.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON. Please ensure it is a valid JSON string.', e);
        // Fallback to default credentials if parsing fails, which might work in some environments.
        if (!admin.apps.length) {
            admin.initializeApp();
        }
    }
} else {
    // If the environment variable is not set, fall back to Application Default Credentials.
    // This will work in environments like Cloud Functions or App Engine where ADC is configured.
    console.warn("GOOGLE_APPLICATION_CREDENTIALS_JSON is not set. Falling back to Application Default Credentials. This might not work for all admin operations in a local environment.");
    if (!admin.apps.length) {
        admin.initializeApp();
    }
}


export const app = admin.app();
export const auth = admin.auth();
export const db = admin.firestore();
