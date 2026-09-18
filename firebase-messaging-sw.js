// Firebase Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBkjmETaws9Wlnv_UtrDlNrXMGuw96ka2E',
  authDomain: 'tomoko-diagnosis.firebaseapp.com',
  projectId: 'tomoko-diagnosis',
  storageBucket: 'tomoko-diagnosis.firebasestorage.app',
  messagingSenderId: '53605068113',
  appId: '1:53605068113:web:22dc9cd329cfc76f0eb770'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[FCM SW] バックグラウンド通知:', payload);
  const title = (payload.notification && payload.notification.title) || '🌸 新しい診断結果';
  const options = {
    body: (payload.notification && payload.notification.body) || '',
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: payload.data || {}
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.click_action)
    || 'https://columns.l-mine.com/admin-tomoko-k9x3m7d2.html';
  event.waitUntil(clients.openWindow(url));
});
