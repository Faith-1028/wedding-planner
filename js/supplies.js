/**
 * ============================================================
 * supplies.js - 备婚物资清单模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.supplies = {
    data: [],
    filterCategory: '',
    filterStatus: '',

    onShow: function() {
        if (this.data.length === 0) this.load();
    },

    init: function() {
        document.getElementById('addSupplyBtn').addEventListener('click', () => this.showForm());
        document.getElementById('suppliesCopyBtn').addEventListener('click', () => this.copyList());
    },

    load: async function() {
        try {
            this.data = await App.db.select('supplies', 'sort_order');
            this.renderFilters();
            this.render();
        } catch(e) {
            console.error('[Supplies] 加载失败:', e);
            App.ui.toast('加载物资数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    renderFilters: function() {
        const container = document.getElementById('supplyFilters');
        container.innerHTML = `
            <select id="supplyFilterCategory">
                <option value="">全部分类</option>
                ${App.config.SUPPLY_CATEGORIES.map(c => `<option value="${c}" ${this.filterCategory===c?'selected':''}>${c}</option>`).join('')}
            </select>
            <select id="supplyFilterStatus">
                <option value="">全部状态</option>
                ${App.config.SUPPLY_STATUSES.map(s => `<option value="${s}" ${this.filterStatus===s?'selected':''}>${s}</option>`).join('')}
            </select>
        `;
        document.getElementById('supplyFilterCategory').addEventListener('change', (e) => {
            this.filterCategory = e.target.value; this.render();
        });
        document.getElementById('supplyFilterStatus').addEventListener('change', (e) => {
            this.filterStatus = e.target.value; this.render();
        });
    },

    getFiltered: function() {
        return this.data.filter(s => {
            if (this.filterCategory && s.category !== this.filterCategory) return false;
            if (this.filterStatus && s.status !== this.filterStatus) return false;
            return true;
        });
    },

    render: function() {
        this.renderStats();
        const container = document.getElementById('suppliesList');
        const filtered = this.getFiltered();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-text">暂无物资记录，点击「新增物资」开始添加</div>
                </div>
            `;
            return;
        }

        // 按分类分组
        const groups = {};
        filtered.forEach(s => {
            const cat = s.category || '其他';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        });

        const statusTag = {
            '未采购': 'tag-warning',
            '已采购': 'tag-info',
            '已打包': 'tag-success'
        };

        let html = '';
        Object.keys(groups).forEach(cat => {
            html += `<div class="supply-group">
                <div class="supply-group-title">${cat}</div>`;
            groups[cat].forEach(s => {
                html += `
                <div class="supply-card" data-id="${s.id}">
                    <span class="tag ${statusTag[s.status] || 'tag-default'}">${s.status}</span>
                    <div class="supply-name">${App.ui.escapeHtml(s.name)}</div>
                    ${s.quantity ? `<span class="supply-qty">×${App.ui.escapeHtml(s.quantity)}</span>` : ''}
                    ${s.purchase_channel ? `<span class="supply-channel">🛒 ${App.ui.escapeHtml(s.purchase_channel)}</span>` : ''}
                    ${s.remarks ? `<span class="supply-remarks">📝 ${App.ui.escapeHtml(s.remarks)}</span>` : ''}
                    <div class="supply-actions admin-only">
                        <button class="btn btn-sm btn-outline" data-id="${s.id}" data-action="edit-supply">编辑</button>
                        <button class="btn btn-sm btn-danger" data-id="${s.id}" data-action="del-supply">删除</button>
                    </div>
                </div>`;
            });
            html += `</div>`;
        });
        container.innerHTML = html;

        // 绑定事件
        container.querySelectorAll('[data-action="edit-supply"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(s => s.id === btn.dataset.id);
                if (item) this.showForm(item);
            });
        });
        container.querySelectorAll('[data-action="del-supply"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(s => s.id === btn.dataset.id);
                if (item) this.deleteItem(item);
            });
        });
    },

    renderStats: function() {
        const total = this.data.length;
        const unpurchased = this.data.filter(s => s.status === '未采购').length;
        const purchased = this.data.filter(s => s.status === '已采购').length;
        const packed = this.data.filter(s => s.status === '已打包').length;
        const container = document.getElementById('supplyStats');
        container.innerHTML = `
            <div class="stat-pill">📦 总物资 <strong>${total}</strong></div>
            <div class="stat-pill">🟡 未采购 <strong>${unpurchased}</strong></div>
            <div class="stat-pill">🔵 已采购 <strong>${purchased}</strong></div>
            <div class="stat-pill">✅ 已打包 <strong>${packed}</strong></div>
        `;
    },

    showForm: function(item) {
        const isEdit = !!item;
        const s = item || { name: '', quantity: '', category: '其他', purchase_channel: '', remarks: '', status: '未采购' };
        const bodyHtml = `
            <div class="form-row">
                <div class="form-group">
                    <label>物品名称 *</label>
                    <input type="text" id="supplyName" value="${App.ui.attr(s.name)}" placeholder="如 喜糖盒">
                </div>
                <div class="form-group">
                    <label>数量</label>
                    <input type="text" id="supplyQty" value="${App.ui.attr(s.quantity)}" placeholder="如 200个">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>分类</label>
                    <select id="supplyCategory">
                        ${App.config.SUPPLY_CATEGORIES.map(c => `<option value="${c}" ${s.category===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>状态</label>
                    <select id="supplyStatus">
                        ${App.config.SUPPLY_STATUSES.map(st => `<option value="${st}" ${s.status===st?'selected':''}>${st}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label>采购渠道</label>
                <input type="text" id="supplyChannel" value="${App.ui.attr(s.purchase_channel)}" placeholder="如 淘宝/拼多多/线下">
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="supplyRemarks" rows="2" placeholder="补充说明">${App.ui.attr(s.remarks)}</textarea>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveSupplyBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑物资' : '新增物资', bodyHtml, footerHtml, () => {
            document.getElementById('saveSupplyBtn').onclick = async () => {
                const name = document.getElementById('supplyName').value.trim();
                if (!name) { App.ui.toast('请输入物品名称', 'error'); return; }
                const payload = {
                    name,
                    quantity: document.getElementById('supplyQty').value.trim(),
                    category: document.getElementById('supplyCategory').value,
                    status: document.getElementById('supplyStatus').value,
                    purchase_channel: document.getElementById('supplyChannel').value.trim(),
                    remarks: document.getElementById('supplyRemarks').value.trim()
                };
                try {
                    if (isEdit) {
                        await App.db.update('supplies', s.id, payload);
                        await App.tracker.log('编辑', '备婚物资', `修改物资「${name}」`);
                    } else {
                        payload.sort_order = Date.now();
                        await App.db.insert('supplies', payload);
                        await App.tracker.log('新增', '备婚物资', `新增物资「${name}」`);
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
                await App.db.delete('supplies', item.id);
                await App.tracker.log('删除', '备婚物资', `删除物资「${item.name}」`);
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    copyList: function() {
        if (this.data.length === 0) { App.ui.toast('暂无物资数据', 'error'); return; }
        let text = '═══ 备婚物资清单 ═══\n\n';
        const groups = {};
        this.data.forEach(s => {
            const cat = s.category || '其他';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(s);
        });
        Object.keys(groups).forEach(cat => {
            text += `【${cat}】\n`;
            groups[cat].forEach(s => {
                text += `  ${s.name}`;
                if (s.quantity) text += ` ×${s.quantity}`;
                text += ` [${s.status}]`;
                if (s.purchase_channel) text += ` (${s.purchase_channel})`;
                if (s.remarks) text += ` - ${s.remarks}`;
                text += '\n';
            });
            text += '\n';
        });
        const packed = this.data.filter(s => s.status === '已打包').length;
        text += `──────────────\n共 ${this.data.length} 项 · 已打包 ${packed} 项`;
        App.ui.copyText(text);
    }
};

})();
