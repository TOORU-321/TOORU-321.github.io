// エルラボ＋ Service Worker（PWAインストール用＋プッシュ通知の受け口）
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

// インストール可能条件を満たすための最小fetchハンドラ（そのまま通す）
self.addEventListener('fetch', function(e){ /* passthrough */ });

// プッシュ受信 → 通知を表示（Phase2で送信側を実装したら動きます）
self.addEventListener('push', function(event){
  var data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch(e){ data = { title: 'エルラボ＋', body: event.data ? event.data.text() : '' }; }
  var title = data.title || 'エルラボ＋';
  var options = {
    body: data.body || '',
    icon: '../assets/favicon.png',
    badge: '../assets/favicon.png',
    data: { url: data.url || 'https://columns.l-mine.com/app/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 通知タップ → アプリを開く
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || 'https://columns.l-mine.com/app/';
  event.waitUntil(clients.openWindow(url));
});
