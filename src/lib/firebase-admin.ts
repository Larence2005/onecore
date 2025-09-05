import admin from 'firebase-admin';

if (!admin.apps.length) {
    // By not passing any configuration, the Admin SDK will automatically
    // use the Application Default Credentials (ADC) from the environment.
    admin.initializeApp();
}

export const app = admin.app();
export const auth = admin.auth();
export const db = admin.firestore();
