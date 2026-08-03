/**
 * ============================================================
 * app.js - 应用主入口
 * ============================================================
 * 负责应用启动流程：初始化、登录验证、模块注册、
 * 实时同步启动
 * ============================================================
 */

(function() {
'use strict';

window.App = window.App || {};
App.modules = App.modules || {};

// ============================================================
// 应用启动
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    // 显示预览模式提示
    if (!App.isSupabaseConfigured) {
        const banner = document.getElementById('previewBanner');
        if (banner) banner.style.display = 'block';
        const hint = document.getElementById('loginModeHint');
        if (hint) hint.textContent = '预览模式 · 初始管理员 wedding_admin / Wedding2026!';
    } else {
        const hint = document.getElementById('loginModeHint');
        if (hint) hint.textContent = '已连接云端 · 实时同步已启用';
    }

    // 确保管理员账号存在
    await App.auth.ensureAdminExists();

    // 检查已有会话
    const session = App.auth.restoreSession();
    if (session) {
        startApp();
    } else {
        showLogin();
    }

    // 登录表单提交
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
});

// ============================================================
// 登录处理
// ============================================================
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const loginBtn = document.getElementById('loginBtn');

    if (!username || !password) {
        showLoginError('请输入账号和密码');
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';
    errorEl.style.display = 'none';

    try {
        const user = await App.auth.login(username, password);
        startApp();

        // 首次登录提醒（管理员初始密码）
        if (username === App.config.ADMIN_USERNAME) {
            setTimeout(() => {
                showFirstLoginWarning();
            }, 500);
        }
    } catch(err) {
        showLoginError(err.message || '登录失败');
        loginBtn.disabled = false;
        loginBtn.textContent = '登 录';
    }
}

function showLoginError(msg) {
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = false;
    loginBtn.textContent = '登 录';
}

function showFirstLoginWarning() {
    const bodyHtml = `
        <div class="confirm-body">
            <div class="confirm-icon">🔐</div>
            <div class="confirm-text" style="font-size: 16px; font-weight: 600; color: var(--c-warning);">
                首次登录提醒
            </div>
            <div class="confirm-sub" style="margin-top: 12px; line-height: 1.8;">
                您正在使用初始超级管理员账号登录。<br>
                为了账号安全，请<strong>立即前往用户管理面板</strong>修改登录密码！<br><br>
                修改路径：顶部导航 → 用户管理 → 重置密码
            </div>
        </div>
    `;
    const footerHtml = `
        <button class="btn btn-primary" id="warningOkBtn">我知道了</button>
    `;
    App.ui.showModal('安全提醒', bodyHtml, footerHtml, () => {
        document.getElementById('warningOkBtn').onclick = () => App.ui.hideModal();
    });
}

// ============================================================
    // 启动主应用
    // ============================================================
    async function startApp() {
        // 隐藏登录界面
        document.getElementById('loginScreen').style.display = 'none';
        // 显示主应用
        document.getElementById('mainApp').style.display = 'block';

        // 初始化导航
        App.ui.initNav();

        // 初始化所有模块
        Object.keys(App.modules).forEach(id => {
            if (typeof App.modules[id].init === 'function') {
                try { App.modules[id].init(); } catch(e) { console.error(`[${id}] init error:`, e); }
            }
        });

        // 加载动态下拉选项
        await App.config.loadDynamicOptions();

        // 启动实时同步
        App.realtime.init();

        // 初始化 AI 智能助手
        if (App.assistant && typeof App.assistant.init === 'function') {
            try { App.assistant.init(); } catch(e) { console.error('[Assistant] init error:', e); }
        }

        // 显示首页
        App.ui.switchView('dashboard');

        // 重置登录表单
        const loginBtn = document.getElementById('loginBtn');
        loginBtn.disabled = false;
        loginBtn.textContent = '登 录';
    }

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

// ============================================================
// 暴露给全局（供 HTML 内联事件调用）
// ============================================================
window.App.ui = App.ui;

})();
