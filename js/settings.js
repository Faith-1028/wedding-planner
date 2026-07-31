/**
 * ============================================================
 * settings.js - 系统设置模块
 * ============================================================
 * 统一管理所有下拉选项（分类、状态、分组、标签、区域等）
 * 支持自定义添加 / 删除，变更实时同步给所有在线用户
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.settings = {
    /**
     * 打开设置页面时调用
     */
    onShow: function() {
        this.load();
    },

    init: function() {
        // settings 模块没有初始化事件
    },

    /**
     * 加载并渲染所有选项组
     */
    load: async function() {
        try {
            // 重新从数据库加载最新值（确保是最新数据）
            if (App.isSupabaseConfigured) {
                const rows = await App.db.select('app_settings');
                rows.forEach(r => { App.config[r.key] = r.value; });
            }
            this.render();
        } catch(e) {
            console.error('[Settings] 加载失败:', e);
            App.ui.toast('加载设置失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    /**
     * 渲染设置页面
     */
    render: function() {
        const container = document.getElementById('settingsContainer');
        if (!container) return;

        const meta = App.config.OPTION_META;
        container.innerHTML = `
            <div class="settings-header">
                <div class="settings-desc">
                    <p>在这里统一管理所有下拉选项。可以<strong>添加</strong>自定义标签，也可以<strong>删除</strong>不需要的选项。</p>
                    <p class="settings-warning">⚠️ 删除选项不会删除已有数据（已存在的记录仍保留原值），但新记录将无法选择该选项。</p>
                </div>
            </div>
            <div class="settings-grid">
                ${meta.map(m => this.renderGroup(m)).join('')}
            </div>
        `;

        // 绑定所有事件
        meta.forEach(m => this.bindEvents(m));
    },

    /**
     * 渲染单个选项组卡片
     */
    renderGroup: function(meta) {
        const values = App.config[meta.key] || [];
        return `
            <div class="settings-card" data-key="${meta.key}" data-dbkey="${meta.dbKey}">
                <div class="settings-card-header">
                    <h3 class="settings-card-title">${meta.title}</h3>
                    <span class="settings-card-count">${values.length} 个</span>
                </div>
                <p class="settings-card-desc">${meta.desc}</p>
                <div class="settings-tags" data-tags="${meta.key}">
                    ${values.map((v, idx) => `
                        <span class="settings-tag" data-value="${this._escape(v)}">
                            <span class="settings-tag-text">${this._escape(v)}</span>
                            <button class="settings-tag-remove" data-action="remove" data-value="${this._escape(v)}" title="删除">×</button>
                        </span>
                    `).join('')}
                </div>
                <div class="settings-add-row">
                    <input type="text" class="settings-add-input" data-add="${meta.key}"
                           placeholder="输入新选项名称，回车保存" maxlength="20">
                    <button class="btn btn-primary settings-add-btn" data-action="add" data-key="${meta.key}" data-dbkey="${meta.dbKey}">
                        添加
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * 绑定某个选项组的所有交互事件
     */
    bindEvents: function(meta) {
        const card = document.querySelector(`.settings-card[data-key="${meta.key}"]`);
        if (!card) return;

        // 添加按钮
        const addBtn = card.querySelector('[data-action="add"]');
        const addInput = card.querySelector('[data-add]');
        if (addBtn && addInput) {
            addBtn.addEventListener('click', () => {
                const value = addInput.value.trim();
                if (value) this.addOption(meta, value);
            });
            // 回车提交
            addInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addBtn.click();
                }
            });
        }

        // 删除按钮（事件委托）
        card.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="remove"]');
            if (!btn) return;
            const value = btn.dataset.value;
            this.removeOption(meta, value);
        });
    },

    /**
     * 添加一个新选项
     */
    addOption: async function(meta, value) {
        const current = App.config[meta.key] || [];
        if (current.includes(value)) {
            App.ui.toast(`「${value}」已存在`, 'warning');
            return;
        }
        const updated = [...current, value];
        await this.save(meta, updated);
        App.ui.toast(`已添加「${value}」到「${meta.title}」`, 'success');
    },

    /**
     * 删除一个选项
     */
    removeOption: async function(meta, value) {
        App.ui.confirm(
            `确定删除「${value}」吗？`,
            `从「${meta.title}」中移除该选项。\n已有数据保留原值，但新数据将无法选择该选项。`,
            async () => {
                const current = App.config[meta.key] || [];
                const updated = current.filter(v => v !== value);
                await this.save(meta, updated);
                App.ui.toast(`已删除「${value}」`, 'success');
            }
        );
    },

    /**
     * 保存选项到数据库（也更新 App.config 的内存值）
     */
    save: async function(meta, values) {
        try {
            // 1. 立即更新内存中的值，让表单立刻反映
            App.config[meta.key] = values;
            // 2. 写入数据库（Supabase Realtime 会通知所有客户端同步）
            //    app_settings 主键是 key（不是 id），必须用 upsert + onConflict:'key'
            await App.db.upsert('app_settings', {
                key: meta.dbKey,
                value: values,
                updated_by: App.auth.currentUser ? App.auth.currentUser.name : ''
            }, 'key');
            // 3. 记录操作日志
            await App.tracker.log('编辑', '系统设置', `修改「${meta.title}」`);
            // 4. 重新渲染当前页面
            this.render();
            // 5. 刷新所有受影响的模块（让它们重建下拉选项）
            this._refreshRelatedModules(meta);
        } catch(e) {
            console.error('[Settings] 保存失败:', e);
            App.ui.toast('保存失败：' + e.message, 'error');
            // 回滚：重新加载
            this.load();
        }
    },

    /**
     * 当某个选项组变更时，刷新所有可能用到它的模块
     */
    _refreshRelatedModules: function(meta) {
        // 简单的全量刷新策略：所有可能含下拉框的模块都重 render 一次
        const affected = ['guests', 'supplies', 'memos', 'staff', 'seating', 'budget', 'timeline'];
        affected.forEach(id => {
            if (App.modules[id] && typeof App.modules[id].refresh === 'function') {
                try { App.modules[id].refresh(); } catch(e) { console.warn(`[${id}] refresh failed:`, e); }
            }
        });
    },

    /**
     * HTML 转义辅助函数
     */
    _escape: function(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
};

})();