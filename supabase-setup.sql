-- ============================================================
-- 婚礼备婚协同管理平台 - Supabase 数据库初始化脚本
-- ============================================================
-- 使用方法：
-- 1. 登录 Supabase 控制台 (https://supabase.com)
-- 2. 创建新项目（建议选择新加坡区域，国内访问更快）
-- 3. 进入 SQL Editor，粘贴此脚本并执行
-- 4. 将项目 URL 和 anon key 填入 js/config.js
-- ============================================================

-- ============================================================
-- 1. 用户表（自定义认证体系）
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. 婚礼配置表（倒计时等全局配置）
-- ============================================================
CREATE TABLE IF NOT EXISTS wedding_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    wedding_datetime TIMESTAMPTZ,
    groom_name TEXT DEFAULT '',
    bride_name TEXT DEFAULT '',
    venue TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT DEFAULT '',
    CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO wedding_config (id, wedding_datetime) VALUES (1, '2026-12-20 11:00:00+08')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 3. 宾客名单表
-- ============================================================
CREATE TABLE IF NOT EXISTS guests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    group_type TEXT NOT NULL DEFAULT '好友',
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    dietary TEXT DEFAULT '',
    status TEXT DEFAULT '待邀请' CHECK (status IN ('待邀请', '已邀请', '确认出席', '无法到场')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. 婚礼流程时间轴表
-- ============================================================
CREATE TABLE IF NOT EXISTS timeline_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_time TEXT NOT NULL DEFAULT '',
    event TEXT NOT NULL DEFAULT '',
    person_in_charge TEXT DEFAULT '',
    location TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    status TEXT DEFAULT '未开始' CHECK (status IN ('未开始', '进行中', '已完成')),
    is_key BOOLEAN DEFAULT FALSE,
    staff_assignments JSONB DEFAULT '[]'::jsonb,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. 堵门接亲游戏表
-- ============================================================
CREATE TABLE IF NOT EXISTS games (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    duration INTEGER DEFAULT 0,
    props TEXT DEFAULT '',
    rules TEXT DEFAULT '',
    punishment TEXT DEFAULT '',
    selected BOOLEAN DEFAULT FALSE,
    expanded BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. 备婚物资清单表
-- ============================================================
CREATE TABLE IF NOT EXISTS supplies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    quantity TEXT DEFAULT '',
    category TEXT DEFAULT '其他',
    purchase_channel TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    status TEXT DEFAULT '未采购' CHECK (status IN ('未采购', '已采购', '已打包')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. 婚礼预算表
-- ============================================================
CREATE TABLE IF NOT EXISTS budget_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL DEFAULT '',
    item_name TEXT NOT NULL DEFAULT '',
    budget_amount NUMERIC(12,2) DEFAULT 0,
    actual_amount NUMERIC(12,2) DEFAULT 0,
    remarks TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. 操作日志表（永久存储）
-- ============================================================
CREATE TABLE IF NOT EXISTS operation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    operator_username TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    module TEXT NOT NULL,
    content_summary TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. 实时通知表（用于触发弹窗）
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id TEXT DEFAULT '',
    operator_username TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    module TEXT NOT NULL,
    content_summary TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. 重要事项提醒表
-- ============================================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. 工作人员联络清单表
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '婚庆工作人员' CHECK (category IN ('四大金刚','伴郎伴娘','婚庆工作人员','双方家人')),
    role_desc TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    wechat TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. 席位桌次表
-- ============================================================
CREATE TABLE IF NOT EXISTS seating_tables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_number INTEGER NOT NULL DEFAULT 1,
    capacity INTEGER DEFAULT 10,
    zone TEXT DEFAULT '亲友区' CHECK (zone IN ('男方区','女方区','亲友区')),
    table_leader TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. 席位分配表（宾客-桌次关联）
-- ============================================================
CREATE TABLE IF NOT EXISTS seating_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guest_id UUID,
    guest_name TEXT NOT NULL DEFAULT '',
    group_type TEXT DEFAULT '',
    table_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. 紧急备忘录表
-- ============================================================
CREATE TABLE IF NOT EXISTS memos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    tag TEXT DEFAULT '通用' CHECK (tag IN ('应急方案','合同备注','物品存放','备用物资','通用')),
    content TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. 全局公告表
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    is_pinned BOOLEAN DEFAULT FALSE,
    author_name TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. 礼金记账表（高隐私）
-- ============================================================
CREATE TABLE IF NOT EXISTS gifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    guest_name TEXT NOT NULL DEFAULT '',
    group_type TEXT DEFAULT '男方亲友' CHECK (group_type IN ('男方亲友','女方亲友')),
    amount NUMERIC(12,2) DEFAULT 0,
    gift_item TEXT DEFAULT '',
    received_date DATE,
    remarks TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. 接送车辆排班表
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_number TEXT NOT NULL DEFAULT '',
    driver_name TEXT DEFAULT '',
    driver_phone TEXT DEFAULT '',
    departure TEXT DEFAULT '',
    destination TEXT DEFAULT '',
    departure_time TEXT DEFAULT '',
    arrival_time TEXT DEFAULT '',
    vehicle_type TEXT DEFAULT '',
    is_wedding_car BOOLEAN DEFAULT FALSE,
    luggage_space TEXT DEFAULT '',
    special_needs TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    sort_order BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. 车内乘车人员表
-- ============================================================
CREATE TABLE IF NOT EXISTS vehicle_passengers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vehicle_id UUID NOT NULL,
    passenger_name TEXT NOT NULL DEFAULT '',
    passenger_type TEXT DEFAULT 'custom',
    source_id TEXT DEFAULT '',
    seat_order BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 行级安全策略 (RLS)
-- 注意：本应用使用自定义认证体系（app_users 表），
-- 权限控制在前端应用层实现。RLS 设为允许 anon key 全部访问。
-- 如需更高安全性，可配合 Supabase Auth 使用。
-- ============================================================

-- 启用 RLS
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wedding_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_passengers ENABLE ROW LEVEL SECURITY;

-- 创建允许全部访问的策略
CREATE POLICY "allow_all_app_users" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_wedding_config" ON wedding_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_guests" ON guests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_timeline_tasks" ON timeline_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_games" ON games FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_supplies" ON supplies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_budget_items" ON budget_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_operation_logs" ON operation_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_reminders" ON reminders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_staff_contacts" ON staff_contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_seating_tables" ON seating_tables FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_seating_assignments" ON seating_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_memos" ON memos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_announcements" ON announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_gifts" ON gifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vehicles" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_vehicle_passengers" ON vehicle_passengers FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 启用实时订阅 (Realtime)
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE app_users;
ALTER PUBLICATION supabase_realtime ADD TABLE wedding_config;
ALTER PUBLICATION supabase_realtime ADD TABLE guests;
ALTER PUBLICATION supabase_realtime ADD TABLE timeline_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE supplies;
ALTER PUBLICATION supabase_realtime ADD TABLE budget_items;
ALTER PUBLICATION supabase_realtime ADD TABLE operation_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE reminders;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE seating_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE seating_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE memos;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE gifts;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicles;
ALTER PUBLICATION supabase_realtime ADD TABLE vehicle_passengers;

-- ============================================================
-- 创建索引
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status);
CREATE INDEX IF NOT EXISTS idx_guests_group ON guests(group_type);
CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplies_status ON supplies(status);
CREATE INDEX IF NOT EXISTS idx_supplies_category ON supplies(category);
CREATE INDEX IF NOT EXISTS idx_staff_category ON staff_contacts(category);
CREATE INDEX IF NOT EXISTS idx_seating_zone ON seating_tables(zone);
CREATE INDEX IF NOT EXISTS idx_seating_assign_table ON seating_assignments(table_id);
CREATE INDEX IF NOT EXISTS idx_memos_tag ON memos(tag);
CREATE INDEX IF NOT EXISTS idx_gifts_group ON gifts(group_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_sort ON vehicles(sort_order);
CREATE INDEX IF NOT EXISTS idx_vehicle_passengers_vehicle ON vehicle_passengers(vehicle_id);

-- ============================================================
-- 完成！
-- 初始管理员账号会在应用首次加载时自动创建：
--   账号: wedding_admin
--   密码: Wedding2026!
-- ============================================================
