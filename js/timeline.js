/**
 * ============================================================
 * timeline.js - 婚礼流程时间轴模块
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.timeline = {
    data: [],
    staffContacts: [],

    onShow: function() {
        if (this.data.length === 0) this.load();
    },

    init: function() {
        document.getElementById('addTaskBtn').addEventListener('click', () => this.showForm());
        document.getElementById('timelineCopyBtn').addEventListener('click', () => this.copyList());
    },

    load: async function() {
        try {
            this.data = await App.db.select('timeline_tasks', 'sort_order');
            this.staffContacts = await App.db.select('staff_contacts');
            this.render();
        } catch(e) {
            console.error('[Timeline] 加载失败:', e);
            App.ui.toast('加载流程数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    render: function() {
        const container = document.getElementById('timelineList');

        if (this.data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div class="empty-state-text">暂无流程任务，点击「新增流程」开始添加</div>
                </div>
            `;
            this.renderStaffTable();
            return;
        }

        const statusIcon = { '未开始': '⏳', '进行中': '▶️', '已完成': '✅' };
        const statusClass = { '未开始': '', '进行中': 'in-progress', '已完成': 'completed' };

        container.innerHTML = this.data.map(t => `
            <div class="timeline-item ${statusClass[t.status]||''} ${t.is_key?'key':''}" data-id="${t.id}">
                <div class="timeline-dot">${statusIcon[t.status] || '⏳'}</div>
                <div class="timeline-content">
                    <div class="timeline-top">
                        <span class="timeline-time">${App.ui.escapeHtml(t.task_time || '时间待定')}</span>
                        <span class="timeline-event">${App.ui.escapeHtml(t.event)} ${t.is_key ? '<span class="tag tag-danger">关键</span>' : ''}</span>
                        <div class="timeline-actions admin-only">
                            <button class="btn btn-sm btn-outline" data-id="${t.id}" data-action="edit-task">编辑</button>
                            <button class="btn btn-sm btn-danger" data-id="${t.id}" data-action="del-task">删除</button>
                        </div>
                    </div>
                    <div class="timeline-meta">
                        ${t.person_in_charge ? t.person_in_charge.split(',').map(n => n.trim()).filter(Boolean).map(n =>
                            `<span class="person-in-charge-link" data-person="${App.ui.attr(n)}">👤 ${App.ui.escapeHtml(n)}</span>`
                        ).join('') : ''}
                        ${t.location ? `<span>📍 ${App.ui.escapeHtml(t.location)}</span>` : ''}
                        ${t.remarks ? `<span>📝 ${App.ui.escapeHtml(t.remarks)}</span>` : ''}
                    </div>
                    <div class="status-toggle admin-only" style="margin-top:6px;">
                        ${App.config.TASK_STATUSES.map(s => `
                            <button class="status-btn ${t.status===s?'active':''} ${s==='未开始'?'status-pending':s==='进行中'?'status-progress':'status-done'}"
                                data-id="${t.id}" data-status="${s}" data-action="toggle-status">${s}</button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `).join('');

        // 绑定事件
        container.querySelectorAll('[data-action="edit-task"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const task = this.data.find(t => t.id === btn.dataset.id);
                if (task) this.showForm(task);
            });
        });
        container.querySelectorAll('[data-action="del-task"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const task = this.data.find(t => t.id === btn.dataset.id);
                if (task) this.deleteTask(task);
            });
        });
        container.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
            btn.addEventListener('click', () => this.toggleStatus(btn.dataset.id, btn.dataset.status));
        });

        // 负责人信息弹窗
        container.querySelectorAll('.person-in-charge-link').forEach(el => {
            el.style.cursor = 'pointer';
            el.style.color = 'var(--c-champagne-dark)';
            el.style.textDecoration = 'underline';
            el.addEventListener('click', () => this.showPersonInfo(el.dataset.person));
        });

        // 初始化拖拽排序
        App.ui.initDragSort(container, '.timeline-item', (newOrder) => this.reorder(newOrder));

        // 渲染工作人员表
        this.renderStaffTable();
    },

    showPersonInfo: function(name) {
        const person = this.staffContacts.find(s => s.name === name);
        if (!person) {
            App.ui.toast(`「${name}」不在工作人员联络清单中`, 'info');
            return;
        }
        const bodyHtml = `
            <div class="person-info-popup">
                <div class="person-info-row">
                    <span class="person-info-label">姓名</span>
                    <span class="person-info-value">${App.ui.escapeHtml(person.name)}</span>
                </div>
                <div class="person-info-row">
                    <span class="person-info-label">分类</span>
                    <span class="person-info-value">${App.ui.escapeHtml(person.category)}</span>
                </div>
                ${person.role_desc ? `
                    <div class="person-info-row">
                        <span class="person-info-label">岗位</span>
                        <span class="person-info-value">${App.ui.escapeHtml(person.role_desc)}</span>
                    </div>
                ` : ''}
                ${person.phone ? `
                    <div class="person-info-row">
                        <span class="person-info-label">电话</span>
                        <span class="person-info-value">
                            <a class="staff-contact-phone" href="tel:${App.ui.escapeHtml(person.phone)}">${App.ui.escapeHtml(person.phone)}</a>
                        </span>
                    </div>
                ` : ''}
                ${person.wechat ? `
                    <div class="person-info-row">
                        <span class="person-info-label">微信</span>
                        <span class="person-info-value">${App.ui.escapeHtml(person.wechat)}</span>
                    </div>
                ` : ''}
                ${person.remarks ? `
                    <div class="person-info-row">
                        <span class="person-info-label">备注</span>
                        <span class="person-info-value">${App.ui.escapeHtml(person.remarks)}</span>
                    </div>
                ` : ''}
            </div>
        `;
        const footerHtml = person.phone
            ? `<button class="btn btn-outline" onclick="App.ui.hideModal()">关闭</button>
               <a class="btn btn-primary" href="tel:${App.ui.attr(person.phone)}" style="text-decoration:none;color:#fff;">📞 拨打电话</a>`
            : `<button class="btn btn-primary" onclick="App.ui.hideModal()">关闭</button>`;
        App.ui.showModal('负责人信息 · ' + person.name, bodyHtml, footerHtml, () => {});
    },

    renderStaffTable: function() {
        const container = document.getElementById('staffTable');
        const allStaff = [];
        this.data.forEach(t => {
            if (t.person_in_charge) {
                // 支持多负责人：逗号分隔 → 展开成多行
                const persons = t.person_in_charge.split(',').map(s => s.trim()).filter(Boolean);
                persons.forEach(pName => {
                    const contact = this.staffContacts.find(s => s.name === pName);
                    allStaff.push({
                        name: pName,
                        task: t.event,
                        time: t.task_time || '',
                        location: t.location || '',
                        phone: contact ? (contact.phone || '') : '',
                        role: contact ? (contact.role_desc || '') : ''
                    });
                });
            }
        });

        if (allStaff.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state-text">暂无分工信息，请在流程任务中填写负责人</div></div>`;
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>负责人</th><th>岗位</th><th>负责事项</th><th>时间</th><th>地点</th><th>电话</th></tr></thead>
                <tbody>
                    ${allStaff.map(s => `
                        <tr>
                            <td>${App.ui.escapeHtml(s.name)}</td>
                            <td>${App.ui.escapeHtml(s.role || '—')}</td>
                            <td>${App.ui.escapeHtml(s.task)}</td>
                            <td>${App.ui.escapeHtml(s.time)}</td>
                            <td>${App.ui.escapeHtml(s.location)}</td>
                            <td>${s.phone ? `<a class="staff-contact-phone" href="tel:${App.ui.escapeHtml(s.phone)}">${App.ui.escapeHtml(s.phone)}</a>` : '—'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    showForm: function(task) {
        const isEdit = !!task;
        const t = task || { task_time: '', event: '', person_in_charge: '', location: '', remarks: '', is_key: false };

        // 解析已有负责人（逗号分隔 → 数组）
        const selectedPersons = t.person_in_charge
            ? t.person_in_charge.split(',').map(s => s.trim()).filter(Boolean)
            : [];
        // 不在工作人员清单中的负责人（手动输入的）
        const customPersons = selectedPersons.filter(n => !this.staffContacts.find(s => s.name === n));

        // 生成负责人多选 checkbox 列表
        const personField = this.staffContacts.length > 0
            ? `<div class="person-checkbox-group" id="taskPersonGroup">
                 ${this.staffContacts.map(s => {
                     const checked = selectedPersons.includes(s.name) ? 'checked' : '';
                     return `<label class="person-checkbox-item ${checked?'checked':''}">
                         <input type="checkbox" class="task-person-cb" value="${App.ui.attr(s.name)}" ${checked}>
                         <span class="person-checkbox-label">${App.ui.escapeHtml(s.name)}${s.role_desc?' · '+s.role_desc:''}${s.category?' ('+s.category+')':''}</span>
                     </label>`;
                 }).join('')}
               </div>
               <input type="text" id="taskPersonCustom" class="form-input" style="margin-top:8px;" placeholder="补充其他负责人（逗号分隔多人）" value="${App.ui.attr(customPersons.join(', '))}">`
            : `<input type="text" id="taskPerson" class="form-input" value="${App.ui.attr(t.person_in_charge)}" placeholder="负责人姓名（逗号分隔多人）">`;

        const bodyHtml = `
            <div class="form-row">
                <div class="form-group">
                    <label>时间</label>
                    <input type="text" id="taskTime" value="${App.ui.attr(t.task_time)}" placeholder="如 08:00 或 08:00-09:00">
                </div>
                <div class="form-group">
                    <label>事件 *</label>
                    <input type="text" id="taskEvent" value="${App.ui.attr(t.event)}" placeholder="如 新娘化妆">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>负责人</label>
                    ${personField}
                    <div class="form-hint">${this.staffContacts.length > 0 ? '从工作人员联络清单中选择，或手动输入' : '请先在「工作人员」模块录入人员'}</div>
                </div>
                <div class="form-group">
                    <label>地点</label>
                    <input type="text" id="taskLocation" value="${App.ui.attr(t.location)}" placeholder="如 新娘家/酒店">
                </div>
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="taskRemarks" rows="2" placeholder="补充说明">${App.ui.attr(t.remarks)}</textarea>
            </div>
            <div class="form-group">
                <label class="status-checkbox">
                    <input type="checkbox" id="taskIsKey" ${t.is_key?'checked':''}>
                    标记为关键流程节点（标红提醒）
                </label>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveTaskBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑流程' : '新增流程', bodyHtml, footerHtml, () => {
            // checkbox 点击时切换高亮样式
            const personGroup = document.getElementById('taskPersonGroup');
            if (personGroup) {
                personGroup.querySelectorAll('.task-person-cb').forEach(cb => {
                    cb.addEventListener('change', () => {
                        cb.closest('.person-checkbox-item').classList.toggle('checked', cb.checked);
                    });
                });
            }

            document.getElementById('saveTaskBtn').onclick = async () => {
                const event = document.getElementById('taskEvent').value.trim();
                if (!event) { App.ui.toast('请输入事件名称', 'error'); return; }

                // 获取负责人值（支持多选）
                let personInCharge = '';
                if (this.staffContacts.length > 0) {
                    const checked = Array.from(document.querySelectorAll('.task-person-cb:checked')).map(cb => cb.value);
                    const customEl = document.getElementById('taskPersonCustom');
                    const custom = customEl ? customEl.value.trim() : '';
                    const customArr = custom ? custom.split(',').map(s => s.trim()).filter(Boolean) : [];
                    // 合并去重
                    const all = [...new Set([...checked, ...customArr])];
                    personInCharge = all.join(', ');
                } else {
                    const input = document.getElementById('taskPerson');
                    if (input) personInCharge = input.value.trim();
                }

                const payload = {
                    task_time: document.getElementById('taskTime').value.trim(),
                    event,
                    person_in_charge: personInCharge,
                    location: document.getElementById('taskLocation').value.trim(),
                    remarks: document.getElementById('taskRemarks').value.trim(),
                    is_key: document.getElementById('taskIsKey').checked
                };
                try {
                    if (isEdit) {
                        await App.db.update('timeline_tasks', t.id, payload);
                        await App.tracker.log('编辑', '婚礼流程', `修改流程「${event}」`);
                    } else {
                        payload.status = '未开始';
                        payload.sort_order = Date.now();
                        await App.db.insert('timeline_tasks', payload);
                        await App.tracker.log('新增', '婚礼流程', `新增流程「${event}」`);
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已添加', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteTask: function(task) {
        App.ui.confirm(`确定删除流程「${task.event}」吗？`, '此操作不可撤销', async () => {
            try {
                await App.db.delete('timeline_tasks', task.id);
                await App.tracker.log('删除', '婚礼流程', `删除流程「${task.event}」`);
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    toggleStatus: async function(id, status) {
        try {
            await App.db.update('timeline_tasks', id, { status });
            const task = this.data.find(t => t.id === id);
            await App.tracker.log('编辑', '婚礼流程', `「${task?.event||''}」状态改为「${status}」`);
        } catch(e) { App.ui.toast('状态更新失败', 'error'); }
    },

    reorder: async function(newOrder) {
        try {
            for (let i = 0; i < newOrder.length; i++) {
                await App.db.update('timeline_tasks', newOrder[i], { sort_order: i });
            }
            await App.tracker.log('编辑', '婚礼流程', '调整流程顺序');
        } catch(e) { console.error('[Timeline] 排序失败:', e); }
    },

    copyList: function() {
        if (this.data.length === 0) { App.ui.toast('暂无流程数据', 'error'); return; }
        let text = '═══ 婚礼全天流程时间轴 ═══\n\n';
        this.data.forEach((t, i) => {
            text += `${i+1}. [${t.task_time || '时间待定'}] ${t.event}`;
            if (t.is_key) text += ' ★关键';
            text += '\n';
            if (t.person_in_charge) text += `   负责人: ${t.person_in_charge}\n`;
            if (t.location) text += `   地点: ${t.location}\n`;
            if (t.remarks) text += `   备注: ${t.remarks}\n`;
            text += `   状态: ${t.status}\n\n`;
        });
        text += '──────────────\n';
        const done = this.data.filter(t => t.status === '已完成').length;
        text += `已完成 ${done}/${this.data.length} 项`;
        App.ui.copyText(text);
    }
};

})();
