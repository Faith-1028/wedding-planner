/**
 * ============================================================
 * memos.js - 紧急备忘录模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.memos = {
    data: [],
    filterTag: '',

    onShow: function() {
        if (this.data.length === 0) this.load();
    },

    init: function() {
        document.getElementById('addMemoBtn').addEventListener('click', () => this.showForm());
    },

    load: async function() {
        try {
            this.data = await App.db.select('memos', 'sort_order');
            this.renderFilters();
            this.render();
        } catch(e) {
            console.error('[Memos] 加载失败:', e);
            App.ui.toast('加载备忘录失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    renderFilters: function() {
        const container = document.getElementById('memoFilters');
        container.innerHTML = `
            <select id="memoFilterTag">
                <option value="">全部标签</option>
                ${App.config.MEMO_TAGS.map(t =>
                    `<option value="${t}" ${this.filterTag===t?'selected':''}>${t}</option>`
                ).join('')}
            </select>
        `;
        document.getElementById('memoFilterTag').addEventListener('change', (e) => {
            this.filterTag = e.target.value;
            this.render();
        });
    },

    getFiltered: function() {
        if (!this.filterTag) return this.data;
        return this.data.filter(m => m.tag === this.filterTag);
    },

    render: function() {
        const container = document.getElementById('memosList');
        const filtered = this.getFiltered();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📌</div>
                    <div class="empty-state-text">暂无备忘录，点击「新增备忘」开始添加</div>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(m => `
            <div class="memo-card tag-${m.tag||'通用'}" data-id="${m.id}">
                <div class="memo-header">
                    <span class="memo-title">${App.ui.escapeHtml(m.title)}</span>
                    <span class="memo-tag">${App.ui.escapeHtml(m.tag || '通用')}</span>
                </div>
                <div class="memo-content">${App.ui.escapeHtml(m.content)}</div>
                <div class="memo-actions admin-only">
                    <button class="btn btn-sm btn-outline" data-id="${m.id}" data-action="edit-memo">编辑</button>
                    <button class="btn btn-sm btn-danger" data-id="${m.id}" data-action="del-memo">删除</button>
                </div>
            </div>
        `).join('');

        container.querySelectorAll('[data-action="edit-memo"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(m => m.id === btn.dataset.id);
                if (item) this.showForm(item);
            });
        });
        container.querySelectorAll('[data-action="del-memo"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const item = this.data.find(m => m.id === btn.dataset.id);
                if (item) this.deleteItem(item);
            });
        });
    },

    showForm: function(item) {
        const isEdit = !!item;
        const m = item || { title: '', tag: '通用', content: '' };
        const bodyHtml = `
            <div class="form-group">
                <label>标题 *</label>
                <input type="text" id="memoTitle" value="${App.ui.attr(m.title)}" placeholder="如 婚戒存放位置">
            </div>
            <div class="form-group">
                <label>内容标签</label>
                <select id="memoTag">
                    ${App.config.MEMO_TAGS.map(t =>
                        `<option value="${t}" ${m.tag===t?'selected':''}>${t}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>详情内容</label>
                <textarea id="memoContent" rows="6" placeholder="详细记录备忘信息...">${App.ui.attr(m.content)}</textarea>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveMemoBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑备忘录' : '新增备忘录', bodyHtml, footerHtml, () => {
            document.getElementById('saveMemoBtn').onclick = async () => {
                const title = document.getElementById('memoTitle').value.trim();
                if (!title) { App.ui.toast('请输入标题', 'error'); return; }
                const payload = {
                    title,
                    tag: document.getElementById('memoTag').value,
                    content: document.getElementById('memoContent').value.trim()
                };
                try {
                    if (isEdit) {
                        await App.db.update('memos', m.id, payload);
                        await App.tracker.log('编辑', '紧急备忘录', `修改「${title}」`);
                    } else {
                        payload.sort_order = Date.now();
                        await App.db.insert('memos', payload);
                        await App.tracker.log('新增', '紧急备忘录', `新增「${title}」`);
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已添加', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteItem: function(item) {
        App.ui.confirm(`确定删除「${item.title}」吗？`, '此操作不可撤销', async () => {
            try {
                await App.db.delete('memos', item.id);
                await App.tracker.log('删除', '紧急备忘录', `删除「${item.title}」`);
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    }
};

})();
