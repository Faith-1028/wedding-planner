/**
 * ============================================================
 * 配置文件 - Supabase 连接 & 全局常量
 * ============================================================
 *
 * 【重要】请在此处填入你的 Supabase 项目信息：
 * 1. 登录 https://supabase.com 创建项目（建议选新加坡区域）
 * 2. 执行 supabase-setup.sql 初始化数据库
 * 3. 在项目设置 > API 中找到 URL 和 anon key
 * 4. 填入下方两个变量
 *
 * 如果未配置，应用将以"预览模式"运行（数据仅保存在当前会话）
 * ============================================================
 */

window.App = window.App || {};

App.config = {
    // ===== Supabase 配置 =====
    SUPABASE_URL: 'https://cpdaenspyimjvogxcjpw.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwZGFlbnNweWltanZvZ3hjanB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0MTI0MzMsImV4cCI6MjEwMDk4ODQzM30._0yFB83QNB18N16WnWQNyI-i6tZz9Ck5csPT3S8d64Y',

    // ===== 初始管理员 =====
    ADMIN_USERNAME: 'wedding_admin',
    ADMIN_PASSWORD: 'Wedding2026!',
    ADMIN_NAME: '婚礼主管理员',

    // ===== 模块定义 =====
    MODULES: [
        { id: 'dashboard',  name: '首页总看板',   icon: '🏠' },
        { id: 'guests',     name: '宾客管理',     icon: '👥' },
        { id: 'timeline',   name: '婚礼流程',     icon: '📋' },
        { id: 'games',      name: '接亲游戏',     icon: '🎮' },
        { id: 'supplies',   name: '备婚物资',     icon: '📦' },
        { id: 'budget',     name: '婚礼预算',     icon: '💰' },
        { id: 'staff',      name: '工作人员',     icon: '👷' },
        { id: 'seating',    name: '席位桌次',     icon: '🍽️' },
        { id: 'memos',      name: '紧急备忘录',   icon: '📌' },
        { id: 'gifts',      name: '礼金记账',     icon: '🧧', adminOnly: true },
        { id: 'users',      name: '用户管理',     icon: '⚙️', adminOnly: true },
        { id: 'logs',       name: '操作日志',     icon: '📝', adminOnly: true },
        { id: 'settings',   name: '系统设置',     icon: '🛠️', adminOnly: true },
    ],

    // ===== 默认选项（数据库 app_settings 表为空时使用）=====
    DEFAULT_OPTIONS: {
        GUEST_GROUPS:      ['男方亲友', '女方亲友', '同事', '好友'],
        GUEST_STATUSES:    ['待邀请', '已邀请', '确认出席', '无法到场'],
        SUPPLY_CATEGORIES: ['婚房布置', '仪式用品', '服饰珠宝', '酒水喜糖', '伴手礼', '签到用品', '其他'],
        SUPPLY_STATUSES:   ['未采购', '已采购', '已打包'],
        TASK_STATUSES:     ['未开始', '进行中', '已完成'],
        BUDGET_CATEGORIES: ['婚宴酒席', '婚庆布置', '摄影摄像', '婚纱礼服', '珠宝首饰', '婚车', '喜糖伴手礼', '其他'],
        STAFF_CATEGORIES:  ['四大金刚', '伴郎伴娘', '婚庆工作人员', '双方家人'],
        SEATING_ZONES:     ['男方区', '女方区', '亲友区'],
        MEMO_TAGS:         ['应急方案', '合同备注', '物品存放', '备用物资', '通用'],
    },

    // ===== 下拉选项的元信息（用于"系统设置"模块）=====
    OPTION_META: [
        { key: 'GUEST_GROUPS',      dbKey: 'guest_groups',      title: '宾客分组',   desc: '宾客所属人群分组' },
        { key: 'GUEST_STATUSES',    dbKey: 'guest_statuses',    title: '宾客状态',   desc: '宾客邀请/出席状态' },
        { key: 'SUPPLY_CATEGORIES', dbKey: 'supply_categories', title: '物资分类',   desc: '备婚物资所属类别' },
        { key: 'SUPPLY_STATUSES',   dbKey: 'supply_statuses',   title: '物资状态',   desc: '物资采购/打包状态' },
        { key: 'TASK_STATUSES',     dbKey: 'task_statuses',     title: '流程状态',   desc: '婚礼流程任务状态' },
        { key: 'BUDGET_CATEGORIES', dbKey: 'budget_categories', title: '预算分类',   desc: '预算支出所属类别' },
        { key: 'STAFF_CATEGORIES',  dbKey: 'staff_categories',  title: '工作人员分类', desc: '工作人员所属分组' },
        { key: 'SEATING_ZONES',     dbKey: 'seating_zones',     title: '席位区域',   desc: '婚宴席位所属区域' },
        { key: 'MEMO_TAGS',         dbKey: 'memo_tags',         title: '备忘录标签', desc: '紧急备忘录分类标签' },
    ],

    // ===== 宾客分组选项（运行时由 loadDynamicOptions 覆盖）=====
    GUEST_GROUPS:      ['男方亲友', '女方亲友', '同事', '好友'],
    GUEST_STATUSES:    ['待邀请', '已邀请', '确认出席', '无法到场'],
    SUPPLY_CATEGORIES: ['婚房布置', '仪式用品', '服饰珠宝', '酒水喜糖', '伴手礼', '签到用品', '其他'],
    SUPPLY_STATUSES:   ['未采购', '已采购', '已打包'],
    TASK_STATUSES:     ['未开始', '进行中', '已完成'],
    BUDGET_CATEGORIES: ['婚宴酒席', '婚庆布置', '摄影摄像', '婚纱礼服', '珠宝首饰', '婚车', '喜糖伴手礼', '其他'],
    STAFF_CATEGORIES:  ['四大金刚', '伴郎伴娘', '婚庆工作人员', '双方家人'],
    SEATING_ZONES:     ['男方区', '女方区', '亲友区'],
    MEMO_TAGS:         ['应急方案', '合同备注', '物品存放', '备用物资', '通用'],
};

