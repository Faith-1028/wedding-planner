/**
 * ============================================================
 * dashboard.js - 首页总看板模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.dashboard = {
    weddingDate: null,
    countdownTimer: null,
    reminders: [],
    announcements: [],

    onShow: function() {
        this.load();
    },

    init: function() {
        // 编辑倒计时
        const editBtn = document.getElementById('editCountdownBtn');
        if (editBtn) editBtn.addEventListener('click', () => this.showCountdownForm());

        // 添加提醒
        const addReminderBtn = document.getElementById('addReminderBtn');
        if (addReminderBtn) addReminderBtn.addEventListener('click', () => this.showReminderForm());
    },

    load: async function() {
        try {
            // 加载公告
            this.announcements = await App.db.select('announcements', 'created_at');
            this.renderAnnouncements();

            // 加载婚礼日期
            const config = await App.db.select('wedding_config');
            if (config && config.length > 0) {
                this.weddingDate = config[0].wedding_datetime;
                this.renderCountdown();
                this.startCountdown();
            }

            // 加载提醒
            this.reminders = await App.db.select('reminders', 'sort_order');
            this.renderReminders();

            // 渲染快捷链接
            this.renderQuickLinks();

            // 渲染数据卡片
            this.renderDataCards();
        } catch (e) {
            console.error('[Dashboard] 加载失败:', e);
        }
    },

    refresh: function() {
        this.load();
    },

    // ===== 全局公告 =====
    renderAnnouncements: function() {
        const container = document.getElementById('announcementBoard');
        if (!container) return;

        // 按置顶排序
        const sorted = [...this.announcements].sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            return new Date(b.created_at) - new Date(a.created_at);
        });

        const isAdmin = App.auth.isAdmin();

        if (sorted.length === 0) {
            container.innerHTML = `
                <div class="announcement-empty">
                    📢 ${isAdmin ? '暂无公告，点击下方按钮发布全局公告' : '暂无公告'}
                    ${isAdmin ? '<button class="btn btn-sm btn-primary" id="addAnnouncementBtn" style="margin-left:10px;">+ 发布公告</button>' : ''}
                </div>
            `;
        } else {
            container.innerHTML = sorted.map(a => `
                <div class="announcement-item ${a.is_pinned?'pinned':''}">
                    <div class="announcement-icon">${a.is_pinned ? '📌' : '📢'}</div>
                    <div class="announcement-body">
                        <div class="announcement-text">${App.ui.escapeHtml(a.content)}${a.is_pinned ? '<span class="announcement-pin-tag">置顶</span>' : ''}</div>
                        <div class="announcement-meta">${App.ui.escapeHtml(a.author_name||'管理员')} · ${App.ui.formatDateTime(a.created_at)}</div>
                    </div>
                    ${isAdmin ? `
                        <div class="announcement-actions">
                            <button data-id="${a.id}" data-action="pin-announcement" title="${a.is_pinned?'取消置顶':'置顶'}">${a.is_pinned?'📌':'📍'}</button>
                            <button data-id="${a.id}" data-action="edit-announcement" title="编辑">✏️</button>
                            <button data-id="${a.id}" data-action="del-announcement" title="删除">🗑️</button>
                        </div>
                    ` : ''}
                </div>
            `).join('') + (isAdmin ? `
                <button class="btn btn-sm btn-primary" id="addAnnouncementBtn" style="margin-top:8px;">+ 发布公告</button>
            ` : '');
        }

        // 绑定事件
        const addBtn = document.getElementById('addAnnouncementBtn');
        if (addBtn) addBtn.addEventListener('click', () => this.showAnnouncementForm());

        container.querySelectorAll('[data-action="pin-announcement"]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const item = this.announcements.find(a => a.id === btn.dataset.id);
                if (item) {
                    try {
                        await App.db.update('announcements', item.id, { is_pinned: !item.is_pinned });
                        await App.tracker.log(item.is_pinned ? '编辑' : '编辑', '全局公告', `${item.is_pinned?'取消置顶':'置顶'}公告`);
                    } catch(e) { App.ui.toast('操作失败', 'error'); }
                }
            });
        });
        container.querySelectorAll('[data-action="edit-announcement"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.announcements.find(a => a.id === btn.dataset.id);
                if (item) this.showAnnouncementForm(item);
            });
        });
        container.querySelectorAll('[data-action="del-announcement"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.announcements.find(a => a.id === btn.dataset.id);
                if (item) this.deleteAnnouncement(item);
            });
        });
    },

    showAnnouncementForm: function(item) {
        const isEdit = !!item;
        const a = item || { content: '', is_pinned: false };
        const bodyHtml = `
            <div class="form-group">
                <label>公告内容 *</label>
                <textarea id="announcementContent" rows="4" placeholder="输入公告内容，所有用户将在首页看到">${App.ui.attr(a.content)}</textarea>
            </div>
            <div class="form-group">
                <label class="status-checkbox">
                    <input type="checkbox" id="announcementPinned" ${a.is_pinned?'checked':''}>
                    置顶此公告（显示在所有公告最前面）
                </label>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveAnnouncementBtn">${isEdit ? '保存' : '发布'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑公告' : '发布公告', bodyHtml, footerHtml, () => {
            document.getElementById('saveAnnouncementBtn').onclick = async () => {
                const content = document.getElementById('announcementContent').value.trim();
                if (!content) { App.ui.toast('请输入公告内容', 'error'); return; }
                const isPinned = document.getElementById('announcementPinned').checked;
                try {
                    if (isEdit) {
                        await App.db.update('announcements', a.id, { content, is_pinned: isPinned });
                        await App.tracker.log('编辑', '全局公告', '修改公告内容');
                    } else {
                        await App.db.insert('announcements', {
                            content,
                            is_pinned: isPinned,
                            author_name: App.auth.currentUser.name
                        });
                        await App.tracker.log('公告', '全局公告', '发布新公告');
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已发布', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteAnnouncement: function(item) {
        App.ui.confirm('确定删除这条公告吗？', '此操作不可撤销', async () => {
            try {
                await App.db.delete('announcements', item.id);
                await App.tracker.log('删除', '全局公告', '删除公告');
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    // ===== 倒计时 =====
    renderCountdown: function() {
        const dateEl = document.getElementById('countdownDate');
        if (this.weddingDate) {
            dateEl.textContent = '婚礼时间：' + App.ui.formatDateTime(this.weddingDate);
        } else {
            dateEl.textContent = '尚未设置婚礼日期';
        }
    },

    startCountdown: function() {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        const update = () => {
            if (!this.weddingDate) {
                ['cdDays', 'cdHours', 'cdMinutes', 'cdSeconds'].forEach(id => {
                    document.getElementById(id).textContent = '--';
                });
                return;
            }
            const target = new Date(this.weddingDate).getTime();
            const now = Date.now();
            let diff = target - now;
            if (diff < 0) {
                document.getElementById('cdDays').textContent = '0';
                document.getElementById('cdHours').textContent = '0';
                document.getElementById('cdMinutes').textContent = '0';
                document.getElementById('cdSeconds').textContent = '0';
                return;
            }
            const days = Math.floor(diff / 86400000); diff %= 86400000;
            const hours = Math.floor(diff / 3600000); diff %= 3600000;
            const mins = Math.floor(diff / 60000); diff %= 60000;
            const secs = Math.floor(diff / 1000);
            document.getElementById('cdDays').textContent = String(days).padStart(2, '0');
            document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
            document.getElementById('cdMinutes').textContent = String(mins).padStart(2, '0');
            document.getElementById('cdSeconds').textContent = String(secs).padStart(2, '0');
        };
        update();
        this.countdownTimer = setInterval(update, 1000);
    },

    showCountdownForm: function() {
        const current = this.weddingDate || '';
        let dtValue = '';
        if (current) {
            const d = new Date(current);
            const localISO = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
                .toISOString().slice(0, 16);
            dtValue = localISO;
        }
        const bodyHtml = `
            <div class="form-group">
                <label>婚礼举办日期和时间</label>
                <input type="datetime-local" id="weddingDateTime" value="${dtValue}">
                <div class="form-hint">选择婚礼举办的准确日期和时间，所有用户将看到同一倒计时</div>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveCountdownBtn">保存</button>
        `;
        App.ui.showModal('设置婚礼日期', bodyHtml, footerHtml, () => {
            document.getElementById('saveCountdownBtn').onclick = async () => {
                const val = document.getElementById('weddingDateTime').value;
                if (!val) { App.ui.toast('请选择日期时间', 'error'); return; }
                const dt = new Date(val).toISOString();
                try {
                    await App.db.update('wedding_config', 1, {
                        wedding_datetime: dt,
                        updated_by: App.auth.currentUser.name
                    });
                    this.weddingDate = dt;
                    this.renderCountdown();
                    this.startCountdown();
                    App.ui.hideModal();
                    App.ui.toast('婚礼日期已更新', 'success');
                    await App.tracker.log('编辑', '倒计时设置', '修改婚礼日期为 ' + App.ui.formatDateTime(dt));
                } catch(e) {
                    App.ui.toast('保存失败：' + e.message, 'error');
                }
            };
        });
    },

    // ===== 快捷链接 =====
    renderQuickLinks: function() {
        const container = document.getElementById('quickLinks');
        const modules = App.config.MODULES.filter(m => m.id !== 'dashboard');
        container.innerHTML = modules.map(m => `
            <div class="quick-link-card" data-view="${m.id}">
                <div class="ql-icon">${m.icon}</div>
                <div>${m.name}</div>
            </div>
        `).join('');
        container.querySelectorAll('.quick-link-card').forEach(card => {
            card.addEventListener('click', () => App.ui.switchView(card.dataset.view));
        });
    },

    // ===== 数据卡片 =====
    renderDataCards: async function() {
        const container = document.getElementById('dataCards');
        try {
            const guests = await App.db.select('guests');
            const confirmedGuests = guests.filter(g => g.status === '确认出席');
            const totalAdults = confirmedGuests.reduce((s, g) => s + (g.adults || 0), 0);
            const totalChildren = confirmedGuests.reduce((s, g) => s + (g.children || 0), 0);
            const totalPeople = totalAdults + totalChildren;
            const estimatedTables = Math.ceil(totalPeople / 10);

            // 统计紧急待办（未采购物资 + 未完成关键流程）
            const supplies = await App.db.select('supplies');
            const urgentSupplies = supplies.filter(s => s.status === '未采购').length;
            const tasks = await App.db.select('timeline_tasks', 'sort_order');
            const urgentTasks = tasks.filter(t => t.is_key && t.status !== '已完成').length;
            const urgentCount = urgentSupplies + urgentTasks;

            container.innerHTML = `
                <div class="data-card">
                    <div class="data-card-icon">👥</div>
                    <div class="data-card-value">${totalPeople}</div>
                    <div class="data-card-label">确认出席宾客</div>
                </div>
                <div class="data-card">
                    <div class="data-card-icon">🍽️</div>
                    <div class="data-card-value">${estimatedTables}</div>
                    <div class="data-card-label">预估宴席桌数</div>
                </div>
                <div class="data-card">
                    <div class="data-card-icon">⚠️</div>
                    <div class="data-card-value">${urgentCount}</div>
                    <div class="data-card-label">紧急待办</div>
                </div>
            `;
        } catch(e) {
            console.error('[Dashboard] 数据卡片加载失败:', e);
        }
    },

    // ===== 提醒 =====
    renderReminders: function() {
        const container = document.getElementById('remindersList');
        if (this.reminders.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">暂无提醒事项</div></div>`;
            return;
        }
        container.innerHTML = this.reminders.map(r => `
            <div class="reminder-item ${r.priority}">
                <span>${r.priority === 'high' ? '🔴' : '🟡'}</span>
                <span class="reminder-text">${App.ui.escapeHtml(r.content)}</span>
                <div class="reminder-actions admin-only">
                    <button class="reminder-del" data-id="${r.id}" data-action="delete-reminder">&times;</button>
                </div>
            </div>
        `).join('');
        container.querySelectorAll('[data-action="delete-reminder"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                App.ui.confirm('确定删除这条提醒吗？', '', async () => {
                    try {
                        await App.db.delete('reminders', id);
                        await App.tracker.log('删除', '首页提醒', '');
                        App.ui.toast('已删除', 'success');
                    } catch(e) { App.ui.toast('删除失败', 'error'); }
                });
            });
        });
    },

    showReminderForm: function() {
        const bodyHtml = `
            <div class="form-group">
                <label>提醒内容</label>
                <textarea id="reminderContent" placeholder="例如：下周三去试婚纱" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>优先级</label>
                <select id="reminderPriority">
                    <option value="normal">普通</option>
                    <option value="high">重要</option>
                </select>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveReminderBtn">添加</button>
        `;
        App.ui.showModal('添加提醒', bodyHtml, footerHtml, () => {
            document.getElementById('saveReminderBtn').onclick = async () => {
                const content = document.getElementById('reminderContent').value.trim();
                const priority = document.getElementById('reminderPriority').value;
                if (!content) { App.ui.toast('请输入提醒内容', 'error'); return; }
                try {
                    await App.db.insert('reminders', {
                        content, priority,
                        sort_order: Date.now()
                    });
                    await App.tracker.log('新增', '首页提醒', content);
                    App.ui.hideModal();
                    App.ui.toast('提醒已添加', 'success');
                } catch(e) { App.ui.toast('添加失败：' + e.message, 'error'); }
            };
        });
    }
};

})();
