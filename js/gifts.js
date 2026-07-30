/**
 * ============================================================
 * gifts.js - 礼金记账模块（高隐私 · 仅管理员可见）
 * ============================================================
 * 数据变更写入操作日志，但不向普通用户推送弹窗通知
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.gifts = {
    data: [],

    onShow: function() {
        this.load();
    },

    init: function() {
        document.getElementById('addGiftBtn').addEventListener('click', () => this.showForm());
        document.getElementById('giftsCopyBtn').addEventListener('click', () => this.copyList());
    },

    load: async function() {
        try {
            this.data = await App.db.select('gifts', 'sort_order');
            this.renderSummary();
            this.render();
        } catch(e) {
            console.error('[Gifts] 加载失败:', e);
            App.ui.toast('加载礼金数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    renderSummary: function() {
        const container = document.getElementById('giftsSummary');
        const totalAmount = this.data.reduce((s, g) => s + (Number(g.amount) || 0), 0);
        const groomAmount = this.data.filter(g => g.group_type === '男方亲友').reduce((s, g) => s + (Number(g.amount) || 0), 0);
        const brideAmount = this.data.filter(g => g.group_type === '女方亲友').reduce((s, g) => s + (Number(g.amount) || 0), 0);
        const count = this.data.length;

        container.innerHTML = `
            <div class="gifts-summary-card total">
                <div class="gifts-summary-label">礼金总收入</div>
                <div class="gifts-summary-value"><span class="currency">¥</span>${App.ui.formatMoney(totalAmount)}</div>
            </div>
            <div class="gifts-summary-card groom">
                <div class="gifts-summary-label">男方亲友合计</div>
                <div class="gifts-summary-value"><span class="currency">¥</span>${App.ui.formatMoney(groomAmount)}</div>
            </div>
            <div class="gifts-summary-card bride">
                <div class="gifts-summary-label">女方亲友合计</div>
                <div class="gifts-summary-value"><span class="currency">¥</span>${App.ui.formatMoney(brideAmount)}</div>
            </div>
            <div class="gifts-summary-card count">
                <div class="gifts-summary-label">记录总数</div>
                <div class="gifts-summary-value">${count}<span class="currency"> 条</span></div>
            </div>
        `;
    },

    render: function() {
        const container = document.getElementById('giftsList');

        if (this.data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🧧</div>
                    <div class="empty-state-text">暂无礼金记录，点击「新增记录」开始记账</div>
                </div>
            `;
            return;
        }

        const sorted = [...this.data].sort((a, b) => {
            const da = a.received_date ? new Date(a.received_date) : new Date(0);
            const db = b.received_date ? new Date(b.received_date) : new Date(0);
            return db - da;
        });

        container.innerHTML = sorted.map(g => `
            <div class="gift-item" data-id="${g.id}">
                <span class="gift-item-name">${App.ui.escapeHtml(g.guest_name)}</span>
                <span class="gift-item-group ${g.group_type||''}">${App.ui.escapeHtml(g.group_type || '')}</span>
                ${g.amount > 0 ? `<span class="gift-item-amount">¥${App.ui.formatMoney(g.amount)}</span>` : ''}
                ${g.gift_item ? `<span class="gift-item-gift">🎁 ${App.ui.escapeHtml(g.gift_item)}</span>` : ''}
                ${g.received_date ? `<span class="gift-item-date">${App.ui.formatDate(g.received_date)}</span>` : ''}
                ${g.remarks ? `<span class="gift-item-date">${App.ui.escapeHtml(g.remarks)}</span>` : ''}
                <div class="gift-item-actions">
                    <button class="btn btn-sm btn-outline" data-id="${g.id}" data-action="edit-gift">编辑</button>
                    <button class="btn btn-sm btn-danger" data-id="${g.id}" data-action="del-gift">删除</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-action="edit-gift"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(g => g.id === btn.dataset.id);
                if (item) this.showForm(item);
            });
        });
        container.querySelectorAll('[data-action="del-gift"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(g => g.id === btn.dataset.id);
                if (item) this.deleteItem(item);
            });
        });
    },

    showForm: function(item) {
        const isEdit = !!item;
        const g = item || { guest_name: '', group_type: '男方亲友', amount: 0, gift_item: '', received_date: '', remarks: '' };
        let dateVal = '';
        if (g.received_date) {
            const d = new Date(g.received_date);
            if (!isNaN(d)) dateVal = d.toISOString().slice(0, 10);
        }
        const bodyHtml = `
            <div class="form-row">
                <div class="form-group">
                    <label>来宾姓名 *</label>
                    <input type="text" id="giftGuestName" value="${App.ui.attr(g.guest_name)}" placeholder="来宾姓名">
                </div>
                <div class="form-group">
                    <label>归属</label>
                    <select id="giftGroupType">
                        <option value="男方亲友" ${g.group_type==='男方亲友'?'selected':''}>男方亲友</option>
                        <option value="女方亲友" ${g.group_type==='女方亲友'?'selected':''}>女方亲友</option>
                    </select>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>礼金金额 (元)</label>
                    <input type="number" id="giftAmount" value="${g.amount||0}" min="0" step="0.01" placeholder="0">
                </div>
                <div class="form-group">
                    <label>收款日期</label>
                    <input type="date" id="giftDate" value="${dateVal}">
                </div>
            </div>
            <div class="form-group">
                <label>实物礼品（如有）</label>
                <input type="text" id="giftItem" value="${App.ui.attr(g.gift_item)}" placeholder="如 金条/手表/礼品卡">
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="giftRemarks" rows="2" placeholder="补充说明">${App.ui.attr(g.remarks)}</textarea>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveGiftBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑礼金记录' : '新增礼金记录', bodyHtml, footerHtml, () => {
            document.getElementById('saveGiftBtn').onclick = async () => {
                const guestName = document.getElementById('giftGuestName').value.trim();
                if (!guestName) { App.ui.toast('请输入来宾姓名', 'error'); return; }
                const payload = {
                    guest_name: guestName,
                    group_type: document.getElementById('giftGroupType').value,
                    amount: parseFloat(document.getElementById('giftAmount').value) || 0,
                    gift_item: document.getElementById('giftItem').value.trim(),
                    received_date: document.getElementById('giftDate').value || null,
                    remarks: document.getElementById('giftRemarks').value.trim()
                };
                try {
                    if (isEdit) {
                        await App.db.update('gifts', g.id, payload);
                        // 静默记录日志，不推送通知
                        await App.tracker.log('编辑', '礼金记账', `修改「${guestName}」的礼金记录`, { silent: true });
                    } else {
                        payload.sort_order = Date.now();
                        await App.db.insert('gifts', payload);
                        await App.tracker.log('新增', '礼金记账', `新增「${guestName}」的礼金记录`, { silent: true });
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已添加', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteItem: function(item) {
        App.ui.confirm(`确定删除「${item.guest_name}」的礼金记录吗？`, '此操作不可撤销', async () => {
            try {
                await App.db.delete('gifts', item.id);
                await App.tracker.log('删除', '礼金记账', `删除「${item.guest_name}」的礼金记录`, { silent: true });
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    copyList: function() {
        if (this.data.length === 0) { App.ui.toast('暂无礼金数据', 'error'); return; }
        const sorted = [...this.data].sort((a, b) => {
            const da = a.received_date ? new Date(a.received_date) : new Date(0);
            const db = b.received_date ? new Date(b.received_date) : new Date(0);
            return da - db;
        });
        let text = '═══ 婚礼礼金记账簿 ═══\n\n';
        let totalAmount = 0;
        let groomAmount = 0;
        let brideAmount = 0;

        ['男方亲友', '女方亲友'].forEach(group => {
            const items = sorted.filter(g => g.group_type === group);
            if (items.length === 0) return;
            text += `【${group}】\n`;
            items.forEach((g, i) => {
                const amt = Number(g.amount) || 0;
                if (group === '男方亲友') groomAmount += amt;
                else brideAmount += amt;
                totalAmount += amt;
                text += `  ${i+1}. ${g.guest_name}`;
                if (amt > 0) text += `  ¥${App.ui.formatMoney(amt)}`;
                if (g.gift_item) text += `  🎁${g.gift_item}`;
                if (g.received_date) text += `  (${App.ui.formatDate(g.received_date)})`;
                text += '\n';
            });
            text += `\n  小计: ¥${App.ui.formatMoney(group === '男方亲友' ? groomAmount : brideAmount)}\n\n`;
        });

        text += `══════════════\n`;
        text += `总计: ¥${App.ui.formatMoney(totalAmount)}\n`;
        text += `男方: ¥${App.ui.formatMoney(groomAmount)} | 女方: ¥${App.ui.formatMoney(brideAmount)}\n`;
        text += `记录: ${this.data.length} 条`;
        App.ui.copyText(text);
    }
};

})();
