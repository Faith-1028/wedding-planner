/**
 * ============================================================
 * core.js - 核心逻辑
 * ============================================================
 * 包含：认证系统、权限管理、数据库抽象层、实时同步、
 *       通知分发、操作日志记录
 * ============================================================
 */

(function() {
'use strict';

window.App = window.App || {};

// ============================================================
// 1. 密码哈希 (SHA-256)
// ============================================================
App.hashPassword = async function(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '_wedding_salt_2026');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

// ============================================================
// 2. 本地数据库（Supabase 未配置时的回退方案）
// ============================================================
const LocalDB = {
    store: {},
    channel: null,
    subscribers: {},

    init() {
        // 从 sessionStorage 恢复数据
        const saved = sessionStorage.getItem('app_local_db');
        if (saved) {
            try { this.store = JSON.parse(saved); } catch(e) { this.store = {}; }
        }
        // 初始化空表
        ['app_users', 'wedding_config', 'guests', 'timeline_tasks', 'games',
         'supplies', 'budget_items', 'operation_logs', 'notifications', 'reminders',
         'staff_contacts', 'seating_tables', 'seating_assignments', 'memos', 'announcements', 'gifts'
        ].forEach(t => {
            if (!this.store[t]) this.store[t] = [];
        });
        if (!this.store.wedding_config.length) {
            this.store.wedding_config = [{
                id: 1,
                wedding_datetime: '2026-12-20T11:00:00+08:00',
                groom_name: '', bride_name: '', venue: '',
                updated_at: new Date().toISOString()
            }];
        }
        // 跨标签页同步
        if (typeof BroadcastChannel !== 'undefined') {
            this.channel = new BroadcastChannel('wedding_app_sync');
            this.channel.onmessage = (e) => {
                const { table, eventType, row, oldRow } = e.data;
                this._applyChange(table, eventType, row, oldRow);
                // 通知订阅者
                (this.subscribers[table] || []).forEach(cb => cb({ eventType, row, oldRow }));
            };
        }
        this._persist();
    },

    _persist() {
        sessionStorage.setItem('app_local_db', JSON.stringify(this.store));
    },

    _applyChange(table, eventType, row, oldRow) {
        if (!this.store[table]) this.store[table] = [];
        if (eventType === 'INSERT') {
            if (!this.store[table].find(r => r.id === row.id)) {
                this.store[table].push(row);
            }
        } else if (eventType === 'UPDATE') {
            const idx = this.store[table].findIndex(r => r.id === row.id);
            if (idx >= 0) this.store[table][idx] = row;
        } else if (eventType === 'DELETE') {
            this.store[table] = this.store[table].filter(r => r.id !== (oldRow || row).id);
        }
        this._persist();
    },

    async select(table, orderBy) {
        let data = [...(this.store[table] || [])];
        if (orderBy === 'sort_order') data.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        if (orderBy === 'created_at') data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        return data;
    },

    async selectOne(table, filters) {
        const rows = this.store[table] || [];
        return rows.find(r => Object.keys(filters).every(k => r[k] === filters[k])) || null;
    },

    async insert(table, data) {
        const row = {
            id: data.id || (crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2)),
            ...data,
            created_at: data.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        if (!this.store[table]) this.store[table] = [];
        this.store[table].push(row);
        this._persist();
        this._broadcast(table, 'INSERT', row);
        return row;
    },

    async update(table, id, updates) {
        const rows = this.store[table] || [];
        const idx = rows.findIndex(r => r.id === id);
        if (idx < 0) return null;
        const oldRow = { ...rows[idx] };
        rows[idx] = { ...rows[idx], ...updates, updated_at: new Date().toISOString() };
        this._persist();
        this._broadcast(table, 'UPDATE', rows[idx], oldRow);
        return rows[idx];
    },

    async delete(table, id) {
        const rows = this.store[table] || [];
        const idx = rows.findIndex(r => r.id === id);
        if (idx < 0) return;
        const oldRow = rows[idx];
        rows.splice(idx, 1);
        this._persist();
        this._broadcast(table, 'DELETE', oldRow);
    },

    _broadcast(table, eventType, row, oldRow) {
        if (this.channel) {
            this.channel.postMessage({ table, eventType, row, oldRow });
        }
        // 本地也触发订阅者
        (this.subscribers[table] || []).forEach(cb => cb({ eventType, row: row, oldRow }));
    },

    subscribe(table, callback) {
        if (!this.subscribers[table]) this.subscribers[table] = [];
        this.subscribers[table].push(callback);
        return () => {
            this.subscribers[table] = this.subscribers[table].filter(cb => cb !== callback);
        };
    }
};

// ============================================================
// 3. 数据库抽象层 (统一接口)
// ============================================================
App.db = {
    async select(table, orderBy) {
        if (App.isSupabaseConfigured) {
            let query = App.supabase.from(table).select('*');
            if (orderBy === 'sort_order') query = query.order('sort_order', { ascending: true });
            else if (orderBy === 'created_at') query = query.order('created_at', { ascending: false });
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        }
        return LocalDB.select(table, orderBy);
    },

    async selectOne(table, filters) {
        if (App.isSupabaseConfigured) {
            let query = App.supabase.from(table).select('*');
            for (const [k, v] of Object.entries(filters)) {
                query = query.eq(k, v);
            }
            query = query.limit(1);
            const { data, error } = await query;
            if (error) throw error;
            return (data && data[0]) || null;
        }
        return LocalDB.selectOne(table, filters);
    },

    async insert(table, data) {
        if (App.isSupabaseConfigured) {
            const { data: result, error } = await App.supabase.from(table).insert(data).select();
            if (error) throw error;
            return (result && result[0]) || data;
        }
        return LocalDB.insert(table, data);
    },

    async update(table, id, updates) {
        if (App.isSupabaseConfigured) {
            const { data, error } = await App.supabase.from(table).update(updates).eq('id', id).select();
            if (error) throw error;
            return (data && data[0]) || null;
        }
        return LocalDB.update(table, id, updates);
    },

    async delete(table, id) {
        if (App.isSupabaseConfigured) {
            const { error } = await App.supabase.from(table).delete().eq('id', id);
            if (error) throw error;
            return;
        }
        return LocalDB.delete(table, id);
    },

    subscribe(table, callback) {
        if (App.isSupabaseConfigured) {
            const channel = App.supabase
                .channel('changes_' + table)
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: table },
                    (payload) => {
                        callback({
                            eventType: payload.eventType.toUpperCase(),
                            row: payload.new || payload.old,
                            oldRow: payload.old
                        });
                    }
                )
                .subscribe();
            return () => { App.supabase.removeChannel(channel); };
        }
        return LocalDB.subscribe(table, callback);
    }
};

