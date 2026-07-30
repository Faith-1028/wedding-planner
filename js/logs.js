/**
 * ============================================================
 * logs.js - 操作日志记录模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.logs = {
    data: [],
    filterModule: '',
    filterDate: '',

    onShow: function() {
        this.load();
    },

    init: function() {
        document.getElementById('exportLogsBtn').addEventListener('click', () => this.exportLogs());
    },

    load: async function() {
        try {
            this.data = await App.db.select('operation_logs', 'created_at');
            this.renderFilters();
            this.render();
        } catch(e) {
            console.error('[Logs] 加载失败:', e);
            App.ui.toast('加载日志数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    renderFilters: function() {
        const modules = [...new Set(this.data.map(l => l.module))];
        const container = document.getElementById('logFilters');
        container.innerHTML = `
            <select id="logFilterModule">
                <option value="">全部模块</option>
                ${modules.map(m => `<option value="${App.ui.attr(m)}" ${this.filterModule===m?'selected':''}>${App.ui.escapeHtml(m)}</option>`).join('')}
            </select>
            <input type="date" id="logFilterDate" value="${this.filterDate}">
            <button class="btn btn-sm btn-outline" id="clearLogFilter">清除筛选</button>
        `;
        document.getElementById('logFilterModule').addEventListener('change', (e) => {
            this.filterModule = e.target.value; this.render();
        });
        document.getElementById('logFilterDate').addEventListener('change', (e) => {
            this.filterDate = e.target.value; this.render();
        });
        document.getElementById('clearLogFilter').addEventListener('click', () => {
            this.filterModule = ''; this.filterDate = '';
            this.renderFilters(); this.render();
        });
    },

    getFiltered: function() {
        return this.data.filter(l => {
            if (this.filterModule && l.module !== this.filterModule) return false;
            if (this.filterDate) {
                const logDate = new Date(l.created_at).toISOString().slice(0, 10);
                if (logDate !== this.filterDate) return false;
            }
            return true;
        });
    },

    render: function() {
        const container = document.getElementById('logsList');
        const filtered = this.getFiltered();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <div class="empty-state-text">暂无操作日志</div>
                </div>
            `;
            return;
        }

        const typeColor = {
            '新增': 'tag-success',
            '编辑': 'tag-info',
            '删除': 'tag-danger'
        };

        container.innerHTML = filtered.map(l => `
            <div class="log-item">
                <span class="log-time">${App.ui.formatLogTime(l.created_at)}</span>
                <span class="log-operator">${App.ui.escapeHtml(l.operator_name)}</span>
                <span class="log-type"><span class="tag ${typeColor[l.operation_type] || 'tag-default'}">${l.operation_type}</span></span>
                <span class="log-module">${App.ui.escapeHtml(l.module)}</span>
                <span class="log-content">${App.ui.escapeHtml(l.content_summary || '')}</span>
            </div>
        `).join('');
    },

    exportLogs: function() {
        const filtered = this.getFiltered();
        if (filtered.length === 0) { App.ui.toast('暂无日志可导出', 'error'); return; }
        let text = '═══ 婚礼备婚操作日志 ═══\n';
        text += `导出时间: ${App.ui.formatLogTime(new Date().toISOString())}\n`;
        text += `记录数量: ${filtered.length} 条\n\n`;
        filtered.forEach((l, i) => {
            text += `${i+1}. [${App.ui.formatLogTime(l.created_at)}] ${l.operator_name} ${l.operation_type}了${l.module}`;
            if (l.content_summary) text += ` - ${l.content_summary}`;
            text += '\n';
        });
        App.ui.copyText(text);
    }
};

})();
