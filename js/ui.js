/**
 * ============================================================
 * ui.js - UI 工具集
 * ============================================================
 * 包含：导航切换、弹窗系统、确认框、复制功能、
 *       格式化工具、拖拽排序工具
 * ============================================================
 */

(function() {
'use strict';

window.App = window.App || {};
App.ui = {};

// ============================================================
// 0. 导航栏状态管理（响应式侧边栏）
// ============================================================

// 移动端断点（与 CSS @media max-width: 768px 保持一致）
App.ui.MOBILE_BREAKPOINT = 768;
// localStorage 键名 — 保存用户对侧边栏展开/收起的偏好
App.ui.NAV_PREF_KEY = 'wedding_nav_open';

// 判断当前是否为移动端视口
App.ui.isMobile = function() {
    return window.innerWidth <= App.ui.MOBILE_BREAKPOINT;
};

// 侧边导航栏是否处于展开状态
App.ui.isNavOpen = function() {
    var navList = document.getElementById('navList');
    return navList ? navList.classList.contains('open') : false;
};

// 折叠侧边导航栏
App.ui.collapseNav = function() {
    var navList = document.getElementById('navList');
    if (navList && navList.classList.contains('open')) {
        navList.classList.remove('open');
    }
};

// 展开侧边导航栏
App.ui.expandNav = function() {
    var navList = document.getElementById('navList');
    if (navList) navList.classList.add('open');
};

// 将当前侧边栏状态保存到 localStorage（记录用户偏好）
App.ui.saveNavState = function() {
    try {
        localStorage.setItem(App.ui.NAV_PREF_KEY, App.ui.isNavOpen() ? '1' : '0');
    } catch(e) { /* localStorage 不可用时静默忽略 */ }
};

// 从 localStorage 恢复用户偏好（页面加载 / 登录后调用）
App.ui.restoreNavState = function() {
    // 桌面端导航栏始终展开（水平条），无需恢复
    if (!App.ui.isMobile()) return;
    try {
        var saved = localStorage.getItem(App.ui.NAV_PREF_KEY);
        // 只有明确保存了 '1' 才自动展开，默认关闭
        if (saved === '1') {
            App.ui.expandNav();
        }
    } catch(e) { /* 静默忽略 */ }
};

// ============================================================
// 1. 导航 & 视图切换
// ============================================================
App.ui.initNav = function() {
    const navList = document.getElementById('navList');
    const user = App.auth.currentUser;

    // 生成导航项
    navList.innerHTML = App.config.MODULES.map(m => {
        if (m.adminOnly && !App.auth.isAdmin()) return '';
        return `<li><a class="nav-link" data-view="${m.id}">${m.icon} ${m.name}</a></li>`;
    }).join('');

    // 点击导航 — switchView 内部统一处理移动端自动折叠
    navList.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            App.ui.switchView(link.dataset.view);
        });
    });

    // 移动端菜单切换按钮 — 保存用户偏好到 localStorage
    const navToggle = document.getElementById('navToggle');
    if (navToggle) {
        navToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            navList.classList.toggle('open');
            App.ui.saveNavState();
        });
    }

    // 移动端：点击侧边栏以外空白区域，自动收起导航
    document.addEventListener('click', (e) => {
        if (!App.ui.isMobile()) return;       // 仅移动端生效
        if (!App.ui.isNavOpen()) return;       // 导航未展开则跳过
        // 点击目标在导航列表和切换按钮之外时收起
        if (!navList.contains(e.target) &&
            (!navToggle || !navToggle.contains(e.target))) {
            App.ui.collapseNav();
            App.ui.saveNavState();
        }
    });

    // 桌面端：箭头按钮滚动
    this._enableNavArrows(navList);

    // 退出登录
    document.getElementById('logoutBtn').addEventListener('click', () => {
        App.ui.confirm('确定要退出登录吗？', '', () => {
            App.auth.logout();
            location.reload();
        });
    });

    // 显示用户信息
    document.getElementById('currentUserName').textContent = user.name;
    const roleBadge = document.getElementById('currentUserRole');
    roleBadge.textContent = user.role === 'admin' ? '管理员' : '访客';

    // 根据角色设置 body class
    document.body.className = user.role === 'admin' ? 'role-admin' : 'role-viewer';

    // 恢复用户上次保存的侧边栏偏好
    this.restoreNavState();
};

