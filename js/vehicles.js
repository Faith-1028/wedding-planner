/**
 * ============================================================
 * vehicles.js - 接送车辆排班管理模块
 * ============================================================
 * 功能：多台车辆录入、车内人员管理、拖拽排序、
 *       宾客/工作人员导入、权限控制、导出预览
 * ============================================================
 */

(function() {
'use strict';

App.modules = App.modules || {};

App.modules.vehicles = {
    data: [],
    passengers: [],
    guests: [],
    staffList: [],

    onShow: function() {
        this.load();
    },

    init: function() {
        document.getElementById('addVehicleBtn').addEventListener('click', () => this.showForm());
        document.getElementById('vehiclesCopyBtn').addEventListener('click', () => this.exportRoster());
    },

    load: async function() {
        try {
            const [vehicles, passengers, guests, staff] = await Promise.all([
                App.db.select('vehicles', 'sort_order'),
                App.db.select('vehicle_passengers'),
                App.db.select('guests'),
                App.db.select('staff_contacts')
            ]);
            this.data = vehicles;
            this.passengers = passengers;
            this.guests = guests;
            this.staffList = staff;
            this.render();
        } catch(e) {
            console.error('[Vehicles] 加载失败:', e);
            App.ui.toast('加载车辆数据失败', 'error');
        }
    },

    refresh: function() {
        this.load();
    },

    getVehiclePassengers: function(vehicleId) {
        return this.passengers
            .filter(p => p.vehicle_id === vehicleId)
            .sort((a, b) => (a.seat_order || 0) - (b.seat_order || 0));
    },

    render: function() {
        const container = document.getElementById('vehiclesList');
        if (!container) return;

        if (this.data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🚗</div>
                    <div class="empty-state-text">暂无车辆排班信息，点击「新增车辆」开始安排接送</div>
                </div>
            `;
            return;
        }

        const totalPassengers = this.passengers.length;
        const weddingCars = this.data.filter(v => v.is_wedding_car).length;

        let summaryHtml = `
            <div class="vehicles-summary">
                <div class="vehicle-stat-item">
                    <span class="vehicle-stat-num">${this.data.length}</span>
                    <span class="vehicle-stat-label">总车辆</span>
                </div>
                <div class="vehicle-stat-item">
                    <span class="vehicle-stat-num">${weddingCars}</span>
                    <span class="vehicle-stat-label">婚车</span>
                </div>
                <div class="vehicle-stat-item">
                    <span class="vehicle-stat-num">${totalPassengers}</span>
                    <span class="vehicle-stat-label">乘车人员</span>
                </div>
            </div>
        `;

        container.innerHTML = summaryHtml + this.data.map(v => this.renderVehicleCard(v)).join('');

        // 绑定拖拽排序（车辆级别）
        const isAdmin = App.auth.isAdmin();
        if (isAdmin) {
            App.ui.initDragSort(container, '.vehicle-card', (newOrder) => this.reorderVehicles(newOrder));
        }

        // 绑定车辆操作按钮
        container.querySelectorAll('[data-action="edit-vehicle"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = this.data.find(v => v.id === btn.dataset.id);
                if (item) this.showForm(item);
            });
        });
        container.querySelectorAll('[data-action="del-vehicle"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = this.data.find(v => v.id === btn.dataset.id);
                if (item) this.deleteVehicle(item);
            });
        });
        container.querySelectorAll('[data-action="add-passenger"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const vid = btn.dataset.id;
                this.showPassengerForm(vid);
            });
        });
        container.querySelectorAll('[data-action="preview-vehicle"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = this.data.find(v => v.id === btn.dataset.id);
                if (item) this.showPreview(item);
            });
        });

        // 绑定乘客删除和拖拽排序
        container.querySelectorAll('[data-action="remove-passenger"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removePassenger(btn.dataset.id);
            });
        });

        // 乘客拖拽排序
        if (isAdmin) {
            container.querySelectorAll('.vehicle-passengers-list').forEach(list => {
                const vid = list.dataset.vehicleId;
                App.ui.initDragSort(list, '.passenger-chip-sortable', (newOrder) => {
                    this.reorderPassengers(vid, newOrder);
                });
            });
        }
    },

    renderVehicleCard: function(v) {
        const passengers = this.getVehiclePassengers(v.id);
        const isAdmin = App.auth.isAdmin();
        const weddingCarBadge = v.is_wedding_car ? '<span class="vehicle-badge-wedding">婚车</span>' : '';

        let routeHtml = '';
        if (v.departure || v.destination) {
            routeHtml = `
                <div class="vehicle-route">
                    <span class="route-point"><i class="route-icon-from">起</i>${App.ui.escapeHtml(v.departure || '未设置')}</span>
                    <span class="route-arrow">→</span>
                    <span class="route-point"><i class="route-icon-to">终</i>${App.ui.escapeHtml(v.destination || '未设置')}</span>
                </div>
            `;
        }

        let timeHtml = '';
        if (v.departure_time || v.arrival_time) {
            timeHtml = `
                <div class="vehicle-time-row">
                    ${v.departure_time ? `<span class="vehicle-time"><span class="time-tag">出发</span>${App.ui.escapeHtml(v.departure_time)}</span>` : ''}
                    ${v.arrival_time ? `<span class="vehicle-time"><span class="time-tag">抵达</span>${App.ui.escapeHtml(v.arrival_time)}</span>` : ''}
                </div>
            `;
        }

        let driverHtml = '';
        if (v.driver_name || v.driver_phone) {
            driverHtml = `
                <div class="vehicle-driver">
                    ${v.driver_name ? `<span class="info-row"><span class="info-label">司机</span>${App.ui.escapeHtml(v.driver_name)}</span>` : ''}
                    ${v.driver_phone ? `<span class="info-row"><span class="info-label">电话</span><a class="vehicle-phone" href="tel:${App.ui.escapeHtml(v.driver_phone)}">${App.ui.escapeHtml(v.driver_phone)}</a></span>` : ''}
                </div>
            `;
        }

        let detailsHtml = '';
        const details = [];
        if (v.vehicle_type) details.push(`<span class="vehicle-detail-tag">车型: ${App.ui.escapeHtml(v.vehicle_type)}</span>`);
        if (v.luggage_space) details.push(`<span class="vehicle-detail-tag">行李: ${App.ui.escapeHtml(v.luggage_space)}</span>`);
        if (v.special_needs) details.push(`<span class="vehicle-detail-tag vehicle-detail-warn">特殊: ${App.ui.escapeHtml(v.special_needs)}</span>`);
        if (details.length) detailsHtml = `<div class="vehicle-details">${details.join('')}</div>`;

        let remarksHtml = '';
        if (v.remarks) remarksHtml = `<div class="vehicle-remarks">备注: ${App.ui.escapeHtml(v.remarks)}</div>`;

        let passengersHtml = '';
        if (passengers.length === 0) {
            passengersHtml = '<div class="vehicle-no-passengers">暂无乘车人员</div>';
        } else {
            passengersHtml = passengers.map((p, idx) => `
                <span class="passenger-chip passenger-chip-sortable" data-id="${p.id}">
                    <span class="passenger-num">${idx + 1}</span>
                    <span class="passenger-name">${App.ui.escapeHtml(p.passenger_name)}</span>
                    ${p.passenger_type === 'guest' ? '<span class="passenger-src">宾客</span>' : ''}
                    ${p.passenger_type === 'staff' ? '<span class="passenger-src passenger-src-staff">工作人员</span>' : ''}
                    ${isAdmin ? `<button class="remove-btn" data-id="${p.id}" data-action="remove-passenger">&times;</button>` : ''}
                </span>
            `).join('');
        }

        return `
            <div class="vehicle-card" data-id="${v.id}">
                <div class="vehicle-card-header">
                    <div class="vehicle-card-title">
                        <span class="vehicle-number">🚗 ${App.ui.escapeHtml(v.vehicle_number || '车辆' + (this.data.indexOf(v) + 1))}</span>
                        ${weddingCarBadge}
                    </div>
                    <div class="vehicle-passenger-count">${passengers.length} 人</div>
                </div>
                <div class="vehicle-card-body">
                    ${driverHtml}
                    ${routeHtml}
                    ${timeHtml}
                    ${detailsHtml}
                    ${remarksHtml}
                </div>
                <div class="vehicle-passengers-section">
                    <div class="vehicle-passengers-header">
                        <span class="passengers-title">乘车人员</span>
                        ${isAdmin ? `<button class="btn btn-sm btn-outline" data-id="${v.id}" data-action="add-passenger">+ 添加</button>` : ''}
                    </div>
                    <div class="vehicle-passengers-list" data-vehicle-id="${v.id}">
                        ${passengersHtml}
                    </div>
                </div>
                <div class="vehicle-card-actions admin-only">
                    <button class="btn btn-sm btn-outline" data-id="${v.id}" data-action="preview-vehicle">预览</button>
                    <button class="btn btn-sm btn-outline" data-id="${v.id}" data-action="edit-vehicle">编辑</button>
                    <button class="btn btn-sm btn-danger" data-id="${v.id}" data-action="del-vehicle">删除</button>
                </div>
            </div>
        `;
    },

    // ============================================================
    // 车辆 CRUD
    // ============================================================
    showForm: function(item) {
        if (!App.auth.isAdmin()) { App.ui.toast('仅管理员可编辑', 'error'); return; }
        const isEdit = !!item;
        const v = item || {
            vehicle_number: '', driver_name: '', driver_phone: '',
            departure: '', destination: '', departure_time: '', arrival_time: '',
            vehicle_type: '', is_wedding_car: false, luggage_space: '',
            special_needs: '', remarks: ''
        };

        const bodyHtml = `
            <div class="form-row">
                <div class="form-group">
                    <label>车辆编号 *</label>
                    <input type="text" id="vNumber" value="${App.ui.attr(v.vehicle_number)}" placeholder="如 1号车 / 主婚车">
                </div>
                <div class="form-group">
                    <label>是否婚车</label>
                    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;">
                        <input type="checkbox" id="vWeddingCar" ${v.is_wedding_car ? 'checked' : ''} style="width:18px;height:18px;">
                        <label for="vWeddingCar" style="margin:0;cursor:pointer;">标记为婚车</label>
                    </div>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>司机姓名</label>
                    <input type="text" id="vDriverName" value="${App.ui.attr(v.driver_name)}" placeholder="司机姓名">
                </div>
                <div class="form-group">
                    <label>司机电话</label>
                    <input type="tel" id="vDriverPhone" value="${App.ui.attr(v.driver_phone)}" placeholder="司机联系电话">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>出发地点</label>
                    <input type="text" id="vDeparture" value="${App.ui.attr(v.departure)}" placeholder="如 新郎家 / 酒店">
                </div>
                <div class="form-group">
                    <label>目的地</label>
                    <input type="text" id="vDestination" value="${App.ui.attr(v.destination)}" placeholder="如 婚礼酒店 / 晚宴厅">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>预计出发时间</label>
                    <input type="text" id="vDepartureTime" value="${App.ui.attr(v.departure_time)}" placeholder="如 08:00">
                </div>
                <div class="form-group">
                    <label>预计抵达时间</label>
                    <input type="text" id="vArrivalTime" value="${App.ui.attr(v.arrival_time)}" placeholder="如 09:30">
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>车型</label>
                    <input type="text" id="vType" value="${App.ui.attr(v.vehicle_type)}" placeholder="如 奔驰S级 / 奥迪A6 / 别克GL8">
                </div>
                <div class="form-group">
                    <label>行李空间</label>
                    <input type="text" id="vLuggage" value="${App.ui.attr(v.luggage_space)}" placeholder="如 后备箱宽敞 / 可放3个行李箱">
                </div>
            </div>
            <div class="form-group">
                <label>特殊需求</label>
                <input type="text" id="vSpecialNeeds" value="${App.ui.attr(v.special_needs)}" placeholder="如 车内有老人/孕妇同行 / 需儿童座椅">
            </div>
            <div class="form-group">
                <label>车辆备注</label>
                <textarea id="vRemarks" rows="2" placeholder="其他补充信息">${App.ui.attr(v.remarks)}</textarea>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">取消</button>
            <button class="btn btn-primary" id="saveVehicleBtn">${isEdit ? '保存' : '添加'}</button>
        `;
        App.ui.showModal(isEdit ? '编辑车辆信息' : '新增车辆', bodyHtml, footerHtml, () => {
            document.getElementById('saveVehicleBtn').onclick = async () => {
                const number = document.getElementById('vNumber').value.trim();
                if (!number) { App.ui.toast('请输入车辆编号', 'error'); return; }
                const payload = {
                    vehicle_number: number,
                    driver_name: document.getElementById('vDriverName').value.trim(),
                    driver_phone: document.getElementById('vDriverPhone').value.trim(),
                    departure: document.getElementById('vDeparture').value.trim(),
                    destination: document.getElementById('vDestination').value.trim(),
                    departure_time: document.getElementById('vDepartureTime').value.trim(),
                    arrival_time: document.getElementById('vArrivalTime').value.trim(),
                    vehicle_type: document.getElementById('vType').value.trim(),
                    is_wedding_car: document.getElementById('vWeddingCar').checked,
                    luggage_space: document.getElementById('vLuggage').value.trim(),
                    special_needs: document.getElementById('vSpecialNeeds').value.trim(),
                    remarks: document.getElementById('vRemarks').value.trim()
                };
                try {
                    if (isEdit) {
                        await App.db.update('vehicles', v.id, payload);
                        await App.tracker.log('编辑', '接送车辆', `修改车辆「${number}」`);
                    } else {
                        payload.sort_order = Date.now();
                        await App.db.insert('vehicles', payload);
                        await App.tracker.log('新增', '接送车辆', `新增车辆「${number}」`);
                    }
                    App.ui.hideModal();
                    App.ui.toast(isEdit ? '已保存' : '已添加', 'success');
                } catch(e) { App.ui.toast('操作失败：' + e.message, 'error'); }
            };
        });
    },

    deleteVehicle: function(item) {
        if (!App.auth.isAdmin()) { App.ui.toast('仅管理员可删除', 'error'); return; }
        const passengerCount = this.getVehiclePassengers(item.id).length;
        const subText = passengerCount > 0
            ? `该车辆已有 ${passengerCount} 名乘车人员，删除后需重新安排`
            : '此操作不可撤销';
        App.ui.confirm(`确定删除「${item.vehicle_number}」吗？`, subText, async () => {
            try {
                // 先删除该车的所有乘客
                const carPassengers = this.passengers.filter(p => p.vehicle_id === item.id);
                for (const p of carPassengers) {
                    await App.db.delete('vehicle_passengers', p.id);
                }
                await App.db.delete('vehicles', item.id);
                await App.tracker.log('删除', '接送车辆', `删除车辆「${item.vehicle_number}」${passengerCount > 0 ? `（含${passengerCount}名乘客）` : ''}`);
                App.ui.toast('已删除', 'success');
            } catch(e) { App.ui.toast('删除失败', 'error'); }
        });
    },

    reorderVehicles: async function(newOrder) {
        if (!App.auth.isAdmin()) return;
        try {
            for (let i = 0; i < newOrder.length; i++) {
                const v = this.data.find(x => x.id === newOrder[i]);
                if (v && v.sort_order !== i) {
                    await App.db.update('vehicles', newOrder[i], { sort_order: Date.now() + i });
                }
            }
        } catch(e) { console.error('[Vehicles] 排序失败:', e); }
    },

    // ============================================================
    // 乘车人员管理
    // ============================================================
    showPassengerForm: function(vehicleId) {
        if (!App.auth.isAdmin()) { App.ui.toast('仅管理员可编辑', 'error'); return; }
        const vehicle = this.data.find(v => v.id === vehicleId);
        if (!vehicle) return;
        const existingPassengerNames = new Set(this.getVehiclePassengers(vehicleId).map(p => p.passenger_name));

        const availableGuests = this.guests.filter(g => g.name && !existingPassengerNames.has(g.name));
        const availableStaff = this.staffList.filter(s => s.name && !existingPassengerNames.has(s.name));

        const bodyHtml = `
            <div class="passenger-add-section">
                <div class="passenger-add-tabs">
                    <button class="passenger-tab-btn active" data-tab="manual">手动添加</button>
                    <button class="passenger-tab-btn" data-tab="guest">从宾客导入</button>
                    <button class="passenger-tab-btn" data-tab="staff">从工作人员导入</button>
                </div>

                <div id="tab-manual" class="passenger-tab-content active">
                    <div class="form-group" style="margin-top:12px;">
                        <label>输入姓名</label>
                        <div style="display:flex;gap:8px;">
                            <input type="text" id="manualPassengerName" placeholder="输入乘车人员姓名" style="flex:1;">
                            <button class="btn btn-primary" id="addManualPassengerBtn">添加</button>
                        </div>
                    </div>
                </div>

                <div id="tab-guest" class="passenger-tab-content" style="display:none;">
                    <div style="margin-top:12px;">
                        ${availableGuests.length === 0
                            ? '<div style="color:var(--c-text-muted);font-size:13px;padding:12px;">暂无可导入的宾客（可能已全部添加）</div>'
                            : `<div class="import-person-list">${availableGuests.map(g => `
                                <label class="import-person-item">
                                    <input type="checkbox" value="${App.ui.attr(g.name)}" data-source-id="${App.ui.attr(g.id)}" data-type="guest">
                                    <span>${App.ui.escapeHtml(g.name)}</span>
                                    ${g.group_type ? `<span style="color:var(--c-text-muted);font-size:11px;margin-left:4px;">(${g.group_type})</span>` : ''}
                                    ${g.adults > 1 ? `<span style="color:var(--c-text-muted);font-size:11px;">×${g.adults}</span>` : ''}
                                </label>
                            `).join('')}</div>`
                        }
                    </div>
                    ${availableGuests.length > 0 ? '<button class="btn btn-primary btn-block" id="addGuestPassengersBtn" style="margin-top:12px;">导入选中宾客</button>' : ''}
                </div>

                <div id="tab-staff" class="passenger-tab-content" style="display:none;">
                    <div style="margin-top:12px;">
                        ${availableStaff.length === 0
                            ? '<div style="color:var(--c-text-muted);font-size:13px;padding:12px;">暂无可导入的工作人员（可能已全部添加）</div>'
                            : `<div class="import-person-list">${availableStaff.map(s => `
                                <label class="import-person-item">
                                    <input type="checkbox" value="${App.ui.attr(s.name)}" data-source-id="${App.ui.attr(s.id)}" data-type="staff">
                                    <span>${App.ui.escapeHtml(s.name)}</span>
                                    ${s.role_desc ? `<span style="color:var(--c-text-muted);font-size:11px;margin-left:4px;">(${s.role_desc})</span>` : ''}
                                    ${s.category ? `<span style="color:var(--c-text-muted);font-size:11px;">[${s.category}]</span>` : ''}
                                </label>
                            `).join('')}</div>`
                        }
                    </div>
                    ${availableStaff.length > 0 ? '<button class="btn btn-primary btn-block" id="addStaffPassengersBtn" style="margin-top:12px;">导入选中工作人员</button>' : ''}
                </div>
            </div>
        `;

        const footerHtml = `<button class="btn btn-outline" onclick="App.ui.hideModal()">完成</button>`;
        App.ui.showModal(`添加乘车人员 — ${vehicle.vehicle_number}`, bodyHtml, footerHtml, () => {
            // Tab 切换
            document.querySelectorAll('.passenger-tab-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.passenger-tab-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    document.querySelectorAll('.passenger-tab-content').forEach(c => c.style.display = 'none');
                    document.getElementById('tab-' + btn.dataset.tab).style.display = 'block';
                    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
                });
            });

            // 手动添加
            const manualBtn = document.getElementById('addManualPassengerBtn');
            if (manualBtn) {
                manualBtn.addEventListener('click', async () => {
                    const name = document.getElementById('manualPassengerName').value.trim();
                    if (!name) { App.ui.toast('请输入姓名', 'error'); return; }
                    try {
                        await App.db.insert('vehicle_passengers', {
                            vehicle_id: vehicleId,
                            passenger_name: name,
                            passenger_type: 'custom',
                            source_id: '',
                            seat_order: Date.now()
                        });
                        await App.tracker.log('新增', '接送车辆', `为「${vehicle.vehicle_number}」添加乘客「${name}」`);
                        document.getElementById('manualPassengerName').value = '';
                        App.ui.toast('已添加', 'success');
                    } catch(e) { App.ui.toast('添加失败：' + e.message, 'error'); }
                });
            }

            // 宾客导入
            const guestBtn = document.getElementById('addGuestPassengersBtn');
            if (guestBtn) {
                guestBtn.addEventListener('click', async () => {
                    const checked = document.querySelectorAll('#tab-guest input[type="checkbox"]:checked');
                    if (checked.length === 0) { App.ui.toast('请至少选择一位宾客', 'error'); return; }
                    try {
                        const names = [];
                        for (const cb of checked) {
                            await App.db.insert('vehicle_passengers', {
                                vehicle_id: vehicleId,
                                passenger_name: cb.value,
                                passenger_type: 'guest',
                                source_id: cb.dataset.sourceId,
                                seat_order: Date.now() + names.length
                            });
                            names.push(cb.value);
                        }
                        await App.tracker.log('新增', '接送车辆', `为「${vehicle.vehicle_number}」导入${names.length}位宾客`);
                        App.ui.toast(`已导入 ${names.length} 位宾客`, 'success');
                        // 刷新弹窗内容
                        this.load().then(() => this.showPassengerForm(vehicleId));
                    } catch(e) { App.ui.toast('导入失败：' + e.message, 'error'); }
                });
            }

            // 工作人员导入
            const staffBtn = document.getElementById('addStaffPassengersBtn');
            if (staffBtn) {
                staffBtn.addEventListener('click', async () => {
                    const checked = document.querySelectorAll('#tab-staff input[type="checkbox"]:checked');
                    if (checked.length === 0) { App.ui.toast('请至少选择一位工作人员', 'error'); return; }
                    try {
                        const names = [];
                        for (const cb of checked) {
                            await App.db.insert('vehicle_passengers', {
                                vehicle_id: vehicleId,
                                passenger_name: cb.value,
                                passenger_type: 'staff',
                                source_id: cb.dataset.sourceId,
                                seat_order: Date.now() + names.length
                            });
                            names.push(cb.value);
                        }
                        await App.tracker.log('新增', '接送车辆', `为「${vehicle.vehicle_number}」导入${names.length}位工作人员`);
                        App.ui.toast(`已导入 ${names.length} 位工作人员`, 'success');
                        this.load().then(() => this.showPassengerForm(vehicleId));
                    } catch(e) { App.ui.toast('导入失败：' + e.message, 'error'); }
                });
            }
        });
    },

    removePassenger: async function(passengerId) {
        if (!App.auth.isAdmin()) { App.ui.toast('仅管理员可编辑', 'error'); return; }
        const p = this.passengers.find(x => x.id === passengerId);
        if (!p) return;
        const vehicle = this.data.find(v => v.id === p.vehicle_id);
        try {
            await App.db.delete('vehicle_passengers', passengerId);
            await App.tracker.log('删除', '接送车辆', `从「${vehicle ? vehicle.vehicle_number : '车辆'}」移除乘客「${p.passenger_name}」`);
        } catch(e) { App.ui.toast('移除失败', 'error'); }
    },

    reorderPassengers: async function(vehicleId, newOrder) {
        if (!App.auth.isAdmin()) return;
        try {
            for (let i = 0; i < newOrder.length; i++) {
                await App.db.update('vehicle_passengers', newOrder[i], { seat_order: Date.now() + i });
            }
        } catch(e) { console.error('[Vehicles] 乘客排序失败:', e); }
    },

    // ============================================================
    // 导出 & 预览
    // ============================================================
    exportRoster: function() {
        if (this.data.length === 0) { App.ui.toast('暂无车辆数据', 'error'); return; }
        let text = '═══ 婚礼接送车辆排班表 ═══\n\n';
        let totalPassengers = 0;
        this.data.forEach((v, idx) => {
            const passengers = this.getVehiclePassengers(v.id);
            totalPassengers += passengers.length;
            text += `【${v.vehicle_number || '车辆' + (idx + 1)}】${v.is_wedding_car ? ' 💒婚车' : ''}\n`;
            if (v.driver_name) text += `  司机: ${v.driver_name}`;
            if (v.driver_phone) text += `  📞 ${v.driver_phone}`;
            if (v.driver_name || v.driver_phone) text += '\n';
            if (v.departure || v.destination) {
                text += `  路线: ${v.departure || '?'} → ${v.destination || '?'}\n`;
            }
            if (v.departure_time || v.arrival_time) {
                text += `  时间: ${v.departure_time || '--'} 出发 / ${v.arrival_time || '--'} 抵达\n`;
            }
            if (v.vehicle_type) text += `  车型: ${v.vehicle_type}\n`;
            if (v.luggage_space) text += `  行李: ${v.luggage_space}\n`;
            if (v.special_needs) text += `  ⚠ 特殊需求: ${v.special_needs}\n`;
            if (v.remarks) text += `  备注: ${v.remarks}\n`;
            text += `  乘车人员 (${passengers.length}人):\n`;
            if (passengers.length === 0) {
                text += `    （暂无）\n`;
            } else {
                passengers.forEach((p, i) => {
                    const srcTag = p.passenger_type === 'guest' ? '[宾客]' : p.passenger_type === 'staff' ? '[工作人员]' : '';
                    text += `    ${i + 1}. ${srcTag} ${p.passenger_name}\n`;
                });
            }
            text += '\n';
        });
        text += `──────────────\n`;
        text += `共 ${this.data.length} 辆车，${totalPassengers} 名乘车人员\n`;
        App.ui.copyText(text);
    },

    showPreview: function(vehicle) {
        const passengers = this.getVehiclePassengers(vehicle.id);
        const bodyHtml = `
            <div class="vehicle-preview-card">
                <div class="vehicle-preview-header">
                    <h3>🚗 ${App.ui.escapeHtml(vehicle.vehicle_number || '车辆')} ${vehicle.is_wedding_car ? '<span class="vehicle-badge-wedding">婚车</span>' : ''}</h3>
                </div>
                <div class="vehicle-preview-body">
                    ${vehicle.driver_name || vehicle.driver_phone ? `
                        <div class="preview-section">
                            <div class="preview-section-title">司机信息</div>
                            ${vehicle.driver_name ? `<div class="preview-row"><span>姓名</span><strong>${App.ui.escapeHtml(vehicle.driver_name)}</strong></div>` : ''}
                            ${vehicle.driver_phone ? `<div class="preview-row"><span>电话</span><strong>${App.ui.escapeHtml(vehicle.driver_phone)}</strong></div>` : ''}
                        </div>
                    ` : ''}
                    ${vehicle.departure || vehicle.destination || vehicle.departure_time || vehicle.arrival_time ? `
                        <div class="preview-section">
                            <div class="preview-section-title">行程安排</div>
                            ${vehicle.departure ? `<div class="preview-row"><span>出发地</span><strong>${App.ui.escapeHtml(vehicle.departure)}</strong></div>` : ''}
                            ${vehicle.destination ? `<div class="preview-row"><span>目的地</span><strong>${App.ui.escapeHtml(vehicle.destination)}</strong></div>` : ''}
                            ${vehicle.departure_time ? `<div class="preview-row"><span>出发时间</span><strong>${App.ui.escapeHtml(vehicle.departure_time)}</strong></div>` : ''}
                            ${vehicle.arrival_time ? `<div class="preview-row"><span>抵达时间</span><strong>${App.ui.escapeHtml(vehicle.arrival_time)}</strong></div>` : ''}
                        </div>
                    ` : ''}
                    ${vehicle.vehicle_type || vehicle.luggage_space || vehicle.special_needs ? `
                        <div class="preview-section">
                            <div class="preview-section-title">车辆详情</div>
                            ${vehicle.vehicle_type ? `<div class="preview-row"><span>车型</span><strong>${App.ui.escapeHtml(vehicle.vehicle_type)}</strong></div>` : ''}
                            ${vehicle.luggage_space ? `<div class="preview-row"><span>行李空间</span><strong>${App.ui.escapeHtml(vehicle.luggage_space)}</strong></div>` : ''}
                            ${vehicle.special_needs ? `<div class="preview-row"><span>特殊需求</span><strong style="color:var(--c-danger);">${App.ui.escapeHtml(vehicle.special_needs)}</strong></div>` : ''}
                        </div>
                    ` : ''}
                    ${vehicle.remarks ? `
                        <div class="preview-section">
                            <div class="preview-section-title">备注</div>
                            <div style="font-size:14px;color:var(--c-text-light);">${App.ui.escapeHtml(vehicle.remarks)}</div>
                        </div>
                    ` : ''}
                    <div class="preview-section">
                        <div class="preview-section-title">乘车人员名单 (${passengers.length}人)</div>
                        ${passengers.length === 0
                            ? '<div style="color:var(--c-text-muted);font-size:13px;padding:8px 0;">暂无乘车人员</div>'
                            : `<div class="preview-passenger-list">${passengers.map((p, i) => `
                                <div class="preview-passenger-item">
                                    <span class="preview-passenger-num">${i + 1}</span>
                                    <span class="preview-passenger-name">${App.ui.escapeHtml(p.passenger_name)}</span>
                                    ${p.passenger_type === 'guest' ? '<span class="passenger-src">宾客</span>' : ''}
                                    ${p.passenger_type === 'staff' ? '<span class="passenger-src passenger-src-staff">工作人员</span>' : ''}
                                </div>
                            `).join('')}</div>`
                        }
                    </div>
                </div>
            </div>
        `;
        const footerHtml = `
            <button class="btn btn-outline" onclick="App.ui.hideModal()">关闭</button>
            <button class="btn btn-primary" id="copyVehiclePreviewBtn">复制此车名单</button>
        `;
        App.ui.showModal('车辆排班预览', bodyHtml, footerHtml, () => {
            document.getElementById('copyVehiclePreviewBtn').onclick = () => {
                let text = `【${vehicle.vehicle_number}】${vehicle.is_wedding_car ? '婚车' : ''}\n`;
                if (vehicle.driver_name) text += `司机: ${vehicle.driver_name}\n`;
                if (vehicle.driver_phone) text += `电话: ${vehicle.driver_phone}\n`;
                if (vehicle.departure) text += `出发: ${vehicle.departure}`;
                if (vehicle.departure_time) text += ` ${vehicle.departure_time}`;
                if (vehicle.departure || vehicle.departure_time) text += '\n';
                if (vehicle.destination) text += `抵达: ${vehicle.destination}`;
                if (vehicle.arrival_time) text += ` ${vehicle.arrival_time}`;
                if (vehicle.destination || vehicle.arrival_time) text += '\n';
                if (vehicle.special_needs) text += `⚠ ${vehicle.special_needs}\n`;
                text += `\n乘车人员 (${passengers.length}人):\n`;
                passengers.forEach((p, i) => {
                    text += `${i + 1}. ${p.passenger_name}\n`;
                });
                App.ui.copyText(text);
            };
        });
    }
};

})();