// ============================================================
// 4. 认证系统
// ============================================================
App.auth = {
    currentUser: null,

    async ensureAdminExists() {
        try {
            const admin = await App.db.selectOne('app_users', { username: App.config.ADMIN_USERNAME });
            if (!admin) {
                const hash = await App.hashPassword(App.config.ADMIN_PASSWORD);
                await App.db.insert('app_users', {
                    username: App.config.ADMIN_USERNAME,
                    password_hash: hash,
                    name: App.config.ADMIN_NAME,
                    role: 'admin',
                    status: 'active',
                    must_change_password: false
                });
                console.log('[Auth] 初始管理员账号已创建');
            }
        } catch (e) {
            console.error('[Auth] 创建管理员失败:', e);
        }
    },

    async login(username, password) {
        const hash = await App.hashPassword(password);
        const user = await App.db.selectOne('app_users', { username: username });
        if (!user) throw new Error('账号不存在');
        if (user.status === 'disabled') throw new Error('该账号已被禁用，请联系管理员');
        if (user.password_hash !== hash) throw new Error('密码错误');

        this.currentUser = {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            must_change_password: user.must_change_password
        };
        sessionStorage.setItem('app_session', JSON.stringify(this.currentUser));
        return this.currentUser;
    },

    logout() {
        this.currentUser = null;
        sessionStorage.removeItem('app_session');
    },

    restoreSession() {
        const saved = sessionStorage.getItem('app_session');
        if (saved) {
            try {
                this.currentUser = JSON.parse(saved);
                return this.currentUser;
            } catch(e) { sessionStorage.removeItem('app_session'); }
        }
        return null;
    },

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    },

    async changePassword(username, newPassword) {
        const hash = await App.hashPassword(newPassword);
        const user = await App.db.selectOne('app_users', { username: username });
        if (!user) throw new Error('用户不存在');
        await App.db.update('app_users', user.id, {
            password_hash: hash,
            must_change_password: false
        });
        if (this.currentUser && this.currentUser.username === username) {
            this.currentUser.must_change_password = false;
            sessionStorage.setItem('app_session', JSON.stringify(this.currentUser));
        }
    }
};

// ============================================================
// 5. 操作日志 & 通知分发
// ============================================================
App.tracker = {
    async log(operationType, module, contentSummary, options) {
        const user = App.auth.currentUser;
        if (!user) return;
        const opts = options || {};
        try {
            // 写入操作日志（始终记录）
            await App.db.insert('operation_logs', {
                operator_username: user.username,
                operator_name: user.name,
                operation_type: operationType,
                module: module,
                content_summary: contentSummary || ''
            });
            // 写入通知（触发实时弹窗）— 隐私模块跳过通知
            if (!opts.silent) {
                await App.db.insert('notifications', {
                    client_id: App.clientId,
                    operator_username: user.username,
                    operator_name: user.name,
                    operation_type: operationType,
                    module: module,
                    content_summary: contentSummary || ''
                });
            }
        } catch (e) {
            console.error('[Tracker] 记录操作失败:', e);
        }
    }
};