// ===== 初始化 Supabase 客户端 =====
// 只有 URL + Key 都填写 且 Supabase JS 库成功加载，才启用云端模式
App.isSupabaseConfigured = !!(App.config.SUPABASE_URL && App.config.SUPABASE_ANON_KEY);

if (App.isSupabaseConfigured && typeof supabase !== 'undefined') {
    try {
        App.supabase = supabase.createClient(
            App.config.SUPABASE_URL,
            App.config.SUPABASE_ANON_KEY,
            {
                realtime: { params: { eventsPerSecond: 10 } },
                auth: { persistSession: false }
            }
        );
    } catch(e) {
        console.error('[Config] Supabase 初始化失败，回退到预览模式:', e);
        App.supabase = null;
        App.isSupabaseConfigured = false;
    }
} else {
    // URL/Key 未填写 或 Supabase JS 库未加载
    App.supabase = null;
    App.isSupabaseConfigured = false;
}

// ===== 动态加载下拉选项（从 app_settings 表覆盖默认值）=====
App.config.loadDynamicOptions = async function() {
    if (!App.isSupabaseConfigured) return; // 预览模式：用默认值
    try {
        const rows = await App.db.select('app_settings');
        const map = {};
        rows.forEach(r => { map[r.key] = r.value; });
        // 把数据库里的 JSON 数组覆盖到 App.config 各常量上
        const reverseMap = {
            'guest_groups':      'GUEST_GROUPS',
            'guest_statuses':    'GUEST_STATUSES',
            'supply_categories': 'SUPPLY_CATEGORIES',
            'supply_statuses':   'SUPPLY_STATUSES',
            'task_statuses':     'TASK_STATUSES',
            'budget_categories': 'BUDGET_CATEGORIES',
            'staff_categories':  'STAFF_CATEGORIES',
            'seating_zones':     'SEATING_ZONES',
            'memo_tags':         'MEMO_TAGS'
        };
        for (const [dbKey, cfgKey] of Object.entries(reverseMap)) {
            if (Array.isArray(map[dbKey]) && map[dbKey].length > 0) {
                App.config[cfgKey] = map[dbKey];
            }
        }
        console.log('[Config] 动态选项加载完成');
    } catch(e) {
        console.warn('[Config] 加载动态选项失败，使用默认值:', e);
    }
};

// ===== 生成唯一客户端 ID（用于通知去重）=====
App.clientId = (sessionStorage.getItem('app_client_id') ||
    (crypto.randomUUID ? crypto.randomUUID() : 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2)));
sessionStorage.setItem('app_client_id', App.clientId);
