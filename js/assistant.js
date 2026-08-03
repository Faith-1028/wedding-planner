/**
 * ============================================================
 * assistant.js - 婚礼协同管理 AI 智能助手
 * ============================================================
 * 功能：自然语言解析、宾客/流程/预算 CRUD、标准流程模板、
 *       项目进度概览、确认流程、权限控制
 * 工作边界：仅处理本应用内婚礼项目数据管理
 * ============================================================
 */

(function() {
'use strict';

window.App = window.App || {};

App.assistant = {

    // ===== 状态 =====
    isOpen: false,
    messages: [],
    state: 'idle',       // idle | collecting | confirming
    pendingAction: null,  // { type, data, summary }
    collectType: null,    // guest | timeline | budget

    // ===== 快捷操作 =====
    QUICK_ACTIONS: [
        { label: '添加宾客', icon: '👤' },
        { label: '宾客名单', icon: '📋' },
        { label: '添加流程', icon: '📅' },
        { label: '婚礼流程', icon: '⏰' },
        { label: '添加预算', icon: '💰' },
        { label: '预算概览', icon: '📊' },
        { label: '项目进度', icon: '📈' },
        { label: '帮助', icon: '❓' },
    ],

    // ===== 标准婚礼流程模板 =====
    STANDARD_TIMELINE: [
        { task_time: '06:00', event: '新娘化妆', is_key: false },
        { task_time: '07:00', event: '新郎准备', is_key: false },
        { task_time: '08:00', event: '接亲出发', is_key: true },
        { task_time: '08:30', event: '到达新娘家', is_key: false },
        { task_time: '09:00', event: '接亲游戏', is_key: false },
        { task_time: '09:30', event: '敬茶仪式', is_key: true },
        { task_time: '10:00', event: '出发酒店', is_key: false },
        { task_time: '10:30', event: '到达酒店准备', is_key: false },
        { task_time: '11:00', event: '婚礼仪式开始', is_key: true },
        { task_time: '11:30', event: '交换戒指', is_key: false },
        { task_time: '12:00', event: '婚宴开席', is_key: true },
        { task_time: '13:00', event: '敬酒环节', is_key: false },
        { task_time: '14:00', event: '送客', is_key: false },
    ],

    // ============================================================
    // 初始化
    // ============================================================
    init: function() {
        this.injectWidget();
        this.bindEvents();
        this.showWelcome();
    },

    // ============================================================
    // UI 渲染
    // ============================================================
    injectWidget: function() {
        if (document.getElementById('assistantFab')) return;
        var widget = document.createElement('div');
        widget.id = 'aiAssistantWidget';
        widget.innerHTML =
            '<div id="assistantFab" class="assistant-fab" title="婚礼助手">' +
                '<span class="assistant-fab-icon">💬</span>' +
                '<span class="assistant-fab-badge">AI</span>' +
            '</div>' +
            '<div id="assistantPanel" class="assistant-panel" style="display:none;">' +
                '<div class="assistant-header">' +
                    '<div class="assistant-header-info">' +
                        '<span class="assistant-header-icon">💍</span>' +
                        '<div>' +
                            '<div class="assistant-header-title">婚礼协同助手</div>' +
                            '<div class="assistant-header-sub">在线 · 随时为你服务</div>' +
                        '</div>' +
                    '</div>' +
                    '<button class="assistant-close" id="assistantClose">✕</button>' +
                '</div>' +
                '<div class="assistant-messages" id="assistantMessages"></div>' +
                '<div class="assistant-quick-bar" id="assistantQuickBar"></div>' +
                '<div class="assistant-input-area">' +
                    '<input type="text" id="assistantInput" placeholder="输入指令，如「添加宾客张三」..." autocomplete="off">' +
                    '<button id="assistantSend" class="assistant-send-btn">' +
                        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
                    '</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(widget);
    },

    bindEvents: function() {
        var self = this;
        var fab = document.getElementById('assistantFab');
        var closeBtn = document.getElementById('assistantClose');
        var sendBtn = document.getElementById('assistantSend');
        var input = document.getElementById('assistantInput');
        var msgContainer = document.getElementById('assistantMessages');

        fab.addEventListener('click', function() { self.toggle(); });
        closeBtn.addEventListener('click', function() { self.toggle(); });
        sendBtn.addEventListener('click', function() { self.handleSend(); });
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') self.handleSend();
        });

        // 事件委托：处理消息内的按钮点击
        msgContainer.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-act]');
            if (!btn) return;
            self.handleButtonClick(btn);
        });
    },

    toggle: function() {
        this.isOpen = !this.isOpen;
        var panel = document.getElementById('assistantPanel');
        var fab = document.getElementById('assistantFab');
        if (this.isOpen) {
            panel.style.display = 'flex';
            fab.style.display = 'none';
            setTimeout(function() {
                document.getElementById('assistantInput').focus();
            }, 100);
        } else {
            panel.style.display = 'none';
            fab.style.display = 'flex';
        }
    },

    showWelcome: function() {
        this.messages = [];
        this.addBotMessage(
            '你好！我是婚礼协同管理助手 💍\n\n' +
            '我可以帮你管理宾客名单、创建婚礼流程、记录预算支出等。\n\n' +
            '试试输入「帮助」查看完整功能，或点击下方快捷按钮快速操作。'
        );
        this.renderQuickActions();
    },

    renderQuickActions: function() {
        var self = this;
        var container = document.getElementById('assistantQuickBar');
        container.innerHTML = this.QUICK_ACTIONS.map(function(a) {
            return '<button class="qa-btn" data-qa="' + self.escapeAttr(a.label) + '">' +
                a.icon + ' ' + self.escapeHtml(a.label) + '</button>';
        }).join('');
        container.querySelectorAll('.qa-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                document.getElementById('assistantInput').value = btn.dataset.qa;
                self.handleSend();
            });
        });
    },

    addBotMessage: function(text, html) {
        this.messages.push({ role: 'bot', text: text, html: html });
        this.renderMessages();
    },

    addUserMessage: function(text) {
        this.messages.push({ role: 'user', text: text });
        this.renderMessages();
    },

    renderMessages: function() {
        var self = this;
        var container = document.getElementById('assistantMessages');
        container.innerHTML = this.messages.map(function(m) {
            if (m.role === 'user') {
                return '<div class="msg msg-user"><div class="msg-bubble msg-bubble-user">' +
                    self.escapeHtml(m.text) + '</div></div>';
            } else {
                var content = m.html || self.escapeHtml(m.text).replace(/\n/g, '<br>');
                return '<div class="msg msg-bot"><div class="msg-bubble msg-bubble-bot">' +
                    content + '</div></div>';
            }
        }).join('');
        this.scrollBottom();
    },

    showTyping: function() {
        var container = document.getElementById('assistantMessages');
        var typing = document.createElement('div');
        typing.className = 'msg msg-bot';
        typing.id = 'typingIndicator';
        typing.innerHTML = '<div class="msg-bubble msg-bubble-bot msg-typing">' +
            '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
        container.appendChild(typing);
        this.scrollBottom();
    },

    hideTyping: function() {
        var t = document.getElementById('typingIndicator');
        if (t) t.remove();
    },

    scrollBottom: function() {
        var container = document.getElementById('assistantMessages');
        if (container) container.scrollTop = container.scrollHeight;
    },

    // ============================================================
    // 消息处理
    // ============================================================
    handleSend: async function() {
        var input = document.getElementById('assistantInput');
        var text = input.value.trim();
        if (!text) return;
        input.value = '';

        this.addUserMessage(text);
        this.showTyping();

        await new Promise(function(r) { setTimeout(r, 400); });

        var resp;
        try {
            resp = await this.processInput(text);
        } catch(e) {
            resp = { text: '⚠️ 处理出错：' + (e.message || '未知错误') };
        }

        this.hideTyping();

        if (resp.html) {
            this.addBotMessage(resp.text || '', resp.html);
        } else {
            this.addBotMessage(resp.text || '...');
        }

        // 重新渲染快捷操作（保持可见）
        if (this.state === 'idle') {
            this.renderQuickActions();
        }
    },

    processInput: async function(text) {
        // 确认状态处理
        if (this.state === 'confirming') {
            return this.handleConfirmText(text);
        }

        // 取消指令
        if (/^(取消|算了|不要了|放弃|cancel)$/i.test(text)) {
            this.state = 'idle';
            this.pendingAction = null;
            this.collectType = null;
            return { text: '好的，已取消。有什么其他需要帮忙的吗？' };
        }

        // 问候语
        if (/^(你好|您好|hi|hello|嗨|哈喽|早上好|下午好|晚上好)/i.test(text)) {
            return { text: '你好！有什么婚礼管理方面需要帮忙的吗？\n输入「帮助」查看完整功能列表。' };
        }

        // 意图解析
        var intent = this.parseIntent(text);
        if (!intent) {
            return {
                text: '抱歉，我没有理解你的需求。\n\n我可以帮你管理宾客、流程、预算等婚礼相关事务。\n输入「帮助」查看完整功能列表。'
            };
        }

        return await this.handleIntent(intent, text);
    },

    // ============================================================
    // 意图解析
    // ============================================================
    parseIntent: function(text) {
        // 帮助
        if (/(?:帮助|帮忙|怎么用|能做什么|你会什么|功能列表|使用说明|help)/i.test(text))
            return 'help';

        // 搭建标准流程
        if (/(?:搭建|创建|生成|制定|规划|设计|一键)\s*(?:一个|一套|标准|完整)?\s*(?:婚礼)?\s*(?:流程|时间表|时间轴|日程|安排)/.test(text) ||
            /(?:标准|完整)\s*(?:婚礼)?\s*(?:流程|模板)/.test(text) ||
            /(?:婚礼流程模板|标准流程|流程框架|流程模板)/.test(text))
            return 'timeline_template';

        // 添加宾客
        if (/(?:添加|新增|录入|增加|加|登记|注册)\s*(?:一个|一位|名)?\s*(?:宾客|客人|来宾|贵宾)/.test(text) ||
            /(?:宾客|客人|来宾)\s*(?:添加|新增|录入|增加|加|登记)/.test(text))
            return 'guest_add';

        // 宾客查询
        if (/(?:宾客|客人|来宾)\s*(?:名单|列表|清单|统计|人数|多少|概览|查看|看看)/.test(text) ||
            /(?:查看|看看|查|显示|列表)\s*(?:宾客|客人|来宾)/.test(text) ||
            /(?:多少|几个)\s*(?:宾客|客人|来宾|人)/.test(text) ||
            /^(?:宾客|宾客名单|客人|来宾)$/.test(text))
            return 'guest_query';

        // 添加流程
        if (/(?:添加|新增|创建|新建|加|增加)\s*(?:一个|一条)?\s*(?:流程|任务|环节|日程)/.test(text) ||
            /(?:流程|任务|环节)\s*(?:添加|新增|创建|新建|加)/.test(text))
            return 'timeline_add';

        // 流程查询
        if (/(?:流程|时间轴|时间表|日程)\s*(?:列表|查看|看看|是什么|怎么样|概览)/.test(text) ||
            /(?:查看|看看|查|显示)\s*(?:流程|时间轴|时间表|日程)/.test(text) ||
            /^(?:婚礼流程|流程|时间表|时间轴)$/.test(text))
            return 'timeline_query';

        // 添加预算
        if (/(?:添加|新增|录入|增加|加|记录)\s*(?:一个|一条)?\s*(?:预算|花费|支出|费用|开销)/.test(text) ||
            /(?:预算|花费|支出|费用)\s*(?:添加|新增|录入|增加|加|记录)/.test(text))
            return 'budget_add';

        // 预算查询
        if (/(?:预算|花费|支出|费用|开销)\s*(?:多少|汇总|概览|总计|统计|查看|看看)/.test(text) ||
            /(?:花了|用了|花费了)\s*(?:多少|多少钱)/.test(text) ||
            /^(?:预算|预算概览|预算汇总)$/.test(text))
            return 'budget_query';

        // 项目进度
        if (/(?:项目|整体|总体|备婚)\s*(?:进度|状态|概览|情况|看板|汇总)/.test(text) ||
            /^(?:进度|概览|看板|汇总|总览|项目进度)$/.test(text))
            return 'progress';

        return null;
    },

    // ============================================================
    // 意图分发
    // ============================================================
    handleIntent: async function(intent, text) {
        var handlers = {
            help: function() { return this.handleHelp(); },
            guest_add: function() { return this.handleGuestAdd(text); },
            guest_query: function() { return this.handleGuestQuery(); },
            timeline_add: function() { return this.handleTimelineAdd(text); },
            timeline_template: function() { return this.handleTimelineTemplate(); },
            timeline_query: function() { return this.handleTimelineQuery(); },
            budget_add: function() { return this.handleBudgetAdd(text); },
            budget_query: function() { return this.handleBudgetQuery(); },
            progress: function() { return this.handleProgress(); },
        };
        if (handlers[intent]) return await handlers[intent].call(this);
        return { text: '功能开发中...' };
    },

    // ============================================================
    // 帮助
    // ============================================================
    handleHelp: function() {
        var html =
            '<div class="asst-help">' +
            '<div class="asst-help-section">' +
                '<div class="asst-help-title">👤 宾客管理</div>' +
                '<div class="asst-help-item">「添加宾客 张三 新郎亲友」— 新增宾客</div>' +
                '<div class="asst-help-item">「宾客名单」— 查看宾客列表</div>' +
                '<div class="asst-help-item">「有多少宾客」— 宾客统计</div>' +
            '</div>' +
            '<div class="asst-help-section">' +
                '<div class="asst-help-title">📅 婚礼流程</div>' +
                '<div class="asst-help-item">「添加流程 09:00 接亲」— 新增流程任务</div>' +
                '<div class="asst-help-item">「搭建婚礼流程」— 生成标准流程模板</div>' +
                '<div class="asst-help-item">「婚礼流程」— 查看流程列表</div>' +
            '</div>' +
            '<div class="asst-help-section">' +
                '<div class="asst-help-title">💰 预算管理</div>' +
                '<div class="asst-help-item">「添加预算 婚纱摄影 8000」— 新增预算项</div>' +
                '<div class="asst-help-item">「预算概览」— 查看预算汇总</div>' +
            '</div>' +
            '<div class="asst-help-section">' +
                '<div class="asst-help-title">📈 项目进度</div>' +
                '<div class="asst-help-item">「项目进度」— 查看整体备婚进度</div>' +
            '</div>' +
            '<div class="asst-help-tip">💡 直接用自然语言告诉我你想做什么即可！</div>' +
            '</div>';
        return { html: html };
    },

    // ============================================================
    // 实体提取
    // ============================================================
    extractGuestInfo: function(text) {
        var info = { name: '', group_type: '', status: '', adults: null, children: null, dietary: '' };
        var cleaned = text;

        // 去除意图关键词
        cleaned = cleaned.replace(/(?:添加|新增|录入|增加|加|登记|注册)\s*(?:一个|一位|名)?\s*(?:宾客|客人|来宾|贵宾)/g, '');
        cleaned = cleaned.replace(/(?:宾客|客人|来宾)\s*(?:添加|新增|录入|增加|加|登记)/g, '');

        // 去除称呼词
        cleaned = cleaned.replace(/(?:叫|姓名|名字|是)\s*[:：]?/g, '');

        // 提取成人/儿童数量
        var adultsMatch = cleaned.match(/(\d+)\s*(?:个|位)?\s*成人/);
        if (adultsMatch) { info.adults = parseInt(adultsMatch[1]); cleaned = cleaned.replace(adultsMatch[0], ''); }
        var childrenMatch = cleaned.match(/(\d+)\s*(?:个|位)?\s*(?:儿童|小孩|小朋友)/);
        if (childrenMatch) { info.children = parseInt(childrenMatch[1]); cleaned = cleaned.replace(childrenMatch[0], ''); }

        // 匹配状态
        var statuses = App.config.GUEST_STATUSES || [];
        for (var i = 0; i < statuses.length; i++) {
            if (cleaned.indexOf(statuses[i]) >= 0) {
                info.status = statuses[i];
                cleaned = cleaned.replace(new RegExp(statuses[i], 'g'), '');
                break;
            }
        }

        // 匹配分组
        var groups = App.config.GUEST_GROUPS || [];
        for (var j = 0; j < groups.length; j++) {
            if (cleaned.indexOf(groups[j]) >= 0) {
                info.group_type = groups[j];
                cleaned = cleaned.replace(new RegExp(groups[j], 'g'), '');
                break;
            }
        }

        // 提取饮食忌口
        var dietMatch = cleaned.match(/(?:忌口|饮食|不吃|过敏|素食)\s*[:：]?\s*([^\s,，、]+)/);
        if (dietMatch) { info.dietary = dietMatch[1]; cleaned = cleaned.replace(dietMatch[0], ''); }

        // 剩余文本作为姓名
        cleaned = cleaned.replace(/[,，、\s]+/g, ' ').trim();
        if (cleaned) info.name = cleaned;

        return info;
    },

    extractTimelineInfo: function(text) {
        var info = { task_time: '', event: '', location: '', person_in_charge: '', props: '', remarks: '', is_key: false };
        var cleaned = text;

        // 去除意图关键词
        cleaned = cleaned.replace(/(?:添加|新增|创建|新建|加|增加)\s*(?:一个|一条)?\s*(?:流程|任务|环节|日程)/g, '');
        cleaned = cleaned.replace(/(?:流程|任务|环节)\s*(?:添加|新增|创建|新建|加)/g, '');

        // 提取时间
        var timeMatch = cleaned.match(/(\d{1,2})[:：](\d{2})/);
        if (timeMatch) {
            info.task_time = timeMatch[1] + ':' + timeMatch[2];
            cleaned = cleaned.replace(timeMatch[0], '');
        }

        // 提取地点
        var locMatch = cleaned.match(/(?:地点|位置|在)\s*[:：]?\s*([^\s,，、]+)/);
        if (locMatch) { info.location = locMatch[1]; cleaned = cleaned.replace(locMatch[0], ''); }

        // 提取负责人
        var personMatch = cleaned.match(/(?:负责人|执行人|谁|分配给)\s*[:：]?\s*([^\s,，、]+)/);
        if (personMatch) { info.person_in_charge = personMatch[1]; cleaned = cleaned.replace(personMatch[0], ''); }

        // 提取道具
        var propsMatch = cleaned.match(/(?:道具|用品)\s*[:：]?\s*([^\s,，、]+)/);
        if (propsMatch) { info.props = propsMatch[1]; cleaned = cleaned.replace(propsMatch[0], ''); }

        // 关键任务标记
        if (/关键|重要|核心/.test(cleaned)) { info.is_key = true; cleaned = cleaned.replace(/关键|重要|核心/g, ''); }

        // 剩余文本作为事件名称
        cleaned = cleaned.replace(/[,，、\s]+/g, ' ').trim();
        if (cleaned) info.event = cleaned;

        return info;
    },

    extractBudgetInfo: function(text) {
        var info = { category: '', item_name: '', budget_amount: null, actual_amount: null, remarks: '' };
        var cleaned = text;

        // 去除意图关键词
        cleaned = cleaned.replace(/(?:添加|新增|录入|增加|加|记录)\s*(?:一个|一条)?\s*(?:预算|花费|支出|费用|开销)/g, '');
        cleaned = cleaned.replace(/(?:预算|花费|支出|费用)\s*(?:添加|新增|录入|增加|加|记录)/g, '');

        // 提取金额（支持"元""块""万"）
        var amountMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:万)?\s*[元块]?/);
        if (amountMatch) {
            var num = parseFloat(amountMatch[1]);
            if (amountMatch[0].indexOf('万') >= 0) num *= 10000;
            info.budget_amount = num;
            cleaned = cleaned.replace(amountMatch[0], '');
        }

        // 匹配分类
        var cats = App.config.BUDGET_CATEGORIES || [];
        for (var i = 0; i < cats.length; i++) {
            if (cleaned.indexOf(cats[i]) >= 0) {
                info.category = cats[i];
                cleaned = cleaned.replace(new RegExp(cats[i], 'g'), '');
                break;
            }
        }

        // 剩余文本作为项目名称
        cleaned = cleaned.replace(/[,，、\s]+/g, ' ').trim();
        if (cleaned) info.item_name = cleaned;

        return info;
    },

    // ============================================================
    // 权限检查
    // ============================================================
    checkAdmin: function() {
        if (!App.auth.isAdmin()) {
            return {
                text: '⚠️ 权限不足\n\n你当前是「访客」角色，仅管理员可以新增/修改数据。\n请联系管理员调整权限。'
            };
        }
        return null;
    },

    // ============================================================
    // 宾客 - 添加
    // ============================================================
    handleGuestAdd: function(text) {
        var perm = this.checkAdmin();
        if (perm) return perm;

        var info = this.extractGuestInfo(text);

        // 判断信息是否完整
        if (!info.name) {
            // 信息不足，展示表单收集
            return this.showGuestForm(info);
        }

        // 补全默认值
        if (!info.group_type) info.group_type = (App.config.GUEST_GROUPS || ['好友'])[0];
        if (!info.status) info.status = (App.config.GUEST_STATUSES || ['待邀请'])[0];
        if (info.adults === null) info.adults = 1;
        if (info.children === null) info.children = 0;

        // 展示确认卡片
        return this.showConfirmation({
            type: 'guest_add',
            data: info,
            summary: this.formatGuestConfirm(info)
        });
    },

    showGuestForm: function(prefill) {
        var self = this;
        this.state = 'collecting';
        this.collectType = 'guest';

        var groups = App.config.GUEST_GROUPS || ['好友'];
        var statuses = App.config.GUEST_STATUSES || ['待邀请'];

        var html =
            '<div class="asst-form">' +
            '<div class="asst-form-title">📝 请填写宾客信息</div>' +
            '<div class="asst-form-row">' +
                '<div class="asst-form-field">' +
                    '<label>姓名 *</label>' +
                    '<input type="text" id="af_name" value="' + this.escapeAttr(prefill.name || '') + '" placeholder="宾客姓名">' +
                '</div>' +
            '</div>' +
            '<div class="asst-form-row">' +
                '<div class="asst-form-field">' +
                    '<label>所属人群</label>' +
                    '<select id="af_group">' +
                        groups.map(function(g) {
                            return '<option value="' + self.escapeAttr(g) + '"' + (prefill.group_type === g ? ' selected' : '') + '>' + self.escapeHtml(g) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
                '<div class="asst-form-field">' +
                    '<label>状态</label>' +
                    '<select id="af_status">' +
                        statuses.map(function(s) {
                            return '<option value="' + self.escapeAttr(s) + '"' + (prefill.status === s ? ' selected' : '') + '>' + self.escapeHtml(s) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
            '</div>' +
            '<div class="asst-form-row">' +
                '<div class="asst-form-field">' +
                    '<label>成人数量</label>' +
                    '<input type="number" id="af_adults" value="' + (prefill.adults || 1) + '" min="0">' +
                '</div>' +
                '<div class="asst-form-field">' +
                    '<label>儿童数量</label>' +
                    '<input type="number" id="af_children" value="' + (prefill.children || 0) + '" min="0">' +
                '</div>' +
            '</div>' +
            '<div class="asst-form-row">' +
                '<div class="asst-form-field">' +
                    '<label>饮食忌口</label>' +
                    '<input type="text" id="af_dietary" value="' + this.escapeAttr(prefill.dietary || '') + '" placeholder="如：素食、海鲜过敏">' +
                '</div>' +
            '</div>' +
            '<div class="asst-form-actions">' +
                '<button class="asst-btn asst-btn-primary" data-act="submit-guest">提交</button>' +
                '<button class="asst-btn asst-btn-cancel" data-act="cancel-collect">取消</button>' +
            '</div>' +
            '</div>';

        return { html: html };
    },

    submitGuestForm: function(formEl) {
        var name = formEl.querySelector('#af_name').value.trim();
        if (!name) {
            this.addBotMessage('⚠️ 请输入宾客姓名');
            return;
        }
        var info = {
            name: name,
            group_type: formEl.querySelector('#af_group').value,
            status: formEl.querySelector('#af_status').value,
            adults: parseInt(formEl.querySelector('#af_adults').value) || 0,
            children: parseInt(formEl.querySelector('#af_children').value) || 0,
            dietary: formEl.querySelector('#af_dietary').value.trim()
        };
        this.state = 'idle';
        this.collectType = null;
        // 展示确认卡片
        var resp = this.showConfirmation({
            type: 'guest_add',
            data: info,
            summary: this.formatGuestConfirm(info)
        });
        this.addBotMessage(resp.text || '', resp.html);
    },

    formatGuestConfirm: function(info) {
        return {
            title: '👤 新增宾客',
            fields: [
                { label: '姓名', value: info.name },
                { label: '所属人群', value: info.group_type },
                { label: '状态', value: info.status },
                { label: '成人/儿童', value: info.adults + ' / ' + info.children },
                { label: '饮食忌口', value: info.dietary || '无' }
            ]
        };
    },

    // ============================================================
    // 宾客 - 查询
    // ============================================================
    handleGuestQuery: async function() {
        var data = await App.db.select('guests', 'sort_order');
        if (!data || data.length === 0) {
            return { text: '📋 暂无宾客记录。\n\n点击「添加宾客」或告诉我「添加宾客 张三」来开始录入。' };
        }

        var total = data.length;
        var confirmed = data.filter(function(g) { return g.status === '确认出席'; });
        var totalAdults = confirmed.reduce(function(s, g) { return s + (g.adults || 0); }, 0);
        var totalChildren = confirmed.reduce(function(s, g) { return s + (g.children || 0); }, 0);
        var totalPeople = totalAdults + totalChildren;
        var tables = Math.ceil(totalPeople / 10);

        var html =
            '<div class="asst-data-card">' +
            '<div class="asst-data-header">📋 宾客统计</div>' +
            '<div class="asst-stats">' +
                '<div class="asst-stat"><span class="asst-stat-num">' + total + '</span><span class="asst-stat-label">总宾客</span></div>' +
                '<div class="asst-stat"><span class="asst-stat-num">' + totalPeople + '</span><span class="asst-stat-label">确认出席</span></div>' +
                '<div class="asst-stat"><span class="asst-stat-num">' + tables + '</span><span class="asst-stat-label">预估桌数</span></div>' +
            '</div>';

        // 列出前 15 位宾客
        var list = data.slice(0, 15);
        html += '<div class="asst-data-list">';
        list.forEach(function(g) {
            var tag = g.status === '确认出席' ? '✅' : g.status === '无法到场' ? '❌' : '⏳';
            html += '<div class="asst-data-item">' +
                '<span class="asst-data-item-name">' + tag + ' ' + App.ui.escapeHtml(g.name) + '</span>' +
                '<span class="asst-data-item-meta">' + App.ui.escapeHtml(g.group_type || '') + ' · ' + App.ui.escapeHtml(g.status || '') + '</span>' +
            '</div>';
        });
        if (data.length > 15) {
            html += '<div class="asst-data-more">...共 ' + data.length + ' 位宾客，查看完整名单请点击「宾客管理」</div>';
        }
        html += '</div>';
        html += '<button class="asst-btn asst-btn-link" data-act="goto-guests">前往宾客管理 →</button>';
        html += '</div>';

        return { html: html };
    },

    // ============================================================
    // 流程 - 添加
    // ============================================================
    handleTimelineAdd: function(text) {
        var perm = this.checkAdmin();
        if (perm) return perm;

        var info = this.extractTimelineInfo(text);

        if (!info.event && !info.task_time) {
            return this.showTimelineForm(info);
        }

        if (!info.event) info.event = '新流程任务';
        info.status = '未开始';

        return this.showConfirmation({
            type: 'timeline_add',
            data: info,
            summary: this.formatTimelineConfirm(info)
        });
    },

    showTimelineForm: function(prefill) {
        var self = this;
        this.state = 'collecting';
        this.collectType = 'timeline';

        var html =
            '<div class="asst-form">' +
            '<div class="asst-form-title">📝 请填写流程信息</div>' +
            '<div class="asst-form-row">' +
                '<div class="asst-form-field" style="flex:0 0 120px;">' +
                    '<label>时间</label>' +
                    '<input type="text" id="af_time" value="' + this.escapeAttr(prefill.task_time || '') + '" placeholder="如 09:00">' +
                '</div>' +
                '<div class="asst-form-field">' +
                    '<label>事项名称 *</label>' +
                    '<input type="text" id="af_event" value="' + this.escapeAttr(prefill.event || '') + '" placeholder="如 接亲">' +
                '</div>' +
            '</div>' +
            '<div class="asst-form-row">' +
                '<div class="asst-form-field">' +
                    '<label>地点</label>' +
                    '<input type="text" id="af_location" value="' + this.escapeAttr(prefill.location || '') + '" placeholder="如 新郎家">' +
                '</div>' +
                '<div class="asst-form-field">' +
                    '<label>负责人</label>' +
                    '<input type="text" id="af_person" value="' + this.escapeAttr(prefill.person_in_charge || '') + '" placeholder="如 张三,李四">' +
                '</div>' +
            '</div>' +
            '<div class="asst-form-row">' +
                '<div class="asst-form-field">' +
                    '<label>道具</label>' +
                    '<input type="text" id="af_props" value="' + this.escapeAttr(prefill.props || '') + '" placeholder="如 婚车花艺">' +
                '</div>' +
                '<div class="asst-form-field" style="flex:0 0 100px;">' +
                    '<label>关键任务</label>' +
                    '<select id="af_key"><option value="false">否</option><option value="true">是</option></select>' +
                '</div>' +
            '</div>' +
            '<div class="asst-form-actions">' +
                '<button class="asst-btn asst-btn-primary" data-act="submit-timeline">提交</button>' +
                '<button class="asst-btn asst-btn-cancel" data-act="cancel-collect">取消</button>' +
            '</div>' +
            '</div>';

        return { html: html };
    },

    submitTimelineForm: function(formEl) {
        var event = formEl.querySelector('#af_event').value.trim();
        if (!event) {
            this.addBotMessage('⚠️ 请输入事项名称');
            return;
        }
        var info = {
            task_time: formEl.querySelector('#af_time').value.trim(),
            event: event,
            location: formEl.querySelector('#af_location').value.trim(),
            person_in_charge: formEl.querySelector('#af_person').value.trim(),
            props: formEl.querySelector('#af_props').value.trim(),
            remarks: '',
            is_key: formEl.querySelector('#af_key').value === 'true',
            status: '未开始'
        };
        this.state = 'idle';
        this.collectType = null;
        var resp = this.showConfirmation({
            type: 'timeline_add',
            data: info,
            summary: this.formatTimelineConfirm(info)
        });
        this.addBotMessage(resp.text || '', resp.html);
    },

    formatTimelineConfirm: function(info) {
        return {
            title: '📅 新增流程任务',
            fields: [
                { label: '时间', value: info.task_time || '待定' },
                { label: '事项', value: info.event },
                { label: '地点', value: info.location || '未指定' },
                { label: '负责人', value: info.person_in_charge || '未指定' },
                { label: '道具', value: info.props || '无' },
                { label: '关键任务', value: info.is_key ? '是 ⭐' : '否' }
            ]
        };
    },

    // ============================================================
    // 流程 - 标准模板
    // ============================================================
    handleTimelineTemplate: function() {
        var perm = this.checkAdmin();
        if (perm) return perm;

        var self = this;
        var html =
            '<div class="asst-template">' +
            '<div class="asst-template-title">🗓️ 标准婚礼流程模板</div>' +
            '<div class="asst-template-desc">以下是一套完整的婚礼当天流程框架，确认后将一键创建所有任务：</div>' +
            '<div class="asst-timeline-preview">';

        this.STANDARD_TIMELINE.forEach(function(t) {
            html += '<div class="asst-timeline-row' + (t.is_key ? ' key' : '') + '">' +
                '<span class="asst-timeline-time">' + t.task_time + '</span>' +
                '<span class="asst-timeline-event">' + self.escapeHtml(t.event) + (t.is_key ? ' ⭐' : '') + '</span>' +
            '</div>';
        });

        html += '</div>' +
            '<div class="asst-template-note">📌 创建后可在「婚礼流程」模块中编辑调整</div>' +
            '<div class="asst-form-actions">' +
                '<button class="asst-btn asst-btn-primary" data-act="create-template">✓ 一键创建</button>' +
                '<button class="asst-btn asst-btn-cancel" data-act="cancel-collect">暂不创建</button>' +
            '</div>' +
            '</div>';

        return { html: html };
    },

    executeTimelineTemplate: async function() {
        var self = this;
        this.addBotMessage('⏳ 正在创建标准流程...');
        var created = 0;
        var baseOrder = Date.now();

        for (var i = 0; i < this.STANDARD_TIMELINE.length; i++) {
            var t = this.STANDARD_TIMELINE[i];
            try {
                await App.db.insert('timeline_tasks', {
                    task_time: t.task_time,
                    event: t.event,
                    location: '',
                    person_in_charge: '',
                    props: '',
                    remarks: '',
                    is_key: t.is_key,
                    status: '未开始',
                    sort_order: baseOrder + i
                });
                created++;
            } catch(e) {
                console.error('[Assistant] 创建流程失败:', t.event, e);
            }
        }

        await App.tracker.log('新增', '婚礼流程', '通过助手一键创建标准婚礼流程（' + created + '项）');

        // 刷新模块
        if (App.modules.timeline && App.modules.timeline.refresh) App.modules.timeline.refresh();

        return { text: '✅ 标准婚礼流程已创建成功！\n\n共创建 ' + created + ' 个流程任务。\n前往「婚礼流程」模块查看和编辑。' };
    },

    // ============================================================
    // 流程 - 查询
    // ============================================================
    handleTimelineQuery: async function() {
        var data = await App.db.select('timeline_tasks', 'sort_order');
        if (!data || data.length === 0) {
            return { text: '📋 暂无流程任务。\n\n试试输入「搭建婚礼流程」一键生成标准流程模板，或「添加流程 09:00 接亲」逐条添加。' };
        }

        var completed = data.filter(function(t) { return t.status === '已完成'; }).length;
        var inProgress = data.filter(function(t) { return t.status === '进行中'; }).length;

        var html =
            '<div class="asst-data-card">' +
            '<div class="asst-data-header">📋 婚礼流程（' + data.length + '项 · 完成' + completed + ' · 进行中' + inProgress + '）</div>' +
            '<div class="asst-timeline-list">';

        data.forEach(function(t) {
            var icon = t.status === '已完成' ? '✅' : t.status === '进行中' ? '▶️' : '⏳';
            var keyMark = t.is_key ? ' ⭐' : '';
            html += '<div class="asst-tl-item">' +
                '<span class="asst-tl-time">' + App.ui.escapeHtml(t.task_time || '待定') + '</span>' +
                '<span class="asst-tl-icon">' + icon + '</span>' +
                '<span class="asst-tl-event">' + App.ui.escapeHtml(t.event) + keyMark + '</span>' +
                (t.location ? '<span class="asst-tl-meta">📍 ' + App.ui.escapeHtml(t.location) + '</span>' : '') +
                (t.person_in_charge ? '<span class="asst-tl-meta">👤 ' + App.ui.escapeHtml(t.person_in_charge) + '</span>' : '') +
            '</div>';
        });

        html += '</div>';
        html += '<button class="asst-btn asst-btn-link" data-act="goto-timeline">前往流程管理 →</button>';
        html += '</div>';

        return { html: html };
    },

    // ============================================================
    // 预算 - 添加
    // ============================================================
    handleBudgetAdd: function(text) {
        var perm = this.checkAdmin();
        if (perm) return perm;

        var info = this.extractBudgetInfo(text);

        if (!info.item_name && info.budget_amount === null) {
            return this.showBudgetForm(info);
        }

        if (!info.item_name) info.item_name = '新预算项';
        if (!info.category) info.category = (App.config.BUDGET_CATEGORIES || ['其他'])[0];
        if (info.budget_amount === null) info.budget_amount = 0;
        info.actual_amount = 0;
        info.remarks = '';

        return this.showConfirmation({
            type: 'budget_add',
            data: info,
            summary: this.formatBudgetConfirm(info)
        });
    },

    showBudgetForm: function(prefill) {
        var self = this;
        this.state = 'collecting';
        this.collectType = 'budget';

        var cats = App.config.BUDGET_CATEGORIES || ['其他'];

        var html =
            '<div class="asst-form">' +
            '<div class="asst-form-title">📝 请填写预算信息</div>' +
            '<div class="asst-form-row">' +
                '<div class="asst-form-field">' +
                    '<label>项目名称 *</label>' +
                    '<input type="text" id="af_itemname" value="' + this.escapeAttr(prefill.item_name || '') + '" placeholder="如 婚纱摄影">' +
                '</div>' +
                '<div class="asst-form-field">' +
                    '<label>分类</label>' +
                    '<select id="af_cat">' +
                        cats.map(function(c) {
                            return '<option value="' + self.escapeAttr(c) + '"' + (prefill.category === c ? ' selected' : '') + '>' + self.escapeHtml(c) + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +
            '</div>' +
            '<div class="asst-form-row">' +
                '<div class="asst-form-field">' +
                    '<label>预算金额（元）</label>' +
                    '<input type="number" id="af_bamount" value="' + (prefill.budget_amount || 0) + '" min="0" step="0.01">' +
                '</div>' +
                '<div class="asst-form-field">' +
                    '<label>实际花费（元）</label>' +
                    '<input type="number" id="af_aamount" value="0" min="0" step="0.01">' +
                '</div>' +
            '</div>' +
            '<div class="asst-form-actions">' +
                '<button class="asst-btn asst-btn-primary" data-act="submit-budget">提交</button>' +
                '<button class="asst-btn asst-btn-cancel" data-act="cancel-collect">取消</button>' +
            '</div>' +
            '</div>';

        return { html: html };
    },

    submitBudgetForm: function(formEl) {
        var itemName = formEl.querySelector('#af_itemname').value.trim();
        if (!itemName) {
            this.addBotMessage('⚠️ 请输入项目名称');
            return;
        }
        var info = {
            item_name: itemName,
            category: formEl.querySelector('#af_cat').value,
            budget_amount: parseFloat(formEl.querySelector('#af_bamount').value) || 0,
            actual_amount: parseFloat(formEl.querySelector('#af_aamount').value) || 0,
            remarks: ''
        };
        this.state = 'idle';
        this.collectType = null;
        var resp = this.showConfirmation({
            type: 'budget_add',
            data: info,
            summary: this.formatBudgetConfirm(info)
        });
        this.addBotMessage(resp.text || '', resp.html);
    },

    formatBudgetConfirm: function(info) {
        return {
            title: '💰 新增预算项',
            fields: [
                { label: '项目名称', value: info.item_name },
                { label: '分类', value: info.category },
                { label: '预算金额', value: '¥' + (App.ui.formatMoney ? App.ui.formatMoney(info.budget_amount) : info.budget_amount) },
                { label: '实际花费', value: '¥' + (App.ui.formatMoney ? App.ui.formatMoney(info.actual_amount) : info.actual_amount) }
            ]
        };
    },

    // ============================================================
    // 预算 - 查询
    // ============================================================
    handleBudgetQuery: async function() {
        var data = await App.db.select('budget_items', 'sort_order');
        if (!data || data.length === 0) {
            return { text: '💰 暂无预算记录。\n\n试试输入「添加预算 婚纱摄影 8000」来新增预算项。' };
        }

        var totalBudget = data.reduce(function(s, b) { return s + (parseFloat(b.budget_amount) || 0); }, 0);
        var totalActual = data.reduce(function(s, b) { return s + (parseFloat(b.actual_amount) || 0); }, 0);
        var remaining = totalBudget - totalActual;
        var pct = totalBudget > 0 ? Math.round(totalActual / totalBudget * 100) : 0;

        var fmt = App.ui.formatMoney || function(n) { return n; };

        var html =
            '<div class="asst-data-card">' +
            '<div class="asst-data-header">💰 预算概览</div>' +
            '<div class="asst-budget-summary">' +
                '<div class="asst-budget-item"><span class="asst-budget-label">总预算</span><span class="asst-budget-value">¥' + fmt(totalBudget) + '</span></div>' +
                '<div class="asst-budget-item"><span class="asst-budget-label">已花费</span><span class="asst-budget-value spent">¥' + fmt(totalActual) + '</span></div>' +
                '<div class="asst-budget-item"><span class="asst-budget-label">剩余</span><span class="asst-budget-value ' + (remaining < 0 ? 'over' : 'remaining') + '">¥' + fmt(remaining) + '</span></div>' +
            '</div>' +
            '<div class="asst-budget-bar">' +
                '<div class="asst-budget-bar-fill" style="width:' + Math.min(pct, 100) + '%;"></div>' +
            '</div>' +
            '<div class="asst-budget-pct">使用率 ' + pct + '%</div>';

        // 按分类汇总
        var groups = {};
        data.forEach(function(b) {
            var cat = b.category || '其他';
            if (!groups[cat]) groups[cat] = { budget: 0, actual: 0 };
            groups[cat].budget += parseFloat(b.budget_amount) || 0;
            groups[cat].actual += parseFloat(b.actual_amount) || 0;
        });

        html += '<div class="asst-data-list">';
        Object.keys(groups).forEach(function(cat) {
            html += '<div class="asst-data-item">' +
                '<span class="asst-data-item-name">' + App.ui.escapeHtml(cat) + '</span>' +
                '<span class="asst-data-item-meta">预算 ¥' + fmt(groups[cat].budget) + ' · 实际 ¥' + fmt(groups[cat].actual) + '</span>' +
            '</div>';
        });
        html += '</div>';
        html += '<button class="asst-btn asst-btn-link" data-act="goto-budget">前往预算管理 →</button>';
        html += '</div>';

        return { html: html };
    },

    // ============================================================
    // 项目进度
    // ============================================================
    handleProgress: async function() {
        try {
            var guests = await App.db.select('guests');
            var timeline = await App.db.select('timeline_tasks', 'sort_order');
            var budget = await App.db.select('budget_items');
            var supplies = await App.db.select('supplies');
            var staff = await App.db.select('staff_contacts');
            var vehicles = await App.db.select('vehicles');

            var fmt = App.ui.formatMoney || function(n) { return n; };

            // 宾客统计
            var confirmedGuests = guests.filter(function(g) { return g.status === '确认出席'; });
            var guestPeople = confirmedGuests.reduce(function(s, g) { return s + (g.adults || 0) + (g.children || 0); }, 0);

            // 流程统计
            var completedTasks = timeline.filter(function(t) { return t.status === '已完成'; }).length;
            var taskPct = timeline.length > 0 ? Math.round(completedTasks / timeline.length * 100) : 0;

            // 预算统计
            var totalBudget = budget.reduce(function(s, b) { return s + (parseFloat(b.budget_amount) || 0); }, 0);
            var totalSpent = budget.reduce(function(s, b) { return s + (parseFloat(b.actual_amount) || 0); }, 0);
            var budgetPct = totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0;

            // 物资统计
            var purchased = supplies.filter(function(s) { return s.status === '已采购' || s.status === '已打包'; }).length;
            var supplyPct = supplies.length > 0 ? Math.round(purchased / supplies.length * 100) : 0;

            var html =
                '<div class="asst-data-card">' +
                '<div class="asst-data-header">📈 备婚项目进度总览</div>' +
                '<div class="asst-progress-grid">' +
                    '<div class="asst-progress-item">' +
                        '<div class="asst-progress-icon">👥</div>' +
                        '<div class="asst-progress-info">' +
                            '<div class="asst-progress-label">宾客管理</div>' +
                            '<div class="asst-progress-val">' + guests.length + ' 位 · 确认 ' + guestPeople + ' 人</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="asst-progress-item">' +
                        '<div class="asst-progress-icon">📋</div>' +
                        '<div class="asst-progress-info">' +
                            '<div class="asst-progress-label">婚礼流程</div>' +
                            '<div class="asst-progress-val">' + timeline.length + ' 项 · 完成 ' + taskPct + '%</div>' +
                            '<div class="asst-progress-bar"><div class="asst-progress-bar-fill" style="width:' + taskPct + '%;"></div></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="asst-progress-item">' +
                        '<div class="asst-progress-icon">💰</div>' +
                        '<div class="asst-progress-info">' +
                            '<div class="asst-progress-label">预算支出</div>' +
                            '<div class="asst-progress-val">¥' + fmt(totalSpent) + ' / ¥' + fmt(totalBudget) + ' (' + budgetPct + '%)</div>' +
                            '<div class="asst-progress-bar"><div class="asst-progress-bar-fill' + (budgetPct > 90 ? ' over' : '') + '" style="width:' + Math.min(budgetPct, 100) + '%;"></div></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="asst-progress-item">' +
                        '<div class="asst-progress-icon">📦</div>' +
                        '<div class="asst-progress-info">' +
                            '<div class="asst-progress-label">备婚物资</div>' +
                            '<div class="asst-progress-val">' + supplies.length + ' 项 · 已购 ' + supplyPct + '%</div>' +
                            '<div class="asst-progress-bar"><div class="asst-progress-bar-fill" style="width:' + supplyPct + '%;"></div></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="asst-progress-item">' +
                        '<div class="asst-progress-icon">👷</div>' +
                        '<div class="asst-progress-info">' +
                            '<div class="asst-progress-label">工作人员</div>' +
                            '<div class="asst-progress-val">' + staff.length + ' 人</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="asst-progress-item">' +
                        '<div class="asst-progress-icon">🚗</div>' +
                        '<div class="asst-progress-info">' +
                            '<div class="asst-progress-label">接送车辆</div>' +
                            '<div class="asst-progress-val">' + vehicles.length + ' 台</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '</div>';

            return { html: html };
        } catch(e) {
            return { text: '⚠️ 获取项目进度失败：' + (e.message || '未知错误') };
        }
    },

    // ============================================================
    // 确认流程
    // ============================================================
    showConfirmation: function(action) {
        this.state = 'confirming';
        this.pendingAction = action;

        var s = action.summary;
        var html =
            '<div class="asst-confirm">' +
            '<div class="asst-confirm-title">📋 确认执行以下操作</div>' +
            '<div class="asst-confirm-card">' +
                '<div class="asst-confirm-card-title">' + s.title + '</div>' +
                '<div class="asst-confirm-fields">';

        s.fields.forEach(function(f) {
            html += '<div class="asst-confirm-field">' +
                '<span class="asst-confirm-label">' + f.label + '</span>' +
                '<span class="asst-confirm-value">' + App.ui.escapeHtml(f.value) + '</span>' +
            '</div>';
        });

        html += '</div>' +
            '</div>' +
            '<div class="asst-confirm-actions">' +
                '<button class="asst-btn asst-btn-confirm" data-act="confirm">✓ 确认执行</button>' +
                '<button class="asst-btn asst-btn-cancel" data-act="cancel-confirm">✕ 取消</button>' +
            '</div>' +
            '</div>';

        return { html: html };
    },

    handleConfirmText: function(text) {
        if (/^(确认|确定|是的|对|好|可以|ok|yes|执行)$/i.test(text)) {
            return this.executePendingAction();
        }
        if (/^(取消|不|算了|no|cancel)$/i.test(text)) {
            return this.cancelPendingAction();
        }
        return { text: '请回复「确认」执行操作，或「取消」放弃操作。' };
    },

    handleButtonClick: function(btn) {
        var act = btn.dataset.act;

        if (act === 'confirm') {
            this.executePendingAction().then(function(resp) {
                if (resp.html) {
                    App.assistant.addBotMessage(resp.text || '', resp.html);
                } else {
                    App.assistant.addBotMessage(resp.text || '...');
                }
                App.assistant.renderQuickActions();
            });
        } else if (act === 'cancel-confirm') {
            var resp = this.cancelPendingAction();
            this.addBotMessage(resp.text);
            this.renderQuickActions();
        } else if (act === 'cancel-collect') {
            this.state = 'idle';
            this.collectType = null;
            this.addBotMessage('好的，已取消。有什么其他需要帮忙的吗？');
            this.renderQuickActions();
        } else if (act === 'submit-guest') {
            var form = btn.closest('.asst-form');
            this.submitGuestForm(form);
        } else if (act === 'submit-timeline') {
            var form2 = btn.closest('.asst-form');
            this.submitTimelineForm(form2);
        } else if (act === 'submit-budget') {
            var form3 = btn.closest('.asst-form');
            this.submitBudgetForm(form3);
        } else if (act === 'create-template') {
            var self = this;
            this.executeTimelineTemplate().then(function(resp) {
                if (resp.html) {
                    self.addBotMessage(resp.text || '', resp.html);
                } else {
                    self.addBotMessage(resp.text || '...');
                }
                self.renderQuickActions();
            });
        } else if (act === 'goto-guests') {
            App.ui.switchView('guests');
            this.addBotMessage('已跳转到宾客管理页面 👥');
        } else if (act === 'goto-timeline') {
            App.ui.switchView('timeline');
            this.addBotMessage('已跳转到婚礼流程页面 📋');
        } else if (act === 'goto-budget') {
            App.ui.switchView('budget');
            this.addBotMessage('已跳转到预算管理页面 💰');
        }
    },

    executePendingAction: async function() {
        if (!this.pendingAction) return { text: '没有待执行的操作。' };
        var action = this.pendingAction;
        this.state = 'idle';
        this.pendingAction = null;

        try {
            if (action.type === 'guest_add') {
                return await this.executeGuestAdd(action.data);
            } else if (action.type === 'timeline_add') {
                return await this.executeTimelineAdd(action.data);
            } else if (action.type === 'budget_add') {
                return await this.executeBudgetAdd(action.data);
            }
            return { text: '未知操作类型' };
        } catch(e) {
            return { text: '⚠️ 操作失败：' + (e.message || '未知错误') };
        }
    },

    cancelPendingAction: function() {
        this.state = 'idle';
        this.pendingAction = null;
        return { text: '已取消操作。有什么其他需要帮忙的吗？' };
    },

    // ============================================================
    // 动作执行
    // ============================================================
    executeGuestAdd: async function(data) {
        data.sort_order = Date.now();
        await App.db.insert('guests', data);
        await App.tracker.log('新增', '宾客管理', '通过助手新增宾客「' + data.name + '」');
        if (App.modules.guests && App.modules.guests.refresh) App.modules.guests.refresh();
        return { text: '✅ 已成功添加宾客「' + data.name + '」\n\n操作已记录，其他在线用户将收到通知。' };
    },

    executeTimelineAdd: async function(data) {
        data.sort_order = Date.now();
        await App.db.insert('timeline_tasks', data);
        await App.tracker.log('新增', '婚礼流程', '通过助手新增流程「' + (data.task_time || '') + ' ' + data.event + '」');
        if (App.modules.timeline && App.modules.timeline.refresh) App.modules.timeline.refresh();
        return { text: '✅ 已成功添加流程任务「' + (data.task_time || '时间待定') + ' ' + data.event + '」\n\n操作已记录，其他在线用户将收到通知。' };
    },

    executeBudgetAdd: async function(data) {
        data.sort_order = Date.now();
        await App.db.insert('budget_items', data);
        await App.tracker.log('新增', '婚礼预算', '通过助手新增预算项「' + data.item_name + '」');
        if (App.modules.budget && App.modules.budget.refresh) App.modules.budget.refresh();
        return { text: '✅ 已成功添加预算项「' + data.item_name + '」\n\n分类：' + data.category + ' · 预算：¥' + (App.ui.formatMoney ? App.ui.formatMoney(data.budget_amount) : data.budget_amount) + '\n操作已记录，其他在线用户将收到通知。' };
    },

    // ============================================================
    // 辅助函数
    // ============================================================
    escapeHtml: function(text) {
        var div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    },

    escapeAttr: function(text) {
        return String(text || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
};

})();