// 桌面端导航栏箭头滚动
App.ui._enableNavArrows = function(navList) {
    const arrowLeft = document.getElementById('navArrowLeft');
    const arrowRight = document.getElementById('navArrowRight');
    if (!arrowLeft || !arrowRight) return;

    const SCROLL_AMOUNT = 200;

    const updateArrows = () => {
        const maxScroll = navList.scrollWidth - navList.clientWidth;
        const hasOverflow = maxScroll > 5;
        // 左箭头：有内容被滚到左边时显示
        arrowLeft.classList.toggle('visible', hasOverflow && navList.scrollLeft > 5);
        // 右箭头：右边还有未显示内容时显示
        arrowRight.classList.toggle('visible', hasOverflow && navList.scrollLeft < maxScroll - 5);
    };

    arrowLeft.addEventListener('click', () => {
        navList.scrollBy({ left: -SCROLL_AMOUNT, behavior: 'smooth' });
    });
    arrowRight.addEventListener('click', () => {
        navList.scrollBy({ left: SCROLL_AMOUNT, behavior: 'smooth' });
    });

    navList.addEventListener('scroll', updateArrows, { passive: true });
    // 初始检查 + 延迟检查（等 DOM 渲染完）
    updateArrows();
    setTimeout(updateArrows, 100);
    window.addEventListener('resize', updateArrows);
};

// 将当前激活的导航项滚动到可见区域
App.ui.scrollActiveNavIntoView = function() {
    const navList = document.getElementById('navList');
    if (!navList) return;
    const active = navList.querySelector('.nav-link.active');
    if (!active) return;
    const listRect = navList.getBoundingClientRect();
    const itemRect = active.getBoundingClientRect();
    // 如果项不在可见区域内，滚动到合适位置
    if (itemRect.left < listRect.left + 10 || itemRect.right > listRect.right - 10) {
        navList.scrollTo({
            left: active.offsetLeft - navList.offsetLeft - 20,
            behavior: 'smooth'
        });
    }
};

App.ui.switchView = function(viewId) {
    // 隐藏所有视图
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // 显示目标视图
    const view = document.getElementById('view-' + viewId);
    if (view) view.classList.add('active');

    // 更新导航高亮
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.toggle('active', l.dataset.view === viewId);
    });

    // 自动滚动导航项到可见区域
    this.scrollActiveNavIntoView();

    // 触发模块加载
    if (App.modules[viewId] && typeof App.modules[viewId].onShow === 'function') {
        App.modules[viewId].onShow();
    }

    // 滚动到顶部
    window.scrollTo(0, 0);

    // 移动端：页面跳转后自动折叠侧边导航栏
    // 此逻辑优先级最高 — 即使 localStorage 中保存了「展开」偏好，跳转后仍强制折叠
    if (this.isMobile()) {
        this.collapseNav();
    }
};

// ============================================================
// 2. 弹窗系统
// ============================================================
App.ui.showModal = function(title, bodyHtml, footerHtml, onMount) {
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml || '';
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    overlay.style.display = 'flex';

    if (typeof onMount === 'function') {
        onMount(document.getElementById('modalBody'));
    }
};

App.ui.hideModal = function() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('modalBody').innerHTML = '';
    document.getElementById('modalFooter').innerHTML = '';
};

// 弹窗关闭事件
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('modalClose');
    const overlay = document.getElementById('modalOverlay');
    if (closeBtn) closeBtn.addEventListener('click', () => App.ui.hideModal());
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) App.ui.hideModal();
        });
    }
});

// ============================================================
// 3. 确认弹窗
// ============================================================
App.ui.confirm = function(text, subText, onConfirm, confirmText) {
    const bodyHtml = `
        <div class="confirm-body">
            <div class="confirm-icon">⚠️</div>
            <div class="confirm-text">${text}</div>
            ${subText ? `<div class="confirm-sub">${subText}</div>` : ''}
        </div>
    `;
    const footerHtml = `
        <button class="btn btn-outline" id="confirmCancelBtn">取消</button>
        <button class="btn btn-danger" id="confirmOkBtn">${confirmText || '确定'}</button>
    `;
    App.ui.showModal('请确认', bodyHtml, footerHtml, () => {
        document.getElementById('confirmCancelBtn').onclick = () => App.ui.hideModal();
        document.getElementById('confirmOkBtn').onclick = () => {
            App.ui.hideModal();
            if (onConfirm) onConfirm();
        };
    });
};

// ============================================================
// 4. 复制到剪贴板
// ============================================================
App.ui.copyText = async function(text) {
    try {
        await navigator.clipboard.writeText(text);
        App.ui.toast('已复制到剪贴板', 'success');
    } catch(e) {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            App.ui.toast('已复制到剪贴板', 'success');
        } catch(e2) {
            App.ui.toast('复制失败，请手动选择文本复制', 'error');
        }
        textarea.remove();
    }
};

