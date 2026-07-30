/**
 * ============================================================
 * games.js - 堵门接亲游戏管理模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.games = {
    data: [],

    onShow: function() {
        if (this.data.length === 0) this.load();
    },

    init: function() {
        document.getElementById('addGameBtn').addEventListener('click', () => this.showForm());
        document.getElementById('gamesCopyBtn').addEventListener('click', () => this.copyList());
    },

    load: async function() {
        try {
            this.data = await App.db.select('games', 'sort_order');
            this.render();
        } catch(e) {
            console.error('[Games] 加载失败:', e);
            App.ui.toast('加载游戏数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    render: function() {
        this.renderStats();
        const container = document.getElementById('gamesList');

        if (this.data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎮</div>
                    <div class="empty-state-text">暂无游戏，点击「添加新游戏」开始录入</div>
                </div>
            `;
            return;
        }

        container.innerHTML = this.data.map(g => `
            <div class="game-card ${g.selected ? 'selected' : ''} ${g.expanded ? 'expanded' : ''}" data-id="${g.id}">
                <div class="game-card-header">
                    <span class="game-drag-handle">⠿</span>
                    <span class="game-name">${App.ui.escapeHtml(g.name)}</span>
                    <span class="game-duration">⏱️ ${g.duration || 0}分钟</span>
                    <label class="game-checkbox admin-only">
                        <input type="checkbox" data-id="${g.id}" data-action="toggle-selected" ${g.selected ? 'checked' : ''}>
                        纳入流程
                    </label>
                    <div class="game-actions">
                        <button class="game-expand-btn" data-id="${g.id}" data-action="toggle-expand">
                            ${g.expanded ? '收起 ▲' : '展开 ▼'}
                        </button>
                        <button class="btn btn-sm btn-outline admin-only" data-id="${g.id}" data-action="edit-game">编辑</button>
                        <button class="btn btn-sm btn-danger admin-only" data-id="${g.id}" data-action="del-game">删除</button>
                    </div>
                </div>
                <div class="game-card-body">
                    ${g.props ? `<div class="game-detail"><div class="game-detail-label">道具清单</div><div class="game-detail-value">${App.ui.escapeHtml(g.props)}</div></div>` : ''}
                    ${g.rules ? `<div class="game-detail"><div class="game-detail-label">游戏规则</div><div class="game-detail-value">${App.ui.escapeHtml(g.rules)}</div></div>` : ''}
                    ${g.punishment ? `<div class="game-detail"><div class="game-detail-label">小惩罚</div><div class="game-detail-value">${App.ui.escapeHtml(g.punishment)}</div></div>` : ''}
                </div>
            </div>
        `).join('');

        // 绑定事件
        container.querySelectorAll('[data-action="toggle-expand"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.game-card');
                card.classList.toggle('expanded');
                btn.textContent = card.classList.contains('expanded') ? '收起 ▲' : '展开 ▼';
            });
        });
        container.querySelectorAll('[data-action="toggle-selected"]').forEach(cb => {
            cb.addEventListener('change', () => this.toggleSelected(cb.dataset.id, cb.checked));
        });
        container.querySelectorAll('[data-action="edit-game"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const game = this.data.find(g => g.id === btn.dataset.id);
                if (game) this.showForm(game);
            });
        });
        container.querySelectorAll('[data-action="del-game"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const game = this.data.find(g => g.id === btn.dataset.id);
                if (game) this.deleteGame(game);
            });
        });

        // 拖拽排序
        App.ui.initDragSort(container, '.game-card', (newOrder) => this.reorder(newOrder));
    },

    renderStats: function() {
        const selected = this.data.filter(g => g.selected);
        const totalDuration = selected.reduce((s, g) => s + (g.duration || 0), 0);
        const container = document.getElementById('gamesStats');
        container.innerHTML = `
            <div class="stat-pill">🎮 总游戏 <strong>${this.data.length}</strong></div>
            <div class="stat-pill">✅ 已选 <strong>${selected.length}</strong></div>
            <div class="stat-pill">⏱️ 总耗时 <strong>${totalDuration}</strong> 分钟</div>
        `;
    },

    showForm: function(game) {
        const isEdit = !!game;
        const g = game || { name: '', duration: 5, props: '', rules: '', punishment: '' };
        const bodyHtml = `
            <div class="form-group">
                <label>游戏名称 *</label>
                <input type="text" id="gameName" value="${App.ui.attr(g.name)}" placeholder="如 猜唇印">
            </div>
            <div class="form-group">
                <label>预估耗时（分钟）</label>
                <input type="number" id="gameDuration" value="${g.duration||5}" min="1">
            </div>
            <div class="form-group">
                <label>简易道具清单</label>
                <textarea id="gameProps" rows="2" placeholder="如 口红、A4纸、笔">${App.ui.attr(g.props)}</textarea>
            </div>
            <div class="form-group">
                <label>完整游戏规则</label>
                <textarea id="gameRules" rows="4" placeholder="详细描述游戏玩法和规则">${App.ui.attr(g.rules)}</textarea>
            </div>
            <div class="form-group">
                <label>可选小惩罚</label>
                <textarea id="gamePunishment" rows="2" placeholder="如 做俯卧撑10个、发红包">${App.ui.attr(g.punishment)}</textarea>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveGameBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑游戏' : '添加新游戏', bodyHtml, footerHtml, () => {
            document.getElementById('saveGameBtn').onclick = async () => {
                const name = document.getElementById('gameName').value.trim();
                if (!name) { App.ui.toast('请输入游戏名称', 'error'); return; }
                const payload = {
                    name,
                    duration: parseInt(document.getElementById('gameDuration').value) || 0,
                    props: document.getElementById('gameProps').value.trim(),
                    rules: document.getElementById('gameRules').value.trim(),
                    punishment: document.getElementById('gamePunishment').value.trim()
                };
                try {
                    if (isEdit) {
                        await App.db.update('games', g.id, payload);
                        await App.tracker.log('编辑', '接亲游戏', `修改游戏「${name}」`);
                    } else {
                        payload.selected = false;
                        payload.expanded = false;
                        payload.sort_order = Date.now();
                        await App.db.insert('games', payload);
                        await App.tracker.log('新增', '接亲游戏', `新增游戏「${name}」`);
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已添加', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteGame: function(game) {
        App.ui.confirm(`确定删除游戏「${game.name}」吗？`, '此操作不可撤销', async () => {
            try {
                await App.db.delete('games', game.id);
                await App.tracker.log('删除', '接亲游戏', `删除游戏「${game.name}」`);
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    toggleSelected: async function(id, checked) {
        try {
            await App.db.update('games', id, { selected: checked });
            const game = this.data.find(g => g.id === id);
            await App.tracker.log('编辑', '接亲游戏', `「${game?.name||''}」${checked ? '纳入' : '移出'}当天流程`);
        } catch(e) { App.ui.toast('更新失败', 'error'); }
    },

    reorder: async function(newOrder) {
        try {
            for (let i = 0; i < newOrder.length; i++) {
                await App.db.update('games', newOrder[i], { sort_order: i });
            }
            await App.tracker.log('编辑', '接亲游戏', '调整游戏顺序');
        } catch(e) { console.error('[Games] 排序失败:', e); }
    },

    copyList: function() {
        const selected = this.data.filter(g => g.selected);
        if (selected.length === 0) {
            App.ui.toast('暂无已选游戏，请先勾选「纳入当天流程」', 'error');
            return;
        }
        const totalDuration = selected.reduce((s, g) => s + (g.duration || 0), 0);
        let text = '══️ 堵门接亲游戏清单 ═══\n\n';
        selected.forEach((g, i) => {
            text += `${i+1}. ${g.name}（约${g.duration||0}分钟）\n`;
            if (g.props) text += `   📦 道具: ${g.props}\n`;
            if (g.rules) text += `   📋 规则: ${g.rules}\n`;
            if (g.punishment) text += `   😈 惩罚: ${g.punishment}\n`;
            text += '\n';
        });
        text += `──────────────\n共 ${selected.length} 个游戏 · 预计总耗时 ${totalDuration} 分钟`;
        App.ui.copyText(text);
    }
};

})();
