// エルラボ アクセス解析ダッシュボード用 Service Worker（プッシュ通知の受信＋PWA）
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBpBpGmxfWhyHq3rzwH2Oa_6IWDIZbOAj8",
  authDomain: "elabo-plus.firebaseapp.com",
  projectId: "elabo-plus",
  storageBucket: "elabo-plus.firebasestorage.app",
  messagingSenderId: "452649305918",
  appId: "1:452649305918:web:4bef5bae57aee4d86c4e6f"
});

const messaging = firebase.messaging();
const HOME = 'https://columns.l-mine.com/analytics/';

// バックグラウンドでプッシュ受信 → 通知を表示（data形式で送る想定）
messaging.onBackgroundMessage(function(payload){
  var d = payload.data || payload.notification || {};
  self.registration.showNotification(d.title || 'エルラボ アクセス解析', {
    body: d.body || '',
    icon: '../assets/favicon.png',
    badge: '../assets/favicon.png',
    tag: 'an-weekly',
    data: { url: d.url || HOME }
  });
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || HOME;
  event.waitUntil(
    clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(list){
      for(var i = 0; i < list.length; i++){
        if(list[i].url.indexOf('/analytics/') >= 0 && 'focus' in list[i]) return list[i].focus();
      }
      return clients.openWindow(url);
    })
  );
});

// PWAインストール可能条件用（そのまま通す）
self.addEventListener('fetch', function(e){ /* passthrough */ });
