/**
 * Service Worker - 备婚协同管理平台 PWA
 * 实现离线缓存、快速加载、后台更新
 */

const CACHE_VERSION = 'wedding-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// 需要预缓存的静态资源
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/core.js',
  './js/ui.js',
  './js/app.js',
  './js/dashboard.js',
  './js/guests.js',
  './js/timeline.js',
  './js/games.js',
  './js/supplies.js',
  './js/budget.js',
  './js/staff.js',
  './js/seating.js',
  './js/vehicles.js',
  './js/memos.js',
  './js/gifts.js',
  './js/users.js',
  './js/logs.js',
  './js/settings.js',
  './js/assistant.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  // Supabase CDN (运行时缓存)
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
];

// 不缓存的请求（Supabase API、Realtime WebSocket）
const CACHE_BLACKLIST = [
  'cpdaenspyimjvogxcjpw.supabase.co',
  'supabase.co',
  'realtime',
  'wss://',
];

// ============ 安装：预缓存静态资源 ============
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        // 部分资源缓存失败不影响安装
        console.warn('[SW] 部分预缓存失败:', err);
      });
    })
  );
  self.skipWaiting();
});

// ============ 激活：清理旧缓存 ============
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('wedding-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ============ 拦截请求：缓存优先，网络回退 ============
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只处理 GET 请求
  if (request.method !== 'GET') return;

  // Supabase API 和 Realtime 不缓存
  const url = request.url;
  if (CACHE_BLACKLIST.some((pattern) => url.includes(pattern))) {
    return; // 直接走网络
  }

  // 缓存优先策略
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // 后台更新缓存
        fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, response.clone());
              });
            }
          })
          .catch(() => {});
        return cached;
      }

      // 缓存未命中，走网络
      return fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // 缓存新资源
          const responseClone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // 离线回退
          if (request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

// ============ 接收消息：手动更新缓存 ============
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});
