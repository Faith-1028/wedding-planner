/**
 * ============================================================
 * guests.js - 宾客名单管理模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.guests = {
    data: [],
    filterGroup: '',
    filterStatus: '',

    onShow: function() {
        if (this.data.length === 0) this.load();
    },

    init: function() {
        document.getElementById('addGuestBtn').addEventListener('click', () => this.showForm());
        document.getElementById('guestCopyBtn').addEventListener('click', () => this.copyList());
    },

    load: async function() {
        try {
            this.data = await App.db.select('guests', 'sort_order');
            this.renderFilters();
            this.render();
        } catch(e) {
            console.error('[Guests] 加载失败:', e);
            App.ui.toast('加载宾客数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    renderFilters: function() {
        const container = document.getElementById('guestFilters');
        container.innerHTML = `
            <select id="filterGroup">
                <option value="">全部分组</option>
                ${App.config.GUEST_GROUPS.map(g => `<option value="${g}" ${this.filterGroup===g?'selected':''}>${g}</option>`).join('')}
            </select>
            <select id="filterStatus">
                <option value="">全部状态</option>
                ${App.config.GUEST_STATUSES.map(s => `<option value="${s}" ${this.filterStatus===s?'selected':''}>${s}</option>`).join('')}
            </select>
        `;
        document.getElementById('filterGroup').addEventListener('change', (e) => {
            this.filterGroup = e.target.value;
            this.render();
        });
        document.getElementById('filterStatus').addEventListener('change', (e) => {
            this.filterStatus = e.target.value;
            this.render();
        });
    },

    getFiltered: function() {
        return this.data.filter(g => {
            if (this.filterGroup && g.group_type !== this.filterGroup) return false;
            if (this.filterStatus && g.status !== this.filterStatus) return false;
            return true;
        });
    },

    render: function() {
        this.renderStats();
        const container = document.getElementById('guestsList');
        const filtered = this.getFiltered();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <div class="empty-state-text">暂无宾客记录，点击「新增宾客」开始添加</div>
                </div>
            `;
            return;
        }

        const statusTagClass = {
            '待邀请': 'tag-default',
            '已邀请': 'tag-info',
            '确认出席': 'tag-success',
            '无法到场': 'tag-danger'
        };

        container.innerHTML = filtered.map(g => {
            const totalPeople = (g.adults || 0) + (g.children || 0);
            return `
            <div class="guest-card" data-id="${g.id}">
                <div class="guest-name">${App.ui.escapeHtml(g.name)}</div>
                <div class="guest-info">
                    <span class="tag tag-champagne">${App.ui.escapeHtml(g.group_type)}</span>
                    <span class="tag ${statusTagClass[g.status] || 'tag-default'}">${g.status}</span>
                    <span class="guest-meta">成人${g.adults||0} · 儿童${g.children||0} · 共${totalPeople}人</span>
                    ${g.dietary ? `<span class="guest-meta">🍽️ ${App.ui.escapeHtml(g.dietary)}</span>` : ''}
                </div>
                <div class="guest-actions admin-only">
                    <button class="btn-edit" data-id="${g.id}" data-action="edit-guest">编辑</button>
                    <button class="btn-del" data-id="${g.id}" data-action="del-guest">删除</button>
                </div>
            </div>
            `;
        }).join('');

        // 绑定事件
        container.querySelectorAll('[data-action="edit-guest"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const guest = this.data.find(g => g.id === btn.dataset.id);
                if (guest) this.showForm(guest);
            });
        });
        container.querySelectorAll('[data-action="del-guest"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const guest = this.data.find(g => g.id === btn.dataset.id);
                if (guest) this.deleteGuest(guest);
            });
        });
    },

    renderStats: function() {
        const confirmed = this.data.filter(g => g.status === '确认出席');
        const totalAdults = confirmed.reduce((s, g) => s + (g.adults || 0), 0);
        const totalChildren = confirmed.reduce((s, g) => s + (g.children || 0), 0);
        const totalPeople = totalAdults + totalChildren;
        const tables = Math.ceil(totalPeople / 10);

        const container = document.getElementById('guestStats');
        container.innerHTML = `
            <div class="stat-pill">👥 总宾客 <strong>${this.data.length}</strong></div>
            <div class="stat-pill">✅ 确认出席 <strong>${totalPeople}</strong> 人</div>
            <div class="stat-pill">🍽️ 预估桌数 <strong>${tables}</strong> 桌</div>
            <div class="stat-pill">👶 儿童 <strong>${totalChildren}</strong> 人</div>
        `;
    },

    showForm: function(guest) {
        const isEdit = !!guest;
        const g = guest || { name: '', group_type: '好友', adults: 1, children: 0, dietary: '', status: '待邀请' };
        const bodyHtml = `
            <div class="form-group">
                <label>姓名 *</label>
                <input type="text" id="guestName" value="${App.ui.attr(g.name)}" placeholder="宾客姓名">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>所属人群</label>
                    <select id="guestGroup">
                        ${App.config.GUEST_GROUPS.map(grp => `<option value="${grp}" ${g.group_type===grp?'selected':''}>${grp}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select id="guestStatus">
                        ${App.config.GUEST_STATUSES.map(s => `<option value="${s}" ${g.status===s?'selected':''}>${s}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>成人数量</label>
                    <input type="number" id="guestAdults" value="${g.adults||0}" min="0">
                </div>
                <div class="form-group">
                    <label>儿童数量</label>
                    <input type="number" id="guestChildren" value="${g.children||0}" min="0">
                </div>
            </div>
            <div class="form-group">
                <label>饮食忌口</label>
                <input type="text" id="guestDietary" value="${App.ui.attr(g.dietary)}" placeholder="如：素食、不吃海鲜、花生过敏等">
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveGuestBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑宾客' : '新增宾客', bodyHtml, footerHtml, () => {
            document.getElementById('saveGuestBtn').onclick = async () => {
                const name = document.getElementById('guestName').value.trim();
                if (!name) { App.ui.toast('请输入姓名', 'error'); return; }
                const payload = {
                    name,
                    group_type: document.getElementById('guestGroup').value,
                    status: document.getElementById('guestStatus').value,
                    adults: parseInt(document.getElementById('guestAdults').value) || 0,
                    children: parseInt(document.getElementById('guestChildren').value) || 0,
                    dietary: document.getElementById('guestDietary').value.trim()
                };
                try {
                    if (isEdit) {
                        await App.db.update('guests', g.id, payload);
                        await App.tracker.log('编辑', '宾客管理', `修改宾客「${name}」信息`);
                    } else {
                        payload.sort_order = Date.now();
                        await App.db.insert('guests', payload);
                        await App.tracker.log('新增', '宾客管理', `新增宾客「${name}」`);
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已添加', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteGuest: function(guest) {
        App.ui.confirm(`确定删除宾客「${guest.name}」吗？`, '此操作不可撤销', async () => {
            try {
                await App.db.delete('guests', guest.id);
                await App.tracker.log('删除', '宾客管理', `删除宾客「${guest.name}」`);
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    copyList: function() {
        if (this.data.length === 0) { App.ui.toast('暂无宾客数据', 'error'); return; }
        let text = '═══ 婚礼宾客名单 ═══\n\n';
        const groups = {};
        this.data.forEach(g => {
            if (!groups[g.group_type]) groups[g.group_type] = [];
            groups[g.group_type].push(g);
        });
        Object.keys(groups).forEach(group => {
            text += `【${group}】\n`;
            groups[group].forEach(g => {
                const total = (g.adults||0) + (g.children||0);
                text += `  ${g.name} - ${g.status} (成人${g.adults||0}/儿童${g.children||0}/共${total}人)`;
                if (g.dietary) text += ` [忌口: ${g.dietary}]`;
                text += '\n';
            });
            text += '\n';
        });
        const confirmed = this.data.filter(g => g.status === '确认出席');
        const totalPeople = confirmed.reduce((s, g) => s + (g.adults||0) + (g.children||0), 0);
        text += `──────────────\n确认出席: ${totalPeople}人 · 预估桌数: ${Math.ceil(totalPeople/10)}桌`;
        App.ui.copyText(text);
    }
};

})();
