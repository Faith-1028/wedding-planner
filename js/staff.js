/**
 * ============================================================
 * staff.js - 工作人员联络清单模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.staff = {
    data: [],
    filterCategory: '',

    onShow: function() {
        if (this.data.length === 0) this.load();
    },

    init: function() {
        document.getElementById('addStaffBtn').addEventListener('click', () => this.showForm());
        document.getElementById('staffCopyBtn').addEventListener('click', () => this.copyList());
    },

    load: async function() {
        try {
            this.data = await App.db.select('staff_contacts', 'sort_order');
            this.renderFilters();
            this.render();
        } catch(e) {
            console.error('[Staff] 加载失败:', e);
            App.ui.toast('加载工作人员数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    renderFilters: function() {
        const container = document.getElementById('staffFilters');
        container.innerHTML = `
            <select id="staffFilterCategory">
                <option value="">全部分类</option>
                ${App.config.STAFF_CATEGORIES.map(c =>
                    `<option value="${c}" ${this.filterCategory===c?'selected':''}>${c}</option>`
                ).join('')}
            </select>
        `;
        document.getElementById('staffFilterCategory').addEventListener('change', (e) => {
            this.filterCategory = e.target.value;
            this.render();
        });
    },

    getFiltered: function() {
        if (!this.filterCategory) return this.data;
        return this.data.filter(s => s.category === this.filterCategory);
    },

    render: function() {
        const container = document.getElementById('staffList');
        const filtered = this.getFiltered();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👷</div>
                    <div class="empty-state-text">暂无工作人员信息，点击「新增人员」开始添加</div>
                </div>
            `;
            return;
        }

        const catClassMap = { '四大金刚': 'cat-金刚', '伴郎伴娘': 'cat-伴', '婚庆工作人员': 'cat-婚庆', '双方家人': 'cat-家人' };

        container.innerHTML = filtered.map(s => `
            <div class="staff-contact-card" data-id="${s.id}">
                <div class="staff-contact-header">
                    <span class="staff-contact-name">${App.ui.escapeHtml(s.name)}</span>
                    <span class="staff-contact-category ${catClassMap[s.category]||''}">${App.ui.escapeHtml(s.category)}</span>
                </div>
                <div class="staff-contact-info">
                    ${s.role_desc ? `<div class="info-row"><span class="info-label">岗位</span>${App.ui.escapeHtml(s.role_desc)}</div>` : ''}
                    ${s.phone ? `<div class="info-row"><span class="info-label">电话</span><a class="staff-contact-phone" href="tel:${App.ui.escapeHtml(s.phone)}">${App.ui.escapeHtml(s.phone)}</a></div>` : ''}
                    ${s.wechat ? `<div class="info-row"><span class="info-label">微信</span>${App.ui.escapeHtml(s.wechat)}</div>` : ''}
                    ${s.remarks ? `<div class="info-row"><span class="info-label">备注</span>${App.ui.escapeHtml(s.remarks)}</div>` : ''}
                </div>
                <div class="staff-contact-actions admin-only">
                    <button class="btn btn-sm btn-outline" data-id="${s.id}" data-action="edit-staff">编辑</button>
                    <button class="btn btn-sm btn-danger" data-id="${s.id}" data-action="del-staff">删除</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-action="edit-staff"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(s => s.id === btn.dataset.id);
                if (item) this.showForm(item);
            });
        });
        container.querySelectorAll('[data-action="del-staff"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(s => s.id === btn.dataset.id);
                if (item) this.deleteItem(item);
            });
        });
    },

    showForm: function(item) {
        const isEdit = !!item;
        const s = item || { name: '', category: '四大金刚', role_desc: '', phone: '', wechat: '', remarks: '' };
        const bodyHtml = `
            <div class="form-row">
                <div class="form-group">
                    <label>姓名 *</label>
                    <input type="text" id="staffName" value="${App.ui.attr(s.name)}" placeholder="工作人员姓名">
                </div>
                <div class="form-group">
                    <label>人员分类</label>
                    <select id="staffCategory">
                        ${App.config.STAFF_CATEGORIES.map(c =>
                            `<option value="${c}" ${s.category===c?'selected':''}>${c}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>联系电话</label>
                    <input type="tel" id="staffPhone" value="${App.ui.attr(s.phone)}" placeholder="手机号码">
                </div>
                <div class="form-group">
                    <label>微信号</label>
                    <input type="text" id="staffWechat" value="${App.ui.attr(s.wechat)}" placeholder="微信号">
                </div>
            </div>
            <div class="form-group">
                <label>岗位职责</label>
                <input type="text" id="staffRole" value="${App.ui.attr(s.role_desc)}" placeholder="如 摄影师 / 伴郎 / 婚车队长">
            </div>
            <div class="form-group">
                <label>备注信息</label>
                <textarea id="staffRemarks" rows="2" placeholder="其他补充信息">${App.ui.attr(s.remarks)}</textarea>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveStaffBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑工作人员' : '新增工作人员', bodyHtml, footerHtml, () => {
            document.getElementById('saveStaffBtn').onclick = async () => {
                const name = document.getElementById('staffName').value.trim();
                if (!name) { App.ui.toast('请输入姓名', 'error'); return; }
                const payload = {
                    name,
                    category: document.getElementById('staffCategory').value,
                    phone: document.getElementById('staffPhone').value.trim(),
                    wechat: document.getElementById('staffWechat').value.trim(),
                    role_desc: document.getElementById('staffRole').value.trim(),
                    remarks: document.getElementById('staffRemarks').value.trim()
                };
                try {
                    if (isEdit) {
                        await App.db.update('staff_contacts', s.id, payload);
                        await App.tracker.log('编辑', '工作人员清单', `修改人员「${name}」`);
                    } else {
                        payload.sort_order = Date.now();
                        await App.db.insert('staff_contacts', payload);
                        await App.tracker.log('新增', '工作人员清单', `新增人员「${name}」`);
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已添加', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteItem: function(item) {
        App.ui.confirm(`确定删除「${item.name}」吗？`, '此操作不可撤销', async () => {
            try {
                await App.db.delete('staff_contacts', item.id);
                await App.tracker.log('删除', '工作人员清单', `删除人员「${item.name}」`);
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    copyList: function() {
        if (this.data.length === 0) { App.ui.toast('暂无工作人员数据', 'error'); return; }
        let text = '═══ 婚礼工作人员联络清单 ═══\n\n';
        App.config.STAFF_CATEGORIES.forEach(cat => {
            const members = this.data.filter(s => s.category === cat);
            if (members.length === 0) return;
            text += `【${cat}】\n`;
            members.forEach((s, i) => {
                text += `  ${i+1}. ${s.name}`;
                if (s.role_desc) text += ` - ${s.role_desc}`;
                if (s.phone) text += `  📞 ${s.phone}`;
                if (s.wechat) text += `  微信: ${s.wechat}`;
                text += '\n';
            });
            text += '\n';
        });
        App.ui.copyText(text);
    }
};

})();
