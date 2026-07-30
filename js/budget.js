/**
 * ============================================================
 * budget.js - 婚礼预算管理模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.budget = {
    data: [],

    onShow: function() {
        if (this.data.length === 0) this.load();
    },

    init: function() {
        document.getElementById('addBudgetBtn').addEventListener('click', () => this.showForm());
        document.getElementById('budgetCopyBtn').addEventListener('click', () => this.copyList());
    },

    load: async function() {
        try {
            this.data = await App.db.select('budget_items', 'sort_order');
            this.render();
        } catch(e) {
            console.error('[Budget] 加载失败:', e);
            App.ui.toast('加载预算数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    render: function() {
        this.renderSummary();
        const container = document.getElementById('budgetList');

        if (this.data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">💰</div>
                    <div class="empty-state-text">暂无预算记录，点击「新增预算项」开始添加</div>
                </div>
            `;
            return;
        }

        // 按分类分组
        const groups = {};
        this.data.forEach(b => {
            const cat = b.category || '其他';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(b);
        });

        let html = '';
        Object.keys(groups).forEach(cat => {
            const catBudget = groups[cat].reduce((s, b) => s + (parseFloat(b.budget_amount) || 0), 0);
            const catActual = groups[cat].reduce((s, b) => s + (parseFloat(b.actual_amount) || 0), 0);
            html += `<div class="budget-group">
                <div class="budget-group-header">
                    <span>${cat}</span>
                    <span class="budget-group-total">预算 ¥${App.ui.formatMoney(catBudget)} · 实际 ¥${App.ui.formatMoney(catActual)}</span>
                </div>`;
            groups[cat].forEach(b => {
                const overBudget = (parseFloat(b.actual_amount) || 0) > (parseFloat(b.budget_amount) || 0);
                html += `
                <div class="budget-item" data-id="${b.id}">
                    <div class="budget-item-name">${App.ui.escapeHtml(b.item_name)}</div>
                    <div class="budget-amounts">
                        <span><span class="budget-amount-label">预算:</span> <span class="budget-amount-value">¥${App.ui.formatMoney(b.budget_amount)}</span></span>
                        <span><span class="budget-amount-label">实际:</span> <span class="budget-amount-value ${overBudget?'text-danger':''}">¥${App.ui.formatMoney(b.actual_amount)}</span></span>
                        ${b.remarks ? `<span class="budget-amount-label">📝 ${App.ui.escapeHtml(b.remarks)}</span>` : ''}
                    </div>
                    <div class="budget-actions admin-only">
                        <button class="btn btn-sm btn-outline" data-id="${b.id}" data-action="edit-budget">编辑</button>
                        <button class="btn btn-sm btn-danger" data-id="${b.id}" data-action="del-budget">删除</button>
                    </div>
                </div>`;
            });
            html += `</div>`;
        });
        container.innerHTML = html;

        // 绑定事件
        container.querySelectorAll('[data-action="edit-budget"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(b => b.id === btn.dataset.id);
                if (item) this.showForm(item);
            });
        });
        container.querySelectorAll('[data-action="del-budget"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(b => b.id === btn.dataset.id);
                if (item) this.deleteItem(item);
            });
        });
    },

    renderSummary: function() {
        const totalBudget = this.data.reduce((s, b) => s + (parseFloat(b.budget_amount) || 0), 0);
        const totalActual = this.data.reduce((s, b) => s + (parseFloat(b.actual_amount) || 0), 0);
        const remaining = totalBudget - totalActual;
        const container = document.getElementById('budgetSummary');
        container.innerHTML = `
            <div class="budget-summary-card">
                <div class="budget-summary-label">总预算</div>
                <div class="budget-summary-value total">¥${App.ui.formatMoney(totalBudget)}</div>
            </div>
            <div class="budget-summary-card">
                <div class="budget-summary-label">已花费</div>
                <div class="budget-summary-value spent">¥${App.ui.formatMoney(totalActual)}</div>
            </div>
            <div class="budget-summary-card">
                <div class="budget-summary-label">剩余预算</div>
                <div class="budget-summary-value remaining">¥${App.ui.formatMoney(remaining)}</div>
            </div>
        `;
    },

    showForm: function(item) {
        const isEdit = !!item;
        const b = item || { category: '婚宴酒席', item_name: '', budget_amount: 0, actual_amount: 0, remarks: '' };
        const bodyHtml = `
            <div class="form-row">
                <div class="form-group">
                    <label>分类</label>
                    <select id="budgetCategory">
                        ${App.config.BUDGET_CATEGORIES.map(c => `<option value="${c}" ${b.category===c?'selected':''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>项目名称 *</label>
                    <input type="text" id="budgetItemName" value="${App.ui.attr(b.item_name)}" placeholder="如 婚宴酒席">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>预算金额（元）</label>
                    <input type="number" id="budgetAmount" value="${b.budget_amount||0}" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label>实际花费（元）</label>
                    <input type="number" id="actualAmount" value="${b.actual_amount||0}" min="0" step="0.01">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="budgetRemarks" rows="2" placeholder="补充说明">${App.ui.attr(b.remarks)}</textarea>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveBudgetBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑预算项' : '新增预算项', bodyHtml, footerHtml, () => {
            document.getElementById('saveBudgetBtn').onclick = async () => {
                const itemName = document.getElementById('budgetItemName').value.trim();
                if (!itemName) { App.ui.toast('请输入项目名称', 'error'); return; }
                const payload = {
                    category: document.getElementById('budgetCategory').value,
                    item_name: itemName,
                    budget_amount: parseFloat(document.getElementById('budgetAmount').value) || 0,
                    actual_amount: parseFloat(document.getElementById('actualAmount').value) || 0,
                    remarks: document.getElementById('budgetRemarks').value.trim()
                };
                try {
                    if (isEdit) {
                        await App.db.update('budget_items', b.id, payload);
                        await App.tracker.log('编辑', '婚礼预算', `修改预算项「${itemName}」`);
                    } else {
                        payload.sort_order = Date.now();
                        await App.db.insert('budget_items', payload);
                        await App.tracker.log('新增', '婚礼预算', `新增预算项「${itemName}」`);
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已添加', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteItem: function(item) {
        App.ui.confirm(`确定删除预算项「${item.item_name}」吗？`, '此操作不可撤销', async () => {
            try {
                await App.db.delete('budget_items', item.id);
                await App.tracker.log('删除', '婚礼预算', `删除预算项「${item.item_name}」`);
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    copyList: function() {
        if (this.data.length === 0) { App.ui.toast('暂无预算数据', 'error'); return; }
        const totalBudget = this.data.reduce((s, b) => s + (parseFloat(b.budget_amount) || 0), 0);
        const totalActual = this.data.reduce((s, b) => s + (parseFloat(b.actual_amount) || 0), 0);
        let text = '═══ 婚礼预算明细 ═══\n\n';
        const groups = {};
        this.data.forEach(b => {
            const cat = b.category || '其他';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(b);
        });
        Object.keys(groups).forEach(cat => {
            text += `【${cat}】\n`;
            groups[cat].forEach(b => {
                text += `  ${b.item_name}: 预算¥${App.ui.formatMoney(b.budget_amount)} / 实际¥${App.ui.formatMoney(b.actual_amount)}`;
                if (b.remarks) text += ` (${b.remarks})`;
                text += '\n';
            });
            text += '\n';
        });
        text += `──────────────\n总预算: ¥${App.ui.formatMoney(totalBudget)}\n已花费: ¥${App.ui.formatMoney(totalActual)}\n剩余: ¥${App.ui.formatMoney(totalBudget - totalActual)}`;
        App.ui.copyText(text);
    }
};

})();