// ============================================================
// 6. 实时通知处理
// ============================================================
App.realtime = {
    subscriptions: [],
    seenNotifications: new Set(),

    init() {
        // 订阅 notifications 表变更
        const unsub = App.db.subscribe('notifications', (payload) => {
            if (payload.eventType === 'INSERT') {
                const n = payload.row;
                // 跳过自己发出的通知
                if (n.client_id === App.clientId) return;
                // 跳过已处理的通知
                if (this.seenNotifications.has(n.id)) return;
                this.seenNotifications.add(n.id);
                this.showNotification(n);
            }
        });
        this.subscriptions.push(unsub);

        // 订阅各数据表变更，触发模块刷新
        const tables = ['guests', 'timeline_tasks', 'games', 'supplies',
                        'budget_items', 'app_users', 'wedding_config', 'reminders',
                        'staff_contacts', 'seating_tables', 'seating_assignments',
                        'memos', 'announcements', 'gifts', 'app_settings'];
        tables.forEach(table => {
            const unsub = App.db.subscribe(table, (payload) => {
                this.onDataChange(table, payload);
            });
            this.subscriptions.push(unsub);
        });
    },

    showNotification(n) {
        const typeMap = {
            '新增': { icon: '✨', class: 'add' },
            '编辑': { icon: '✏️', class: 'edit' },
            '删除': { icon: '🗑️', class: 'delete' },
            '删除宾客': { icon: '🗑️', class: 'delete' },
            '公告': { icon: '📢', class: 'add' },
        };
        const typeInfo = typeMap[n.operation_type] || { icon: '🔔', class: '' };
        const toast = document.createElement('div');
        toast.className = 'toast ' + typeInfo.class;
        toast.innerHTML = `
            <div class="toast-icon">${typeInfo.icon}</div>
            <div class="toast-body">
                <div class="toast-title">${n.operator_name} ${n.operation_type}了${n.module}</div>
                ${n.content_summary ? `<div class="toast-desc">${n.content_summary}</div>` : ''}
            </div>
            <button class="toast-close">&times;</button>
        `;
        const container = document.getElementById('toastContainer');
        if (container) {
            container.appendChild(toast);
            toast.querySelector('.toast-close').onclick = () => this.removeToast(toast);
            setTimeout(() => this.removeToast(toast), 6000);
        }
    },

    removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('toast-out');
        setTimeout(() => { toast.remove(); }, 300);
    },

    onDataChange(table, payload) {
        // 通知对应模块刷新数据
        const moduleMap = {
            'guests': 'guests',
            'timeline_tasks': 'timeline',
            'games': 'games',
            'supplies': 'supplies',
            'budget_items': 'budget',
            'app_users': 'users',
            'wedding_config': 'dashboard',
            'reminders': 'dashboard',
            'announcements': 'dashboard',
            'staff_contacts': 'staff',
            'seating_tables': 'seating',
            'seating_assignments': 'seating',
            'memos': 'memos',
            'gifts': 'gifts'
        };
        const moduleId = moduleMap[table];

        // 系统设置变更：重新加载动态选项，并触发所有受影响模块刷新
        if (table === 'app_settings') {
            clearTimeout(this._refreshTimers._settings);
            this._refreshTimers._settings = setTimeout(async () => {
                await App.config.loadDynamicOptions();
                ['guests', 'supplies', 'memos', 'staff', 'seating', 'budget', 'timeline', 'settings'].forEach(id => {
                    if (App.modules[id] && typeof App.modules[id].refresh === 'function') {
                        try { App.modules[id].refresh(); } catch(e) {}
                    }
                });
            }, 300);
            return;
        }

        if (moduleId && App.modules[moduleId] && typeof App.modules[moduleId].refresh === 'function') {
            // 延迟刷新避免并发
            clearTimeout(this._refreshTimers[moduleId]);
            this._refreshTimers[moduleId] = setTimeout(() => {
                App.modules[moduleId].refresh();
            }, 300);
        }
    },

    _refreshTimers: {},

    destroy() {
        this.subscriptions.forEach(unsub => { try { unsub(); } catch(e){} });
        this.subscriptions = [];
    }
};

// ============================================================
// 7. 初始化本地数据库（如果需要）
// ============================================================
if (!App.isSupabaseConfigured) {
    LocalDB.init();
}

// 暴露 LocalDB 供调试
App._localDB = LocalDB;

})();
