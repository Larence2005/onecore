import admin from 'firebase-admin';

if (!admin.apps.length) {
    admin.initializeApp({
        // You can leave this empty if you have GOOGLE_APPLICATION_CREDENTIALS set
    });
}

export const app = admin.app();
export const auth = admin.auth();
export const db = admin.firestore();