// ============================================================
// 5. Toast 提示（本地操作反馈）
// ============================================================
App.ui.toast = function(message, type) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const iconMap = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    toast.innerHTML = `
        <div class="toast-icon">${iconMap[type] || '🔔'}</div>
        <div class="toast-body">
            <div class="toast-title">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;
    if (type === 'error') toast.style.borderLeftColor = 'var(--c-danger)';
    if (type === 'success') toast.style.borderLeftColor = 'var(--c-success)';
    container.appendChild(toast);
    toast.querySelector('.toast-close').onclick = () => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    };
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('toast-out');
            setTimeout(() => toast.remove(), 300);
        }
    }, 3000);
};

// ============================================================
// 6. 格式化工具
// ============================================================
App.ui.formatDateTime = function(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}年${m}月${day}日 ${h}:${min}`;
};

App.ui.formatDate = function(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}年${m}月${day}日`;
};

App.ui.formatMoney = function(num) {
    const n = Number(num) || 0;
    return n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

App.ui.escapeHtml = function(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
};

App.ui.formatLogTime = function(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}:${s}`;
};

// ============================================================
// 7. 拖拽排序工具
// ============================================================
App.ui.initDragSort = function(container, itemSelector, onReorder) {
    let dragSrc = null;

    const getItems = () => Array.from(container.querySelectorAll(itemSelector));

    getItems().forEach(item => {
        item.draggable = true;

        item.addEventListener('dragstart', (e) => {
            dragSrc = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            container.querySelectorAll(itemSelector).forEach(i => i.classList.remove('drag-over'));
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            if (dragSrc && dragSrc !== item) {
                item.classList.add('drag-over');
            }
        });

        item.addEventListener('dragleave', () => {
            item.classList.remove('drag-over');
        });

        item.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.classList.remove('drag-over');
            if (!dragSrc || dragSrc === item) return;

            // 确定插入位置
            const rect = item.getBoundingClientRect();
            const midpoint = rect.top + rect.height / 2;
            if (e.clientY < midpoint) {
                container.insertBefore(dragSrc, item);
            } else {
                container.insertBefore(dragSrc, item.nextSibling);
            }

            // 收集新顺序并回调
            const newOrder = getItems().map(el => el.dataset.id);
            if (onReorder) onReorder(newOrder);
        });
    });

    // 触摸事件支持（移动端）
    let touchDragSrc = null;
    let touchClone = null;

    getItems().forEach(item => {
        let touchStartY = 0;
        let touchStartX = 0;
        let isDragging = false;

        item.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' ||
                e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' ||
                e.target.closest('button') || e.target.closest('input')) return;
            const touch = e.touches[0];
            touchStartY = touch.clientY;
            touchStartX = touch.clientX;
            touchDragSrc = item;
        }, { passive: true });

        item.addEventListener('touchmove', (e) => {
            if (!touchDragSrc || touchDragSrc !== item) return;
            const touch = e.touches[0];
            const dy = Math.abs(touch.clientY - touchStartY);
            const dx = Math.abs(touch.clientX - touchStartX);
            if (!isDragging && dy > 10 && dy > dx) {
                isDragging = true;
                item.classList.add('dragging');
            }
            if (isDragging) {
                e.preventDefault();
                // 找到当前手指下方的元素
                const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetItem = elemBelow ? elemBelow.closest(itemSelector) : null;
                container.querySelectorAll(itemSelector).forEach(i => i.classList.remove('drag-over'));
                if (targetItem && targetItem !== item) {
                    targetItem.classList.add('drag-over');
                }
            }
        }, { passive: false });

        item.addEventListener('touchend', (e) => {
            if (!isDragging) {
                touchDragSrc = null;
                return;
            }
            isDragging = false;
            item.classList.remove('dragging');
            const touch = e.changedTouches[0];
            const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetItem = elemBelow ? elemBelow.closest(itemSelector) : null;
            container.querySelectorAll(itemSelector).forEach(i => i.classList.remove('drag-over'));

            if (targetItem && targetItem !== item) {
                const rect = targetItem.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                if (touch.clientY < midpoint) {
                    container.insertBefore(item, targetItem);
                } else {
                    container.insertBefore(item, targetItem.nextSibling);
                }
                const newOrder = getItems().map(el => el.dataset.id);
                if (onReorder) onReorder(newOrder);
            }
            touchDragSrc = null;
        });
    });
};

// ============================================================
// 8. HTML 转义工具（用于生成表单值）
// ============================================================
App.ui.attr = function(text) {
    if (text == null) return '';
    return String(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};

})();
