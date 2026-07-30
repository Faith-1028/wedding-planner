/**
 * ============================================================
 * seating.js - 席位桌次安排管理模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.seating = {
    tables: [],
    assignments: [],
    guests: [],
    filterZone: '',

    onShow: function() {
        this.load();
    },

    init: function() {
        document.getElementById('addTableBtn').addEventListener('click', () => this.showTableForm());
        document.getElementById('seatingCopyBtn').addEventListener('click', () => this.exportSeating());
    },

    load: async function() {
        try {
            this.tables = await App.db.select('seating_tables', 'sort_order');
            this.assignments = await App.db.select('seating_assignments');
            this.guests = await App.db.select('guests');
            this.renderFilters();
            this.render();
        } catch(e) {
            console.error('[Seating] 加载失败:', e);
            App.ui.toast('加载席位数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    renderFilters: function() {
        const container = document.getElementById('seatingFilters');
        container.innerHTML = `
            <select id="seatingFilterZone">
                <option value="">全部区域</option>
                ${App.config.SEATING_ZONES.map(z =>
                    `<option value="${z}" ${this.filterZone===z?'selected':''}>${z}</option>`
                ).join('')}
                <option value="empty" ${this.filterZone==='empty'?'selected':''}>仅空桌</option>
                <option value="full" ${this.filterZone==='full'?'selected':''}>仅满桌</option>
            </select>
        `;
        document.getElementById('seatingFilterZone').addEventListener('change', (e) => {
            this.filterZone = e.target.value;
            this.render();
        });
    },

    getFilteredTables: function() {
        let result = this.tables;
        if (this.filterZone === 'empty') {
            return result.filter(t => this.getTableGuestCount(t.id) === 0);
        }
        if (this.filterZone === 'full') {
            return result.filter(t => {
                const count = this.getTableGuestCount(t.id);
                return count >= (t.capacity || 10);
            });
        }
        if (this.filterZone) {
            result = result.filter(t => t.zone === this.filterZone);
        }
        return result;
    },

    getTableGuests: function(tableId) {
        return this.assignments.filter(a => a.table_id === tableId);
    },

    getTableGuestCount: function(tableId) {
        return this.getTableGuests(tableId).length;
    },

    getUnassignedGuests: function() {
        const assignedIds = new Set(this.assignments.map(a => a.guest_id).filter(Boolean));
        return this.guests.filter(g => g.status === '确认出席' && !assignedIds.has(g.id));
    },

    render: function() {
        // 渲染未分配宾客
        this.renderUnassignedGuests();
        // 渲染桌位
        this.renderTables();
    },

    renderUnassignedGuests: function() {
        const container = document.getElementById('unassignedGuests');
        const unassigned = this.getUnassignedGuests();

        if (unassigned.length === 0) {
            container.innerHTML = `<div style="color:var(--c-text-muted);font-size:13px;padding:8px;">所有确认出席的宾客已分配</div>`;
            return;
        }

        container.innerHTML = unassigned.map(g => `
            <div class="unassigned-guest-chip" draggable="true"
                 data-guest-id="${g.id}" data-guest-name="${App.ui.attr(g.name)}"
                 data-group-type="${App.ui.attr(g.group_type||'')}">
                ${App.ui.escapeHtml(g.name)}
                ${g.adults > 1 ? `<span style="color:var(--c-text-muted);font-size:11px;">×${g.adults}</span>` : ''}
            </div>
        `).join('');

        // 拖拽事件
        container.querySelectorAll('.unassigned-guest-chip').forEach(chip => {
            chip.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    guestId: chip.dataset.guestId,
                    guestName: chip.dataset.guestName,
                    groupType: chip.dataset.groupType
                }));
                chip.classList.add('dragging');
            });
            chip.addEventListener('dragend', () => {
                chip.classList.remove('dragging');
            });

            // 点击分配（移动端备用）
            chip.addEventListener('click', () => {
                this.showAssignDialog(chip.dataset.guestId, chip.dataset.guestName, chip.dataset.groupType);
            });
        });
    },

    renderTables: function() {
        const container = document.getElementById('seatingTablesList');
        const filtered = this.getFilteredTables();

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🍽️</div>
                    <div class="empty-state-text">暂无桌位，点击「新增桌位」开始安排</div>
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(t => {
            const guests = this.getTableGuests(t.id);
            const count = guests.length;
            const isFull = count >= (t.capacity || 10);
            return `
                <div class="seating-table-card zone-${t.zone||'亲友区'} ${isFull?'full':''}" data-table-id="${t.id}">
                    <div class="seating-table-header">
                        <span class="seating-table-number">第 ${t.table_number} 桌</span>
                        <span class="seating-table-count ${isFull?'full':''}">${count}/${t.capacity||10}人 · ${t.zone||''}</span>
                    </div>
                    ${t.table_leader ? `<div class="seating-table-leader">桌长：${App.ui.escapeHtml(t.table_leader)}</div>` : ''}
                    <div class="seating-table-guests" data-table-id="${t.id}">
                        ${guests.map(g => `
                            <span class="seated-guest-chip">
                                ${App.ui.escapeHtml(g.guest_name)}
                                <button class="remove-btn" data-assignment-id="${g.id}" data-action="unseat">&times;</button>
                            </span>
                        `).join('')}
                        ${count === 0 ? '<span style="color:var(--c-text-muted);font-size:12px;">拖拽宾客到此处分配</span>' : ''}
                    </div>
                    <div class="seating-table-actions admin-only">
                        <button class="btn btn-sm btn-outline" data-id="${t.id}" data-action="edit-table">编辑</button>
                        <button class="btn btn-sm btn-danger" data-id="${t.id}" data-action="del-table">删除</button>
                    </div>
                </div>
            `;
        }).join('');

        // 拖拽放置区
        container.querySelectorAll('.seating-table-card').forEach(card => {
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                card.classList.add('drag-over');
            });
            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    this.assignGuest(data.guestId, data.guestName, data.groupType, card.dataset.tableId);
                } catch(err) { console.error('Drop parse error:', err); }
            });
        });

        // 取消分配
        container.querySelectorAll('[data-action="unseat"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.unassignGuest(btn.dataset.assignmentId);
            });
        });

        // 编辑/删除桌位
        container.querySelectorAll('[data-action="edit-table"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const table = this.tables.find(t => t.id === btn.dataset.id);
                if (table) this.showTableForm(table);
            });
        });
        container.querySelectorAll('[data-action="del-table"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const table = this.tables.find(t => t.id === btn.dataset.id);
                if (table) this.deleteTable(table);
            });
        });
    },

    assignGuest: async function(guestId, guestName, groupType, tableId) {
        try {
            await App.db.insert('seating_assignments', {
                guest_id: guestId,
                guest_name: guestName,
                group_type: groupType || '',
                table_id: tableId
            });
            await App.tracker.log('新增', '席位安排', `将「${guestName}」分配到桌位`);
        } catch(e) {
            App.ui.toast('分配失败：' + e.message, 'error');
        }
    },

    unassignGuest: async function(assignmentId) {
        try {
            const a = this.assignments.find(x => x.id === assignmentId);
            await App.db.delete('seating_assignments', assignmentId);
            if (a) await App.tracker.log('删除', '席位安排', `取消「${a.guest_name}」的桌位分配`);
        } catch(e) { App.ui.toast('取消分配失败', 'error'); }
    },

    showAssignDialog: function(guestId, guestName, groupType) {
        if (this.tables.length === 0) {
            App.ui.toast('请先创建桌位', 'error');
            return;
        }
        const bodyHtml = `
            <div class="form-group">
                <label>选择桌位 — 为「${App.ui.escapeHtml(guestName)}」分配座位</label>
                <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
                    ${this.tables.map(t => {
                        const count = this.getTableGuestCount(t.id);
                        const isFull = count >= (t.capacity || 10);
                        return `
                            <button class="btn ${isFull?'btn-outline':'btn-primary'} btn-block"
                                    style="text-align:left;justify-content:flex-start;"
                                    data-table-id="${t.id}" data-action="assign-table"
                                    ${isFull?'disabled':''}>
                                第${t.table_number}桌 · ${t.zone||''} · ${count}/${t.capacity||10}人
                                ${t.table_leader?` · 桌长:${t.table_leader}`:''}
                                ${isFull?' (已满)':''}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        const footerHtml = `<button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>`;
        App.ui.showModal('分配座位', bodyHtml, footerHtml, () => {
            document.querySelectorAll('[data-action="assign-table"]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this.assignGuest(guestId, guestName, groupType, btn.dataset.tableId);
                    App.ui.hideModal();
                });
            });
        });
    },

    showTableForm: function(table) {
        const isEdit = !!table;
        const t = table || { table_number: this.tables.length + 1, capacity: 10, zone: '亲友区', table_leader: '', remarks: '' };
        const bodyHtml = `
            <div class="form-row">
                <div class="form-group">
                    <label>桌号 *</label>
                    <input type="number" id="tableNumber" value="${t.table_number}" min="1">
                </div>
                <div class="form-group">
                    <label>容纳人数</label>
                    <input type="number" id="tableCapacity" value="${t.capacity||10}" min="1">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>归属区域</label>
                    <select id="tableZone">
                        ${App.config.SEATING_ZONES.map(z =>
                            `<option value="${z}" ${t.zone===z?'selected':''}>${z}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>指定桌长</label>
                    <input type="text" id="tableLeader" value="${App.ui.attr(t.table_leader)}" placeholder="桌长姓名">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="tableRemarks" rows="2" placeholder="如 靠近主桌/靠近舞台">${App.ui.attr(t.remarks)}</textarea>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveTableBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑桌位' : '新增桌位', bodyHtml, footerHtml, () => {
            document.getElementById('saveTableBtn').onclick = async () => {
                const tableNumber = parseInt(document.getElementById('tableNumber').value);
                if (!tableNumber || tableNumber < 1) { App.ui.toast('请输入有效桌号', 'error'); return; }
                const payload = {
                    table_number: tableNumber,
                    capacity: parseInt(document.getElementById('tableCapacity').value) || 10,
                    zone: document.getElementById('tableZone').value,
                    table_leader: document.getElementById('tableLeader').value.trim(),
                    remarks: document.getElementById('tableRemarks').value.trim()
                };
                try {
                    if (isEdit) {
                        await App.db.update('seating_tables', t.id, payload);
                        await App.tracker.log('编辑', '席位桌次', `修改第${tableNumber}桌`);
                    } else {
                        payload.sort_order = Date.now();
                        await App.db.insert('seating_tables', payload);
                        await App.tracker.log('新增', '席位桌次', `新增第${tableNumber}桌`);
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已添加', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteTable: function(table) {
        const guestCount = this.getTableGuestCount(table.id);
        const subText = guestCount > 0 ? `该桌已有 ${guestCount} 位宾客，删除后需重新分配` : '此操作不可撤销';
        App.ui.confirm(`确定删除第${table.table_number}桌吗？`, subText, async () => {
            try {
                // 先删除该桌的分配记录
                const tableAssignments = this.assignments.filter(a => a.table_id === table.id);
                for (const a of tableAssignments) {
                    await App.db.delete('seating_assignments', a.id);
                }
                await App.db.delete('seating_tables', table.id);
                await App.tracker.log('删除', '席位桌次', `删除第${table.table_number}桌`);
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    exportSeating: function() {
        if (this.tables.length === 0) { App.ui.toast('暂无桌位数据', 'error'); return; }
        let text = '═══ 婚礼席位安排表 ═══\n\n';
        const sorted = [...this.tables].sort((a, b) => a.table_number - b.table_number);
        let totalGuests = 0;
        sorted.forEach(t => {
            const guests = this.getTableGuests(t.id);
            totalGuests += guests.length;
            text += `第${t.table_number}桌 [${t.zone}] (${guests.length}/${t.capacity}人)`;
            if (t.table_leader) text += ` 桌长:${t.table_leader}`;
            text += '\n';
            if (guests.length > 0) {
                guests.forEach(g => { text += `  · ${g.guest_name}\n`; });
            } else {
                text += '  (暂无分配)\n';
            }
            text += '\n';
        });
        text += `──────────────\n`;
        text += `共 ${sorted.length} 桌，已分配 ${totalGuests} 人`;
        App.ui.copyText(text);
    }
};

})();
