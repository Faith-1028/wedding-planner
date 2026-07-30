/**
 * ============================================================
 * users.js - 用户权限管理面板模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.users = {
    data: [],

    onShow: function() {
        this.load();
    },

    init: function() {
        document.getElementById('addUserBtn').addEventListener('click', () => this.showForm());
    },

    load: async function() {
        try {
            this.data = await App.db.select('app_users');
            this.render();
        } catch(e) {
            console.error('[Users] 加载失败:', e);
            App.ui.toast('加载用户数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    render: function() {
        const container = document.getElementById('usersList');

        if (this.data.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">暂无用户数据</div></div>`;
            return;
        }

        container.innerHTML = this.data.map(u => {
            const initials = (u.name || u.username || '?').charAt(0).toUpperCase();
            const isSelf = App.auth.currentUser && App.auth.currentUser.username === u.username;
            return `
            <div class="user-card ${u.status === 'disabled' ? 'disabled' : ''}" data-id="${u.id}">
                <div class="user-avatar">${initials}</div>
                <div class="user-info">
                    <div class="user-display-name">
                        ${App.ui.escapeHtml(u.name)}
                        ${isSelf ? '<span class="tag tag-champagne">我</span>' : ''}
                        ${u.role === 'admin' ? '<span class="tag tag-success">管理员</span>' : '<span class="tag tag-default">只读用户</span>'}
                        ${u.status === 'disabled' ? '<span class="tag tag-danger">已禁用</span>' : ''}
                    </div>
                    <div class="user-meta">账号: ${App.ui.escapeHtml(u.username)} · 创建于 ${App.ui.formatDate(u.created_at)}</div>
                </div>
                <div class="user-actions">
                    <button class="btn btn-sm btn-outline" data-id="${u.id}" data-action="reset-pwd">重置密码</button>
                    <button class="btn btn-sm btn-outline" data-id="${u.id}" data-action="toggle-role">
                        ${u.role === 'admin' ? '设为只读' : '设为管理员'}
                    </button>
                    ${u.username !== App.config.ADMIN_USERNAME ? `
                        <button class="btn btn-sm ${u.status === 'disabled' ? 'btn-success' : 'btn-danger'}" data-id="${u.id}" data-action="toggle-status">
                            ${u.status === 'disabled' ? '启用' : '禁用'}
                        </button>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('');

        // 绑定事件
        container.querySelectorAll('[data-action="reset-pwd"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const user = this.data.find(u => u.id === btn.dataset.id);
                if (user) this.showResetPasswordForm(user);
            });
        });
        container.querySelectorAll('[data-action="toggle-role"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const user = this.data.find(u => u.id === btn.dataset.id);
                if (user) this.toggleRole(user);
            });
        });
        container.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const user = this.data.find(u => u.id === btn.dataset.id);
                if (user) this.toggleStatus(user);
            });
        });
    },

    showForm: function() {
        const bodyHtml = `
            <div class="form-group">
                <label>账号 *</label>
                <input type="text" id="newUsername" placeholder="登录账号（英文/数字）">
                <div class="form-hint">账号创建后不可修改</div>
            </div>
            <div class="form-group">
                <label>姓名 *</label>
                <input type="text" id="newName" placeholder="用户显示名称">
            </div>
            <div class="form-group">
                <label>初始密码 *</label>
                <input type="text" id="newPassword" placeholder="初始密码" value="wedding123">
                <div class="form-hint">用户首次登录后可自行修改</div>
            </div>
            <div class="form-group">
                <label>角色</label>
                <select id="newRole">
                    <option value="viewer">普通只读用户（父母、伴郎伴娘）</option>
                    <option value="admin">超级管理员（完整权限）</option>
                </select>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveUserBtn">创建账号</button>
        `;
        App.ui.showModal('创建新账号', bodyHtml, footerHtml, () => {
            document.getElementById('saveUserBtn').onclick = async () => {
                const username = document.getElementById('newUsername').value.trim();
                const name = document.getElementById('newName').value.trim();
                const password = document.getElementById('newPassword').value;
                const role = document.getElementById('newRole').value;
                if (!username) { App.ui.toast('请输入账号', 'error'); return; }
                if (!name) { App.ui.toast('请输入姓名', 'error'); return; }
                if (!password) { App.ui.toast('请输入密码', 'error'); return; }

                // 检查是否已存在
                const existing = await App.db.selectOne('app_users', { username });
                if (existing) { App.ui.toast('该账号已存在', 'error'); return; }

                try {
                    const hash = await App.hashPassword(password);
                    await App.db.insert('app_users', {
                        username,
                        password_hash: hash,
                        name,
                        role,
                        status: 'active',
                        must_change_password: false
                    });
                    await App.tracker.log('新增', '用户管理', `创建账号「${username}」(${name}) 角色:${role==='admin'?'管理员':'只读'}`);
                    App.ui.hideModal();
                    App.ui.toast('账号创建成功', 'success');
                } catch(e) { App.ui.toast('创建失败：' + e.message, 'error'); }
            };
        });
    },

    showResetPasswordForm: function(user) {
        const bodyHtml = `
            <div class="form-group">
                <label>为「${App.ui.escapeHtml(user.name)}」重置密码</label>
                <input type="text" id="newResetPassword" placeholder="输入新密码" value="wedding123">
                <div class="form-hint">请将新密码告知该用户</div>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="confirmResetPwdBtn">确认重置</button>
        `;
        App.ui.showModal('重置密码', bodyHtml, footerHtml, () => {
            document.getElementById('confirmResetPwdBtn').onclick = async () => {
                const newPwd = document.getElementById('newResetPassword').value;
                if (!newPwd) { App.ui.toast('请输入新密码', 'error'); return; }
                try {
                    await App.auth.changePassword(user.username, newPwd);
                    await App.tracker.log('编辑', '用户管理', `重置「${user.username}」的密码`);
                    App.ui.hideModal();
                    App.ui.toast('密码已重置', 'success');
                } catch(e) { App.ui.toast('重置失败：' + e.message, 'error'); }
            };
        });
    },

    toggleRole: async function(user) {
        const newRole = user.role === 'admin' ? 'viewer' : 'admin';
        const roleName = newRole === 'admin' ? '管理员' : '只读用户';
        App.ui.confirm(`确定将「${user.name}」的角色改为${roleName}吗？`, '', async () => {
            try {
                await App.db.update('app_users', user.id, { role: newRole });
                await App.tracker.log('编辑', '用户管理', `修改「${user.username}」角色为${roleName}`);
                App.ui.toast('角色已更新', 'success');
            } catch(e) { App.ui.toast('更新失败', 'error'); }
        });
    },

    toggleStatus: async function(user) {
        const newStatus = user.status === 'disabled' ? 'active' : 'disabled';
        const action = newStatus === 'disabled' ? '禁用' : '启用';
        App.ui.confirm(`确定${action}账号「${user.name}」吗？`, '', async () => {
            try {
                await App.db.update('app_users', user.id, { status: newStatus });
                await App.tracker.log('编辑', '用户管理', `${action}账号「${user.username}」`);
                App.ui.toast(`已${action}`, 'success');
            } catch(e) { App.ui.toast('操作失败', 'error'); }
        });
    }
};

})();
