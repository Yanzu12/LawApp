// 元典开放平台·案例语义检索 API 配置
// 密钥通过 `supabase secrets set YUANDIAN_API_KEY=...` 注入，不写入源码
const YUANDIAN_API_BASE = 'https://open.chineselaw.com';
const YUANDIAN_CASE_SEARCH_PATH = '/open/case_vector_search';
const YUANDIAN_CASE_DETAIL_PATH = '/open/rh_case_details';
const YUANDIAN_TIMEOUT_MS = 60_000;

// DeepSeek 官方模型名：deepseek-chat / deepseek-reasoner 已于 2026-07-24 下线，
// 统一用 deepseek-flash 访问 DeepSeek-V4.1-Flash-1017
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-flash';
const DEEPSEEK_LEGACY_MODEL_PATTERN = /^deepseek-(chat|reasoner|coder|v3[0-9.]*)(-|$)/i;

// 输出长度不设上限：默认不传 max_tokens，由模型自身决定输出长度。
// 如需限制，可在 api_configs.parameters 中配置 max_tokens 覆盖。

// 截断提示文案，追加在正文末尾，避免用户误以为回答已完整
const TRUNCATION_NOTICE = '\n\n> ⚠️ **本次回答因长度限制被截断**。你可以回复"继续"，我会接着往下写完。';

function getYuandianApiKey(): string {
    const key = (Deno.env.get('YUANDIAN_API_KEY') || Deno.env.get('YUANDIAN_KEY') || '').trim();
    if (!key) {
        throw new Error('缺少元典 API Key（YUANDIAN_API_KEY）');
    }
    return key;
}

// ========== 类型定义 ==========

// 历史消息类型
interface HistoryMessage {
    role: 'user' | 'assistant';
    content: string;
}

// 上下文管理配置
const CONTEXT_CONFIG = {
    MAX_ROUNDS: 5,                    // 最多保留5轮对话
    MAX_TOTAL_LENGTH: 8000,           // 总字符数上限
    MAX_SINGLE_MESSAGE_LENGTH: 4000,  // 单条消息最大长度
    TRUNCATE_WARNING_THRESHOLD: 3500, // 单条消息截断警告阈值
};

// 数据库 base_prompts 不可用时的兜底系统提示词，保持与线上提示词同一套规则
const DEFAULT_SYSTEM_PROMPT = `【身份】
你是"吉林大学法学院 × 吉林大学计算机科学与技术学院"联合研发的法律知识助手，面向中国大陆法律体系提供咨询、法条解释、类案分析与实务建议。

【回答总原则】
1. 先给结论，再给依据，最后给动作。不要用开场白铺垫，不要复述用户问题。
2. 事实不足时，先给"基于现有信息的初步判断"，再列出最多 3 项最关键的补充信息。
3. 涉及法条写"法律名称 + 条文要点"，能确定条号就写条号；不确定就只写要点，绝不编造条号。
4. 不承诺结果（"必胜""一定胜诉"），不虚构案号、法院、法官、司法解释。
5. 同一问题存在多条路径时，用 A/B 方案对比成本、周期与风险。

【使用检索到的案例】
系统可能已为你注入"检索到的参考案例"。使用规则：
1. 先判断相关性：只有当案例的争议焦点、案件事实类型与用户问题实质相同时才引用；仅是同一大类案由但争点不同的，明确说明"该案争点与您的问题不同"，不做牵强类比。
2. 引用必须落地：写清"案号 + 法院 + 该案的裁判要点"，并说明它支持你哪一个结论。
3. 案例只作论证参考，不作普遍规则。表述为"该案中法院认为……"，而不是"法律规定……"。
4. 不得添加案例中没有的事实、数字、判决结果；不得改写案号。
5. 若检索结果与问题关联度低，直接说明"本次检索未找到高度匹配的类案"，并给出检索建议（更准确的关键词、案由、地域），不要硬套。
6. 每个引用案例最多展开 2-3 句裁判要旨，避免大段复述原文。

【检索结果的呈现】
1. 正文中不要重复罗列案例基本信息（案号、法院等由系统在文末统一附上）。
2. 正文只写"参考价值"，即该案对用户问题的启示。
3. 如果用户明确要求"找案例/类案检索"，可以按"案情相似度—裁判思路—对你的启示"整理成对照表。

【输出结构（默认，按需裁剪）】
一、结论摘要（2-4 条，直接可读）
二、法律依据与适用逻辑
三、结合本次事实的分析（事实→规则→结论）
四、可执行建议（按时间顺序，写明"做什么、向谁做、带什么材料"）
五、风险与边界（争议点、举证难点、时效/期限）
六、仍需补充的信息（如有）

【文书与文档】
若消息包含"【文档内容】…【我的问题】…"，先基于文档事实作答，不要凭空假设文档中不存在的内容，然后补充法律分析。

【语气】
专业、克制、具体。避免官话套话与过度免责；仅在结尾用一句话提示风险边界。`;

// ========== 元典案例语义检索 ==========

interface YuandianCaseItem {
    scid?: string;
    title?: string;
    ah?: string;
    jbdw?: string;
    ajlb?: string;
    wszl?: string;
    spcx?: string;
    jand?: number;
    jaDate?: number | string;
    cj?: string;
    content?: string;
    xzqh_p?: string;
    xzqh_c?: string;
    score?: number;
    ay?: string[];
    anyou?: string[];
    authority?: string;
    db?: string;
}

interface CaseSearchOptions {
    query: string;
    returnNum: number;
    wenshuType?: string;
    causeList?: string[];
    dianxing?: boolean;
}

const CASE_SECTION_MARKERS: Array<{ label: string; pattern: RegExp }> = [
    { label: '案情摘要', pattern: /本案(?:的)?案件基本事实为[:：]?/ },
    { label: '争议焦点', pattern: /争议焦点(?:在于|为|是)?[:：]?/ },
    { label: '法院裁判理由', pattern: /(?:本院|法院|该院)认为[,，:：]?/ },
];

function stripCaseHtml(text: string): string {
    return String(text || '')
        .replace(/<em>/g, '')
        .replace(/<\/em>/g, '')
        .replace(/<strong>/g, '')
        .replace(/<\/strong>/g, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\r\n/g, '\n')
        .trim();
}

function formatYuandianDate(value?: number | string): string {
    if (value === undefined || value === null || value === '') return '-';
    const raw = String(value).trim();
    if (/^\d{8}$/.test(raw)) {
        return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
    return raw;
}

/**
 * 平台返回的 content 是整理后的案例内容（基本事实 + 争议焦点 + 裁判理由），
 * 这里按司法说理节点切分为多个带标题的段落，便于前端折叠展示与文档导出。
 */
function splitCaseContentSections(content: string): Array<{ label: string; text: string }> {
    const text = stripCaseHtml(content);
    if (!text) return [];

    const hits: Array<{ label: string; index: number }> = [];
    for (const marker of CASE_SECTION_MARKERS) {
        const match = marker.pattern.exec(text);
        if (match && typeof match.index === 'number') {
            hits.push({ label: marker.label, index: match.index });
        }
    }

    const uniqueHits = hits
        .filter((hit, idx) => hits.findIndex(h => h.index === hit.index) === idx)
        .sort((a, b) => a.index - b.index);

    if (uniqueHits.length < 2) {
        return [{ label: '案例内容', text }];
    }

    const sections: Array<{ label: string; text: string }> = [];
    for (let i = 0; i < uniqueHits.length; i++) {
        const start = uniqueHits[i].index;
        const end = i < uniqueHits.length - 1 ? uniqueHits[i + 1].index : text.length;
        const sectionText = text.slice(start, end).trim();
        if (sectionText) {
            sections.push({ label: uniqueHits[i].label, text: sectionText });
        }
    }
    return sections.length > 0 ? sections : [{ label: '案例内容', text }];
}

/** 将元典返回的文书对象规范化为前端 CaseData 结构 */
function normalizeYuandianCase(item: YuandianCaseItem): any {
    const contentSections = splitCaseContentSections(item.content || '');
    const causeName = (Array.isArray(item.anyou) && item.anyou.length > 0 ? item.anyou[0] : '') || '';

    return {
        scid: item.scid || '',
        title: item.title || '未命名案例',
        caseNumber: item.ah || '-',
        court: item.jbdw || '-',
        caseType: item.ajlb || '',
        causeName,
        cause: causeName,
        judgementType: item.wszl || '判决书',
        judgementDate: formatYuandianDate(item.jaDate),
        levelOfTrial: item.spcx || '-',
        content: stripCaseHtml(item.content || ''),
        similarity: typeof item.score === 'number' ? Number(item.score.toFixed(4)) : null,
        authority: item.authority || '',
        sourceDb: item.db || '',
        region: [item.xzqh_p, item.xzqh_c].filter(Boolean).join(' '),
        courtLevel: item.cj || '',
        detail: {
            data: {
                docResult: contentSections,
                content: stripCaseHtml(item.content || '')
            }
        }
    };
}

/** 调用元典「案例语义检索」接口 */
async function searchCasesBySemantic(options: CaseSearchOptions): Promise<any[] | null> {
    const apiKey = getYuandianApiKey();
    const url = `${YUANDIAN_API_BASE}${YUANDIAN_CASE_SEARCH_PATH}`;

    const wenshuFilter: Record<string, any> = {};
    if (options.wenshuType) wenshuFilter.wenshu_type = options.wenshuType;
    if (Array.isArray(options.causeList) && options.causeList.length > 0) {
        wenshuFilter.ay = options.causeList.slice(0, 5);
    }
    if (typeof options.dianxing === 'boolean') wenshuFilter.dianxing = options.dianxing;

    const payload: Record<string, any> = {
        query: options.query,
        rewrite_flag: true,
        return_num: Math.min(Math.max(options.returnNum, 1), 45)
    };
    if (Object.keys(wenshuFilter).length > 0) {
        payload.wenshu_filter = wenshuFilter;
    }

    console.log('元典语义检索请求:', JSON.stringify({ ...payload, query: payload.query.slice(0, 120) }));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), YUANDIAN_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json; charset=utf-8',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('元典语义检索失败:', response.status, errorText.slice(0, 500));
            return null;
        }

        const result = await response.json();
        const items: YuandianCaseItem[] = Array.isArray(result?.extra?.wenshu) ? result.extra.wenshu : [];
        console.log('元典语义检索响应:', { code: result?.code, msg: result?.msg, count: items.length });

        return items
            .filter(item => item && (item.title || item.content))
            .map(normalizeYuandianCase);
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            console.error('元典语义检索超时');
        } else {
            console.error('元典语义检索异常:', error);
        }
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// ========== 元典案例详情 ==========

/** 普通案例的各正文段落字段（按裁判文书常规顺序） */
const PT_DETAIL_SECTIONS: Array<{ key: string; label: string }> = [
    { key: 'dsr', label: '当事人' },
    { key: 'ssjl', label: '诉讼记录' },
    { key: 'ajjbqk', label: '案件基本情况' },
    { key: 'cmss', label: '查明事实' },
    { key: 'ayjd', label: '争议焦点' },
    { key: 'fxgc', label: '分析过程' },
    { key: 'pjjg', label: '判决结果' },
    { key: 'ww', label: '文尾' },
];

/** 案件基本情况的细分段落，仅在缺少 ajjbqk 整体段时使用 */
const PT_DETAIL_SUB_SECTIONS: Array<{ key: string; label: string }> = [
    { key: 'ajjbqk_zk', label: '指控' },
    { key: 'ajjbqk_bh', label: '辩护' },
    { key: 'ajjbqk_zj', label: '证据' },
    { key: 'ajjbqk_bssl', label: '本审审理' },
];

/** 把详情接口返回的原始对象拆成带标题的段落 */
function buildCaseDetailSections(detail: any): Array<{ label: string; text: string }> {
    if (!detail) return [];

    // 权威案例：section 已经是 [{name, value}]
    if (Array.isArray(detail.section)) {
        const sections = detail.section
            .filter((s: any) => s && typeof s.value === 'string' && s.value.trim())
            .map((s: any) => ({ label: s.name || '段落', text: stripCaseHtml(s.value) }));
        if (sections.length > 0) return sections;
    }

    // 普通案例：按固定字段顺序拼装
    const sections: Array<{ label: string; text: string }> = [];
    const hasWholeFacts = typeof detail.ajjbqk === 'string' && detail.ajjbqk.trim().length > 0;

    for (const { key, label } of PT_DETAIL_SECTIONS) {
        const value = detail[key];
        if (typeof value === 'string' && value.trim()) {
            sections.push({ label, text: stripCaseHtml(value) });
        }
        // 没有整体"案件基本情况"时，用细分段落补上
        if (key === 'ajjbqk' && !hasWholeFacts) {
            for (const sub of PT_DETAIL_SUB_SECTIONS) {
                const subValue = detail[sub.key];
                if (typeof subValue === 'string' && subValue.trim()) {
                    sections.push({ label: sub.label, text: stripCaseHtml(subValue) });
                }
            }
        }
    }

    if (sections.length === 0 && typeof detail.content === 'string' && detail.content.trim()) {
        sections.push({ label: '正文', text: stripCaseHtml(detail.content) });
    }

    return sections;
}

// 详情按次计费（10 POINT/次），本轮内同一案例只取一次
const caseDetailCache = new Map<string, any>();

async function requestCaseDetail(params: URLSearchParams): Promise<any | null> {
    const apiKey = getYuandianApiKey();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), YUANDIAN_TIMEOUT_MS);

    try {
        const response = await fetch(
            `${YUANDIAN_API_BASE}${YUANDIAN_CASE_DETAIL_PATH}?${params.toString()}`,
            {
                method: 'GET',
                headers: { 'X-API-Key': apiKey, 'Accept': 'application/json' },
                signal: controller.signal
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('元典案例详情失败:', response.status, errorText.slice(0, 300));
            return null;
        }

        const result = await response.json();
        const list = Array.isArray(result?.data) ? result.data : [];
        return list.length > 0 ? list[0] : null;
    } catch (error: any) {
        console.error('元典案例详情异常:', error?.name === 'AbortError' ? '超时' : error);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 拉取单条案例详情。
 * 检索结果只带整理后的摘要，详情接口才返回分段正文（当事人/查明事实/分析过程/判决结果等）。
 * 优先用 id，失败再退回按案号查询。
 */
async function fetchCaseDetail(caseItem: any): Promise<any | null> {
    const cacheKey = caseItem.scid || caseItem.caseNumber;
    if (cacheKey && caseDetailCache.has(cacheKey)) {
        return caseDetailCache.get(cacheKey);
    }

    const type = caseItem.authority ? 'qwal' : 'ptal';
    const attempts: URLSearchParams[] = [];

    const id = String(caseItem.scid || '').trim();
    const ah = String(caseItem.caseNumber || '').trim();
    const hasAh = ah && ah !== '-';

    if (id) {
        const p = new URLSearchParams({ id });
        p.set('type', type);
        attempts.push(p);
        attempts.push(new URLSearchParams({ id }));
    }
    if (hasAh) {
        const p = new URLSearchParams({ ah });
        p.set('type', type);
        attempts.push(p);
        attempts.push(new URLSearchParams({ ah }));
    }

    let detail: any = null;
    for (const params of attempts) {
        detail = await requestCaseDetail(params);
        if (detail) break;
    }

    if (detail && cacheKey) {
        caseDetailCache.set(cacheKey, detail);
    }
    return detail;
}

/** 检索结果 + 详情 合并成前端可直接渲染的案例结构 */
function mergeCaseWithDetail(caseItem: any, detail: any): any {
    const sections = buildCaseDetailSections(detail);
    const merged = {
        ...caseItem,
        // 详情接口字段更权威，覆盖检索结果的同名字段
        title: detail?.title || caseItem.title,
        caseNumber: detail?.ah || caseItem.caseNumber,
        court: detail?.jbdw || caseItem.court,
        caseType: detail?.ajlb || caseItem.caseType,
        causeName: detail?.ay || caseItem.causeName,
        cause: detail?.ay || caseItem.cause,
        judgementType: detail?.wszl || caseItem.judgementType,
        judgementDate: detail?.cprq ? formatYuandianDate(detail.cprq) : caseItem.judgementDate,
        levelOfTrial: detail?.spcx || caseItem.levelOfTrial,
        region: [detail?.xzqh_p, detail?.xzqh_c].filter(Boolean).join(' ') || caseItem.region,
        judges: Array.isArray(detail?.judge) ? detail.judge.map((j: any) => j?.name).filter(Boolean) : [],
        lawyers: Array.isArray(detail?.lawyer)
            ? detail.lawyer
                .map((l: any) => {
                    const name = String(l?.name || '').trim();
                    const firm = String(l?.lawFirm || '').trim();
                    if (name && firm) return `${name}（${firm}）`;
                    return name || firm;
                })
                .filter(Boolean)
            : [],
        citedStatutes: detail?.yyft || '',
    };

    if (sections.length > 0) {
        merged.content = sections.map(s => s.text).join('\n\n');
        merged.detail = {
            data: {
                docResult: sections,
                content: merged.content,
                judgeInfo: merged.judges.join('、'),
                caseType: detail?.ajlx || ''
            }
        };
    } else {
        merged.detail = { data: { docResult: [], content: caseItem.content || '' } };
    }

    merged.detailFetched = sections.length > 0;
    return merged;
}

interface CollectedCaseData {
    systemPromptAddon: string;
    detailedCases: any[];
}

interface ModelCallResult {
    content: string;
    reasoningContent?: string;
    tokensUsed: number;
    responseTime: number;
    modelUsed?: string;
    /** 模型因长度上限提前结束输出（finish_reason === 'length'） */
    truncated?: boolean;
}

/**
 * 解析实际调用的 DeepSeek 模型名。
 * V4.1-Flash 起，thinking 不再靠切换模型名（deepseek-reasoner）实现，
 * 而是同一个 deepseek-flash 通过 thinking 参数开关思维链，
 * 因此这里统一返回 deepseek-flash，并过滤掉已下线的旧模型名。
 */
function resolveDeepSeekModelName(apiConfig: any, _enableThinking: boolean): string {
    const configuredModel = String(apiConfig?.model_name || '').trim();
    if (!configuredModel) {
        return DEEPSEEK_DEFAULT_MODEL;
    }
    if (DEEPSEEK_LEGACY_MODEL_PATTERN.test(configuredModel)) {
        console.log(`DeepSeek 模型名 ${configuredModel} 已下线，自动切换到 ${DEEPSEEK_DEFAULT_MODEL}`);
        return DEEPSEEK_DEFAULT_MODEL;
    }
    return configuredModel;
}

/** 构造 DeepSeek thinking 参数：开启走 enabled，关闭走 disabled（默认是开启且 effort=high） */
function buildDeepSeekThinkingParam(enableThinking: boolean): Record<string, any> {
    return {
        thinking: { type: enableThinking ? 'enabled' : 'disabled' }
    };
}

function chunkTextForStream(text: string): string[] {
    if (!text) return [];
    const normalized = text.replace(/\r\n/g, '\n');
    const paragraphs = normalized.split(/\n{2,}/);
    const chunks: string[] = [];
    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        if (!paragraph.trim()) continue;
        const suffix = i < paragraphs.length - 1 ? '\n\n' : '';
        if (paragraph.length <= 220) {
            chunks.push(paragraph + suffix);
        } else {
            let start = 0;
            while (start < paragraph.length) {
                const end = Math.min(start + 220, paragraph.length);
                chunks.push(paragraph.slice(start, end) + (end >= paragraph.length ? suffix : ''));
                start = end;
            }
        }
    }
    return chunks;
}

function resolveApiUrl(
    endpoint?: string,
    host?: string,
    fallbackUrl?: string,
    fallbackPath?: string,
    providerLabel?: string
): string {
    const ensureAbsolute = (value: string) =>
        /^https?:\/\//i.test(value) ? value : `https://${value.replace(/^\/+/, '')}`;
    const normalizePath = (value: string) => value.replace(/\/+$/, '');
    const fallbackPathNormalized = fallbackPath
        ? fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`
        : undefined;

    if (endpoint && endpoint.trim()) {
        const finalEndpoint = ensureAbsolute(endpoint.trim());
        console.log(`${providerLabel || 'API'} 使用自定义端点:`, finalEndpoint);
        return finalEndpoint;
    }

    if (host && host.trim()) {
        const rawHost = host.trim();
        const absoluteHost = ensureAbsolute(rawHost);
        try {
            const hostUrl = new URL(absoluteHost);
            const path = hostUrl.pathname || '/';

            if (path !== '/' && path !== '') {
                if (
                    fallbackPathNormalized &&
                    normalizePath(path) !== normalizePath(fallbackPathNormalized)
                ) {
                    console.log(`${providerLabel || 'API'} Host 路径 (${path}) 与预期 (${fallbackPathNormalized}) 不一致，使用默认路径`);
                    hostUrl.pathname = fallbackPathNormalized;
                    hostUrl.search = '';
                    hostUrl.hash = '';
                    return hostUrl.toString();
                }
                console.log(`${providerLabel || 'API'} Host 已包含路径，将直接使用:`, hostUrl.toString());
                return hostUrl.toString();
            }

            if (fallbackPathNormalized) {
                hostUrl.pathname = fallbackPathNormalized;
                console.log(`${providerLabel || 'API'} Host 补全默认路径:`, hostUrl.toString());
                return hostUrl.toString();
            }

            if (fallbackUrl) {
                const fallback = new URL(ensureAbsolute(fallbackUrl));
                hostUrl.pathname = fallback.pathname;
                hostUrl.search = fallback.search;
                hostUrl.hash = fallback.hash;
                console.log(`${providerLabel || 'API'} Host 补全默认端点:`, hostUrl.toString());
                return hostUrl.toString();
            }

            return hostUrl.toString();
        } catch (error) {
            console.error(`解析 ${providerLabel || 'API'} Host 失败，将使用默认端点`, error);
        }
    }

    if (fallbackUrl) {
        const absoluteFallback = ensureAbsolute(fallbackUrl);
        console.log(`${providerLabel || 'API'} 使用默认端点:`, absoluteFallback);
        return absoluteFallback;
    }

    throw new Error(`未找到可用的 ${providerLabel || 'API'} 调用地址，请检查配置`);
}

async function saveConversationMessage(options: {
    supabaseUrl: string;
    serviceRoleKey: string;
    sessionId: string;
    userId?: string | null;
    type: 'user' | 'assistant';
    content: string;
    metadata?: {
        apiProviderUsed?: string | null;
        modelUsed?: string | null;
        tokensUsed?: number | null;
        responseTime?: number | null;
    };
}) {
    const { supabaseUrl, serviceRoleKey, sessionId, userId, type, content, metadata } = options;
    const payload: Record<string, any> = {
        user_id: userId || null,
        session_id: sessionId,
        message_type: type,
        message_content: content,
        created_at: new Date().toISOString()
    };

    if (type === 'assistant' && metadata) {
        payload.api_provider_used = metadata.apiProviderUsed || null;
        payload.model_used = metadata.modelUsed || null;
        payload.tokens_used = metadata.tokensUsed || null;
        payload.response_time = metadata.responseTime || null;
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/conversations`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${serviceRoleKey}`,
            'apikey': serviceRoleKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('保存会话消息失败:', type, errorText);
    }
}


// 获取会话历史（最近N轮）
async function getConversationHistory(
    supabaseUrl: string,
    serviceRoleKey: string,
    sessionId: string,
    maxRounds: number = 5
): Promise<HistoryMessage[]> {
    try {
        // 获取最近的消息，user和assistant交替出现，所以取 maxRounds * 2 条
        const limit = maxRounds * 2;
        const response = await fetch(
            `${supabaseUrl}/rest/v1/conversations?session_id=eq.${sessionId}&order=created_at.desc&limit=${limit}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            console.error('获取历史消息失败');
            return [];
        }

        const messages = await response.json();

        // 反转顺序（从旧到新）
        const sortedMessages = messages.reverse();

        // 转换为标准格式
        // 助手消息末尾带有案例数据注释（供前端还原卡片），
        // 这里必须剥离，否则会被当作正文喂回模型，污染上下文。
        return sortedMessages.map((msg: any) => ({
            role: msg.message_type === 'user' ? 'user' : 'assistant',
            content: stripRelatedCasesMeta(msg.message_content || '')
        }));
    } catch (error) {
        console.error('获取会话历史出错:', error);
        return [];
    }
}

// 计算消息的大概token数（粗略估算：中文约1.5字符/token，英文约4字符/token）
function estimateTokens(text: string): number {
    if (!text) return 0;
    // 统计中文字符数
    const chineseChars = (text.match(/[一-龥]/g) || []).length;
    // 统计其他字符数
    const otherChars = text.length - chineseChars;
    // 估算：中文 1.5字符/token，英文 4字符/token
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
}

// 截断单条消息内容
function truncateSingleMessage(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
        return content;
    }

    const truncated = content.substring(0, maxLength - 50);
    return truncated + '\n...[内容过长已截断]';
}

// 管理上下文窗口：保留最近N轮对话，并控制总长度
function manageContextWindow(history: HistoryMessage[]): {
    managedHistory: HistoryMessage[];
    warnings: string[];
} {
    const warnings: string[] = [];

    // 1. 截断过长的单条消息
    let processedHistory = history.map((msg, index) => {
        if (msg.content.length > CONTEXT_CONFIG.MAX_SINGLE_MESSAGE_LENGTH) {
            warnings.push(`消息${index + 1}过长(${msg.content.length}字符)，已截断至${CONTEXT_CONFIG.MAX_SINGLE_MESSAGE_LENGTH}字符`);
            return {
                ...msg,
                content: truncateSingleMessage(msg.content, CONTEXT_CONFIG.MAX_SINGLE_MESSAGE_LENGTH)
            };
        }
        return msg;
    });

    // 2. 限制轮数：最多保留5轮对话（10条消息）
    if (processedHistory.length > CONTEXT_CONFIG.MAX_ROUNDS * 2) {
        const removed = processedHistory.length - CONTEXT_CONFIG.MAX_ROUNDS * 2;
        processedHistory = processedHistory.slice(-CONTEXT_CONFIG.MAX_ROUNDS * 2);
        warnings.push(`历史消息超过${CONTEXT_CONFIG.MAX_ROUNDS}轮，已移除最早的${removed}条消息`);
    }

    // 3. 控制总字符数
    let totalLength = processedHistory.reduce((sum, msg) => sum + msg.content.length, 0);

    while (totalLength > CONTEXT_CONFIG.MAX_TOTAL_LENGTH && processedHistory.length > 0) {
        const removed = processedHistory.shift();
        if (removed) {
            totalLength -= removed.content.length;
            warnings.push(`总字符数超限，移除最早的1条消息`);
        }
    }

    return {
        managedHistory: processedHistory,
        warnings
    };
}

// 构建多轮对话消息列表（用于发送给AI模型）
function buildMultiRoundMessages(
    systemPrompt: string,
    history: HistoryMessage[],
    currentMessage: string
): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: systemPrompt }
    ];

    // 添加历史消息
    for (const msg of history) {
        messages.push({
            role: msg.role,
            content: msg.content
        });
    }

    // 添加当前用户消息
    messages.push({
        role: 'user',
        content: currentMessage
    });

    return messages;
}

/**
 * 把最近几轮对话压成检索用的上下文片段。
 * 检索不能被单句孤立理解——用户第二句往往是"那如果……""这种情况呢"，
 * 脱离上文会检索到完全不相关的案例。
 */
function buildHistoryBrief(history: HistoryMessage[], maxRounds: number = 3): string {
    if (!history || history.length === 0) return '';

    const recent = history.slice(-maxRounds * 2);
    const lines: string[] = [];

    for (const msg of recent) {
        const text = String(msg.content || '').trim();
        if (!text) continue;
        // 历史里的助手回复带有案例附录，检索只关心法律要点，做一次粗剪
        const cleaned = text.split('## 📚 相关法律案例参考')[0].trim();
        if (!cleaned) continue;
        const excerpt = cleaned.length > 300 ? `${cleaned.slice(0, 300)}…` : cleaned;
        lines.push(`${msg.role === 'user' ? '用户' : '助手'}：${excerpt}`);
    }

    return lines.join('\n');
}

// AI智能分析用户问题，产出语义检索所需的过滤条件
async function analyzeQuestionWithAI(message: string, apiConfig: any, history: HistoryMessage[] = []): Promise<any> {
    const historyBrief = buildHistoryBrief(history);
    const historyBlock = historyBrief
        ? `\n对话上文（供理解指代与追问）：\n${historyBrief}\n`
        : '\n（这是本轮对话的第一个问题，没有上文）\n';

    const analysisPrompt = `你是法律案例检索助手。系统会对"检索用查询语句"做语义检索（不做关键词分词），
你的任务是把它补全成一个脱离上下文也能独立理解的检索句，并给出过滤条件。

当前用户输入：
${message}
${historyBlock}
请只返回 JSON，不要任何解释文字：
{
  "searchQuery": "补全后的检索查询语句",  // 关键：把上文中的事实、主体、法律关系合并进来；若当前输入已完整则原样返回
  "caseType": "民事案件/刑事案件/行政案件/执行案件/其他",  // 若无法判断填"其他"
  "cause": "规范案由名称",  // 例如：劳动合同纠纷、民间借贷纠纷、机动车交通事故责任纠纷、盗窃罪；无法判断填空字符串
  "keywords": ["关键词1", "关键词2", "关键词3"],  // 仅作检索补充提示，最多3个，必须是法律术语而非口语
  "partyStanding": "原告方/被告方/不明显",  // 用户站在哪一方，用于调整回答视角
  "userIntent": "一句话概括用户真正想解决的问题"
}

规则：
1. searchQuery 必须自包含：把"他/这个/那如果/这种情况"等指代替换成上文的具体主体与事实。
2. 若当前输入引入了新事实，searchQuery 以本轮新事实为主，上文仅用于补全指代。
3. 不要臆造上文没有的事实；信息不足时按当前输入原样检索。
4. 案由必须使用《民事案件案由规定》或刑事罪名中的规范表述，不要自造。
5. 不确定就留空，不要猜测案件类型。`;

    try {
        const providerType = String(apiConfig.api_provider || '').toLowerCase();

        if (providerType.includes('deepseek')) {
            const apiUrl = resolveApiUrl(
                apiConfig.api_endpoint,
                apiConfig.api_host,
                'https://api.deepseek.com/v1/chat/completions',
                '/v1/chat/completions',
                'DeepSeek'
            );

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiConfig.api_key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: resolveDeepSeekModelName(apiConfig, false),
                    messages: [{ role: 'user', content: analysisPrompt }],
                    temperature: 0.3,  // 低温度保证输出稳定
                    max_tokens: 500,
                    // 分析任务只求结构化输出，关闭思维链以降低延迟
                    ...buildDeepSeekThinkingParam(false)
                })
            });

            if (!response.ok) {
                throw new Error('AI分析失败');
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';

            // 提取JSON内容
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } else {
            // 使用通义千问
            const apiUrl = resolveApiUrl(
                apiConfig.api_endpoint,
                apiConfig.api_host,
                'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
                '/api/v1/services/aigc/text-generation/generation',
                'Qwen'
            );

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiConfig.api_key}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: apiConfig.model_name || 'qwen-turbo',
                    input: {
                        messages: [{ role: 'user', content: analysisPrompt }]
                    },
                    parameters: {
                        max_tokens: 500,
                        temperature: 0.3,
                        result_format: 'message'
                    }
                })
            });

            if (!response.ok) {
                throw new Error('AI分析失败');
            }

            const data = await response.json();
            const content = data.output?.text || data.output?.choices?.[0]?.message?.content || '';

            // 提取JSON内容
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        }
    } catch (error) {
        console.error('AI问题分析出错:', error);
    }

    // 如果AI分析失败，返回默认值
    return null;
}

/**
 * 语义检索吃的是自然语言案情描述。
 * 优先用 AI 结合上文补全后的 searchQuery（能解决"那这种情况呢"这类指代），
 * 拿不到时退回本条消息原文。
 */
function buildSemanticQuery(message: string, aiAnalysis: any): string {
    const docMatch = message.match(/【我的问题】([\s\S]*)$/);
    const question = (docMatch ? docMatch[1] : message).trim();

    const rewritten = String(aiAnalysis?.searchQuery || '').trim();
    const base = rewritten || question || message;

    const extraHints: string[] = [];
    if (aiAnalysis?.cause) extraHints.push(String(aiAnalysis.cause));
    if (Array.isArray(aiAnalysis?.keywords) && aiAnalysis.keywords.length > 0) {
        extraHints.push(aiAnalysis.keywords.slice(0, 3).join('、'));
    }

    // 检索原文控制在合理长度内，过长的文档正文会稀释语义检索的指向性
    const trimmed = base.length > 400 ? base.slice(0, 400) : base;

    return extraHints.length > 0 ? `${trimmed}（${extraHints.join('；')}）` : trimmed;
}

/** 把 AI 分析出的案件类型映射到元典 wenshu_type 枚举 */
function normalizeWenshuType(caseType?: string): string | undefined {
    if (!caseType) return undefined;
    const value = String(caseType).trim();
    const allowed = [
        '刑事案件', '民事案件', '行政案件', '执行案件',
        '管辖案件', '国家赔偿与司法救助案件', '强制清算与破产案件'
    ];
    if (allowed.includes(value)) return value;
    if (value.includes('民事')) return '民事案件';
    if (value.includes('刑事')) return '刑事案件';
    if (value.includes('行政')) return '行政案件';
    if (value.includes('执行')) return '执行案件';
    return undefined;
}

async function collectCaseContext(
    message: string,
    enableCaseSearch: boolean,
    caseCount: number = 1,
    apiConfig: any,
    history: HistoryMessage[] = []
): Promise<CollectedCaseData> {
    let systemPromptAddon = '';
    const detailedCases: any[] = [];

    if (!enableCaseSearch) {
        return { systemPromptAddon, detailedCases };
    }

    try {
        // 语义检索内部会做查询改写，AI 分析负责结合上文补全检索句 + 补充过滤条件；
        // 分析失败不影响检索，因此容错处理。
        console.log('正在分析用户问题并准备语义检索...');
        const aiAnalysis = await analyzeQuestionWithAI(message, apiConfig, history).catch(() => null);
        if (aiAnalysis) {
            console.log('AI分析结果:', {
                searchQuery: aiAnalysis.searchQuery,
                keywords: aiAnalysis.keywords,
                caseType: aiAnalysis.caseType,
                cause: aiAnalysis.cause
            });
        }

        const query = buildSemanticQuery(message, aiAnalysis);
        const requestCount = Math.min(Math.max(caseCount, 1), 10);
        const wenshuType = normalizeWenshuType(aiAnalysis?.caseType);
        const causeList = aiAnalysis?.cause ? [String(aiAnalysis.cause)] : undefined;

        let cases = await searchCasesBySemantic({
            query,
            returnNum: requestCount,
            wenshuType,
            causeList
        });

        // 案由/案件类别是精确枚举过滤，AI 判断偏差时会直接查空。
        // 命中为空时退化为纯语义检索，保证至少能返回相似案例。
        if ((!cases || cases.length === 0) && (wenshuType || causeList)) {
            console.log('带过滤条件未命中，去掉过滤条件重试');
            cases = await searchCasesBySemantic({ query, returnNum: requestCount });
        }

        if (cases && cases.length > 0) {
            console.log(`找到 ${cases.length} 个相关案例，开始拉取案例详情`);

            // 检索接口只返回整理后的摘要，详情接口才有分段正文。
            // 详情按次计费，因此只对最终展示的条数拉取，并并行请求。
            const detailResults = await Promise.all(
                cases.map(async (item) => {
                    try {
                        const detail = await fetchCaseDetail(item);
                        return detail ? mergeCaseWithDetail(item, detail) : item;
                    } catch (error) {
                        console.error('拉取案例详情失败:', item?.title, error);
                        return item;
                    }
                })
            );

            const withDetail = detailResults.filter(item => item?.detailFetched).length;
            console.log(`案例详情拉取完成: ${withDetail}/${detailResults.length} 条成功`);
            detailedCases.push(...detailResults);

            let casesContext = '\n\n## 检索到的参考案例（按语义相似度降序）\n';
            casesContext += '> 以下是从案例库中语义检索到的真实案例，可用于论证参考。引用时必须使用其原始案号与法院，不得改写或编造。\n';

            for (let i = 0; i < detailedCases.length; i++) {
                const caseItem = detailedCases[i];
                const similarityText = caseItem.similarity !== null && caseItem.similarity !== undefined
                    ? `｜相似度 ${caseItem.similarity}`
                    : '';
                casesContext += `\n### 案例${i + 1}：${caseItem.title}${similarityText}\n`;
                casesContext += `- 案号：${caseItem.caseNumber}\n`;
                casesContext += `- 法院：${caseItem.court}${caseItem.courtLevel ? `（${caseItem.courtLevel}法院）` : ''}\n`;
                casesContext += `- 案件类别：${caseItem.caseType || '未标注'}｜文书种类：${caseItem.judgementType}\n`;
                casesContext += `- 案由：${caseItem.causeName || '未标注'}\n`;
                casesContext += `- 结案日期：${caseItem.judgementDate}｜审理程序：${caseItem.levelOfTrial}\n`;
                if (caseItem.authority) {
                    casesContext += `- 案例来源：${caseItem.authority}\n`;
                }
                if (caseItem.judges?.length) {
                    casesContext += `- 审判人员：${caseItem.judges.join('、')}\n`;
                }
                if (caseItem.citedStatutes) {
                    casesContext += `- 援引法条：${caseItem.citedStatutes}\n`;
                }
                if (caseItem.content) {
                    const limit = detailedCases.length <= 2 ? 1600 : 900;
                    const excerpt = caseItem.content.length > limit
                        ? `${caseItem.content.slice(0, limit)}……（已截断）`
                        : caseItem.content;
                    casesContext += `\n**案例内容：**\n${excerpt}\n`;
                }
            }

            systemPromptAddon = casesContext;
        } else {
            console.log('未检索到相关案例');
        }
    } catch (error) {
        console.error('案例检索失败:', error);
    }

    return { systemPromptAddon, detailedCases };
}

/** 剥离消息末尾的案例数据，避免回灌模型时污染上下文（兼容新旧两种格式） */
function stripRelatedCasesMeta(content: string): string {
    if (!content) return '';
    let cleaned = content.replace(/<!--RELATED_CASES:[\s\S]*?-->\s*$/, '');
    // 旧数据：案例附录曾被直接拼进正文
    const legacyMarker = '## 📚 相关法律案例参考';
    const legacyIndex = cleaned.indexOf(legacyMarker);
    if (legacyIndex !== -1) {
        cleaned = cleaned.slice(0, legacyIndex);
    }
    return cleaned.trimEnd();
}

/**
 * 案例卡片在历史回看时仍需还原，但不能再拼进回复正文——
 * 用户要求案例只出现在检索阶段，正文保持模型原始输出。
 * 这里用 HTML 注释承载案例数据：Markdown 渲染不会显示，前端解析后还原为卡片。
 */
function buildRelatedCasesMeta(cases: any[]): string {
    if (!cases || cases.length === 0) return '';
    const compact = cases.map(item => ({
        title: item.title,
        caseNumber: item.caseNumber,
        court: item.court,
        caseType: item.caseType,
        causeName: item.causeName,
        judgementType: item.judgementType,
        judgementDate: item.judgementDate,
        levelOfTrial: item.levelOfTrial,
        similarity: item.similarity,
        authority: item.authority,
        content: item.content ? String(item.content).slice(0, 4000) : '',
        detail: item.detail
    }));
    try {
        // 避免注释里出现 --> 提前闭合
        const json = JSON.stringify(compact).replace(/-->/g, '--\\u003e');
        return `\n\n<!--RELATED_CASES:${json}-->`;
    } catch (error) {
        console.error('序列化案例数据失败:', error);
        return '';
    }
}

async function callModel(
    providerType: string,
    apiConfig: any,
    systemPrompt: string,
    message: string,
    enableThinking: boolean = false,
    history: HistoryMessage[] = []  // 新增：历史消息参数
): Promise<ModelCallResult> {
    const startTime = Date.now();

    if (providerType === 'deepseek') {
        const modelUsed = resolveDeepSeekModelName(apiConfig, enableThinking);
        const apiUrl = resolveApiUrl(
            apiConfig.api_endpoint,
            apiConfig.api_host,
            'https://api.deepseek.com/v1/chat/completions',
            '/v1/chat/completions',
            'DeepSeek'
        );
        console.log('DeepSeek 调用地址:', apiUrl);

        const parameters = (apiConfig.parameters && typeof apiConfig.parameters === 'object' && !Array.isArray(apiConfig.parameters))
            ? { ...(apiConfig.parameters as Record<string, any>) }
            : {};
        const {
            max_tokens: dsMaxTokens,
            temperature: dsTemperature,
            stream: dsStream,
            model: _ignoredParamModel,
            messages: _ignoredParamMessages,
            thinking: _ignoredParamThinking,
            reasoning_effort: _ignoredParamEffort,
            ...deepseekRest
        } = parameters;

        if (_ignoredParamModel) {
            console.log('DeepSeek parameters.model 已忽略，模型由 model_name 决定');
        }

        // 构建多轮对话消息列表
        const messages = buildMultiRoundMessages(systemPrompt, history, message);
        console.log(`DeepSeek 多轮对话: 系统消息 + ${history.length} 条历史消息 + 当前消息`);

        const deepseekResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiConfig.api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: modelUsed,
                messages: messages,  // 使用多轮对话消息列表
                temperature: dsTemperature ?? (enableThinking ? 0.95 : 1.0),
                // 未显式配置 max_tokens 时不传该字段，交由模型决定输出长度
                ...(typeof dsMaxTokens === 'number' ? { max_tokens: dsMaxTokens } : {}),
                stream: dsStream ?? false,
                ...buildDeepSeekThinkingParam(enableThinking),
                ...deepseekRest
            })
        });

        if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            throw new Error(`DeepSeek API调用失败: ${errorText}`);
        }

        console.log('DeepSeek 非流式模型:', modelUsed, 'thinking:', enableThinking ? 'on' : 'off');

        const deepseekData = await deepseekResponse.json();
        const content = deepseekData.choices?.[0]?.message?.content || deepseekData.output_text || '';
        const reasoningContent = deepseekData.choices?.[0]?.message?.reasoning_content || '';
        const tokensUsed = deepseekData.usage?.total_tokens || deepseekData.usage?.output_tokens || 0;
        return {
            content,
            reasoningContent,
            tokensUsed,
            responseTime: Date.now() - startTime,
            modelUsed,
            truncated: deepseekData.choices?.[0]?.finish_reason === 'length'
        };
    }

    // 默认使用通义千问
    const apiUrl = resolveApiUrl(
        apiConfig.api_endpoint,
        apiConfig.api_host,
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        '/api/v1/services/aigc/text-generation/generation',
        'Qwen'
    );
    console.log('Qwen 调用地址:', apiUrl);

    const parameters = (apiConfig.parameters && typeof apiConfig.parameters === 'object' && !Array.isArray(apiConfig.parameters))
        ? { ...(apiConfig.parameters as Record<string, any>) }
        : {};
    const { max_tokens: qwenMaxTokens, temperature: qwenTemperature, ...qwenRest } = parameters;

    // 构建多轮对话消息列表
    const messages = buildMultiRoundMessages(systemPrompt, history, message);
    console.log(`Qwen 多轮对话: 系统消息 + ${history.length} 条历史消息 + 当前消息`);

    const aliyunResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiConfig.api_key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: apiConfig.model_name || 'qwen-turbo',
            input: {
                messages: messages  // 使用多轮对话消息列表
            },
            parameters: {
                // 未显式配置 max_tokens 时不传该字段，交由模型决定输出长度
                ...(typeof qwenMaxTokens === 'number' ? { max_tokens: qwenMaxTokens } : {}),
                temperature: qwenTemperature ?? 0.7,
                ...qwenRest
            }
        })
    });

    if (!aliyunResponse.ok) {
        const errorText = await aliyunResponse.text();
        console.error('阿里云API错误:', errorText);
        throw new Error(`阿里云API调用失败: ${errorText}`);
    }

    const aliyunData = await aliyunResponse.json();
    const content = aliyunData.output?.text || aliyunData.output?.choices?.[0]?.message?.content || '';
    const tokensUsed = aliyunData.usage?.total_tokens || aliyunData.usage?.output_tokens || 0;
    return {
        content,
        tokensUsed,
        responseTime: Date.now() - startTime,
        modelUsed: apiConfig.model_name || 'qwen-turbo',
        truncated: aliyunData.output?.finish_reason === 'length'
    };
}

async function processSSEStream(
    response: Response,
    onEvent: (event: { event: string; data: string }) => boolean | void
) {
    if (!response.body) {
        throw new Error('模型接口未返回可读的流');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            // 处理流结束时残留的最后一个事件，避免尾部内容丢失
            if (buffer.trim()) {
                const lines = buffer.trim().split('\n');
                let eventName = 'message';
                const dataLines: string[] = [];

                for (const line of lines) {
                    if (line.startsWith('event:')) {
                        eventName = line.slice(6).trim();
                    } else if (line.startsWith('data:')) {
                        dataLines.push(line.slice(5).trim());
                    }
                }

                const data = dataLines.join('\n');
                if (data) {
                    onEvent({ event: eventName, data });
                }
            }
            break;
        }
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n\n');
        while (boundary !== -1) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            if (rawEvent.trim()) {
                const lines = rawEvent.split('\n');
                let eventName = 'message';
                const dataLines: string[] = [];

                for (const line of lines) {
                    if (line.startsWith('event:')) {
                        eventName = line.slice(6).trim();
                    } else if (line.startsWith('data:')) {
                        dataLines.push(line.slice(5).trim());
                    }
                }

                const data = dataLines.join('\n');
                if (data) {
                    const shouldTerminate = onEvent({ event: eventName, data });
                    if (shouldTerminate === true) {
                        return;
                    }
                }
            }

            boundary = buffer.indexOf('\n\n');
        }
    }
}

interface StreamModelOptions {
    providerType: string;
    apiConfig: any;
    systemPrompt: string;
    message: string;
    enableThinking?: boolean;
    onToken: (chunk: string) => void;
    onReasoningToken?: (chunk: string) => void;
    history?: HistoryMessage[];  // 新增：历史消息参数
}

async function streamModelResponse(options: StreamModelOptions): Promise<ModelCallResult> {
    const { providerType, apiConfig, systemPrompt, message, enableThinking = false, onToken, onReasoningToken, history = [] } = options;
    const startTime = Date.now();
    let tokensUsed = 0;
    let accumulatedContent = '';
    let accumulatedReasoning = '';
    let latestReasoning = '';
    let truncated = false;

    const fallbackReturn = (content: string, usage?: any, reasoningContent: string = '', modelUsed?: string, finishReason?: string) => {
        if (reasoningContent) {
            accumulatedReasoning += reasoningContent;
            onReasoningToken?.(reasoningContent);
        }
        if (content) {
            onToken(content);
        }
        const totalTokens = usage?.total_tokens || usage?.output_tokens || 0;
        return {
            content,
            reasoningContent: accumulatedReasoning,
            tokensUsed: totalTokens,
            responseTime: Date.now() - startTime,
            modelUsed,
            truncated: finishReason === 'length'
        };
    };

    if (providerType === 'deepseek') {
        const modelUsed = resolveDeepSeekModelName(apiConfig, enableThinking);
        const apiUrl = resolveApiUrl(
            apiConfig.api_endpoint,
            apiConfig.api_host,
            'https://api.deepseek.com/v1/chat/completions',
            '/v1/chat/completions',
            'DeepSeek'
        );

        const parameters = (apiConfig.parameters && typeof apiConfig.parameters === 'object' && !Array.isArray(apiConfig.parameters))
            ? { ...(apiConfig.parameters as Record<string, any>) }
            : {};
        const {
            max_tokens: dsMaxTokens,
            temperature: dsTemperature,
            model: _ignoredParamModel,
            messages: _ignoredParamMessages,
            stream: _ignoredParamStream,
            thinking: _ignoredParamThinking,
            reasoning_effort: _ignoredParamEffort,
            ...deepseekRest
        } = parameters;

        if (_ignoredParamModel) {
            console.log('DeepSeek parameters.model 已忽略，模型由 model_name 决定');
        }

        // 构建多轮对话消息列表
        const messages = buildMultiRoundMessages(systemPrompt, history, message);
        console.log(`DeepSeek 流式多轮对话: 系统消息 + ${history.length} 条历史消息 + 当前消息`);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiConfig.api_key}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                model: modelUsed,
                messages: messages,  // 使用多轮对话消息列表
                temperature: dsTemperature ?? (enableThinking ? 0.95 : 1.0),
                // 未显式配置 max_tokens 时不传该字段，交由模型决定输出长度
                ...(typeof dsMaxTokens === 'number' ? { max_tokens: dsMaxTokens } : {}),
                stream: true,
                ...buildDeepSeekThinkingParam(enableThinking),
                ...deepseekRest
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API调用失败: ${errorText}`);
        }

        console.log('DeepSeek 流式模型:', modelUsed, 'thinking:', enableThinking ? 'on' : 'off');

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
            const payload = await response.json();
            const content = payload.choices?.[0]?.message?.content || payload.output_text || '';
            const reasoningContent = payload.choices?.[0]?.message?.reasoning_content || '';
            return fallbackReturn(content, payload.usage, reasoningContent, modelUsed, payload.choices?.[0]?.finish_reason);
        }

        await processSSEStream(response, ({ data }) => {
            if (!data) return;
            if (data === '[DONE]') {
                return true;
            }

            let payload: any;
            try {
                payload = JSON.parse(data);
            } catch (error) {
                console.error('解析 DeepSeek 流事件失败:', error, data);
                return;
            }

            const delta = payload.choices?.[0]?.delta?.content || '';
            if (delta) {
                accumulatedContent += delta;
                onToken(delta);
            }

            const reasoningDelta = payload.choices?.[0]?.delta?.reasoning_content || '';
            const reasoningFull = payload.choices?.[0]?.message?.reasoning_content || '';
            if (reasoningDelta) {
                accumulatedReasoning += reasoningDelta;
                latestReasoning = accumulatedReasoning;
                onReasoningToken?.(reasoningDelta);
            } else if (reasoningFull) {
                if (reasoningFull.startsWith(latestReasoning)) {
                    const extra = reasoningFull.slice(latestReasoning.length);
                    if (extra) {
                        accumulatedReasoning += extra;
                        onReasoningToken?.(extra);
                    }
                } else {
                    accumulatedReasoning += reasoningFull;
                    onReasoningToken?.(reasoningFull);
                }
                latestReasoning = reasoningFull;
            }

            if (payload.usage?.total_tokens) {
                tokensUsed = payload.usage.total_tokens;
            }

            // DeepSeek 在流末尾的 chunk 里给出 finish_reason
            if (payload.choices?.[0]?.finish_reason === 'length') {
                truncated = true;
            }
        });

        return {
            content: accumulatedContent,
            reasoningContent: accumulatedReasoning,
            tokensUsed,
            responseTime: Date.now() - startTime,
            modelUsed,
            truncated
        };
    }

    // 默认使用通义千问
    const apiUrl = resolveApiUrl(
        apiConfig.api_endpoint,
        apiConfig.api_host,
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        '/api/v1/services/aigc/text-generation/generation',
        'Qwen'
    );

    const parameters = (apiConfig.parameters && typeof apiConfig.parameters === 'object' && !Array.isArray(apiConfig.parameters))
        ? { ...(apiConfig.parameters as Record<string, any>) }
        : {};
    const { max_tokens: qwenMaxTokens, temperature: qwenTemperature, ...qwenRest } = parameters;

    // 构建多轮对话消息列表
    const messages = buildMultiRoundMessages(systemPrompt, history, message);
    console.log(`Qwen 流式多轮对话: 系统消息 + ${history.length} 条历史消息 + 当前消息`);

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiConfig.api_key}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'X-DashScope-SSE': 'enable'
        },
        body: JSON.stringify({
            model: apiConfig.model_name || 'qwen-turbo',
            input: {
                messages: messages  // 使用多轮对话消息列表
            },
            parameters: {
                // 未显式配置 max_tokens 时不传该字段，交由模型决定输出长度
                ...(typeof qwenMaxTokens === 'number' ? { max_tokens: qwenMaxTokens } : {}),
                temperature: qwenTemperature ?? 0.7,
                ...qwenRest,
                stream: true
            }
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('阿里云API错误:', errorText);
        throw new Error(`阿里云API调用失败: ${errorText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
        const payload = await response.json();
        const content = payload.output?.text || payload.output_text || payload.choices?.[0]?.message?.content || '';
        return fallbackReturn(content, payload.usage);
    }

    let latestText = '';

    await processSSEStream(response, ({ data }) => {
        if (!data) return;
        if (data === '[DONE]') {
            return true;
        }

        let payload: any;
        try {
            payload = JSON.parse(data);
        } catch (error) {
            console.error('解析 Qwen 流事件失败:', error, data);
            return;
        }

        if (payload.status === 'FAILED') {
            throw new Error(payload.message || '通义千问流式调用失败');
        }

        if (payload.usage?.output_tokens) {
            tokensUsed = payload.usage.output_tokens;
        } else if (payload.metrics?.total_tokens) {
            tokensUsed = payload.metrics.total_tokens;
        }

        let emitted = false;
        if (typeof payload.output?.text === 'string') {
            const text = payload.output.text;
            if (text.startsWith(latestText)) {
                const delta = text.slice(latestText.length);
                if (delta) {
                    accumulatedContent += delta;
                    onToken(delta);
                    emitted = true;
                }
            } else {
                accumulatedContent += text;
                onToken(text);
                emitted = true;
            }
            latestText = text;
        } else if (payload.output_text) {
            const text = String(payload.output_text);
            if (text.startsWith(latestText)) {
                const delta = text.slice(latestText.length);
                if (delta) {
                    accumulatedContent += delta;
                    onToken(delta);
                    emitted = true;
                }
            } else {
                accumulatedContent += text;
                onToken(text);
                emitted = true;
            }
            latestText = text;
        } else if (payload.choices?.[0]?.delta?.content) {
            const delta = payload.choices[0].delta.content;
            accumulatedContent += delta;
            onToken(delta);
            emitted = true;
        }

        if (!emitted && payload.message) {
            console.log('Qwen 流事件:', payload.message);
        }

        if (payload.status && payload.status !== 'RUNNING') {
            return true;
        }
    });

    if (!accumulatedContent && latestText) {
        accumulatedContent = latestText;
    }

    return {
        content: accumulatedContent,
        reasoningContent: accumulatedReasoning,
        tokensUsed,
        responseTime: Date.now() - startTime,
        modelUsed: apiConfig.model_name || 'qwen-turbo',
        truncated
    };
}

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        const {
            message,
            sessionId,
            userId,
            enableCaseSearch = true,
            enableThinking = false,
            provider: preferredProvider,
            stream = false,
            caseCount = 1
        } = await req.json();

        if (!message || !sessionId) {
            throw new Error('消息内容和会话ID为必填项');
        }
        
        // 验证案例数量范围
        const validCaseCount = Math.min(Math.max(parseInt(caseCount) || 1, 1), 5);
        console.log('类案检索状态:', enableCaseSearch ? '启用' : '禁用', '案例数量:', validCaseCount);

        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase配置缺失');
        }

        console.log('收到对话请求:', { sessionId, messageLength: message.length, preferredProvider: preferredProvider || 'auto' });

        // 获取当前激活的API配置
        const apiConfigResponse = await fetch(`${supabaseUrl}/rest/v1/api_configs?is_active=eq.true&order=created_at.desc`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!apiConfigResponse.ok) {
            throw new Error('获取API配置失败');
        }

        const apiConfigs = await apiConfigResponse.json();
        if (!apiConfigs || apiConfigs.length === 0) {
            throw new Error('未找到激活的API配置，请联系管理员');
        }

        const normalizeProvider = (value: any) => {
            if (!value) return '';
            const lower = String(value).toLowerCase();
            if (lower.includes('deepseek')) return 'deepseek';
            if (lower.includes('qwen') || lower.includes('通义') || lower.includes('tongyi') || lower.includes('aliyun')) return 'qwen';
            return lower;
        };

        let apiConfig = null;
        if (preferredProvider) {
            const preferred = normalizeProvider(preferredProvider);
            apiConfig = apiConfigs.find((config: any) => normalizeProvider(config.api_provider) === preferred) || null;
        }

        if (!apiConfig) {
            apiConfig = apiConfigs[0];
        }

        if (!apiConfig) {
            throw new Error('未找到匹配的API配置，请联系管理员');
        }

        console.log('使用API配置:', {
            requested: preferredProvider || null,
            provider: apiConfig.api_provider,
            model: apiConfig.model_name
        });

        // 获取当前激活的基础提示词
        const basePromptResponse = await fetch(`${supabaseUrl}/rest/v1/base_prompts?is_active=eq.true&order=created_at.desc&limit=1`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        let systemPrompt = DEFAULT_SYSTEM_PROMPT;
        if (basePromptResponse.ok) {
            const basePrompts = await basePromptResponse.json();
            if (basePrompts && basePrompts.length > 0) {
                systemPrompt = basePrompts[0].content;
            }
        }

        const streamRequested = Boolean(stream) || Boolean(req.headers.get('accept')?.includes('text/event-stream'));

        await saveConversationMessage({
            supabaseUrl,
            serviceRoleKey,
            sessionId,
            userId,
            type: 'user',
            content: message
        });

        // 获取会话历史
        // 注意：本轮用户消息已在上面写入 conversations，查询会把它一起取回来。
        // 这里剔除末尾这条，否则既会让检索把"当前输入"当成上文，
        // 也会让模型拿到重复的 user 消息。
        console.log('正在获取会话历史...');
        const rawHistory = await getConversationHistory(supabaseUrl, serviceRoleKey, sessionId, CONTEXT_CONFIG.MAX_ROUNDS);

        const historyWithoutCurrent = (() => {
            const list = [...rawHistory];
            const last = list[list.length - 1];
            if (last && last.role === 'user' && last.content === message) {
                list.pop();
            }
            return list;
        })();

        // 应用上下文管理策略
        const { managedHistory, warnings } = manageContextWindow(historyWithoutCurrent);

        if (warnings.length > 0) {
            console.log('上下文管理警告:', warnings);
        }

        console.log(`历史消息加载完成: ${rawHistory.length} 条原始消息 → ${managedHistory.length} 条上文消息（已剔除本轮输入）`);

        const providerType = normalizeProvider(apiConfig.api_provider) || 'qwen';
        const validEnableThinking = providerType === 'deepseek' && Boolean(enableThinking);
        console.log('Thinking模式:', validEnableThinking ? '启用' : '禁用');
        const caseContextPromise = collectCaseContext(message, enableCaseSearch, validCaseCount, apiConfig, managedHistory);

        if (streamRequested) {
            return new Response(new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    const sendEvent = (event: string, payload: any) => {
                        controller.enqueue(encoder.encode(`event:${event}\ndata:${JSON.stringify(payload)}\n\n`));
                    };

                    try {
                        if (enableCaseSearch) {
                            sendEvent('case-status', { status: 'searching', message: '正在为您检索相似案例' });
                        }

                        const caseData = await caseContextPromise;
                        if (caseData.systemPromptAddon) {
                            systemPrompt += caseData.systemPromptAddon;
                        }

                        if (enableCaseSearch) {
                            sendEvent('related-cases', { cases: caseData.detailedCases || [] });
                            sendEvent('case-status', {
                                status: 'completed',
                                message: caseData.detailedCases?.length
                                    ? `已检索到 ${caseData.detailedCases.length} 个相关案例`
                                    : '未检索到相关案例，将直接生成模型回复'
                            });
                        }

                        const modelResult = await streamModelResponse({
                            providerType,
                            apiConfig,
                            systemPrompt,
                            message,
                            enableThinking: validEnableThinking,
                            history: managedHistory,
                            onToken: (chunk) => {
                                if (chunk) {
                                    sendEvent('token', { content: chunk });
                                }
                            },
                            onReasoningToken: (chunk) => {
                                if (chunk) {
                                    sendEvent('reasoning-token', { content: chunk });
                                }
                            }
                        });

                        // 案例只在检索阶段展示（前端 related-cases 面板），
                        // 不再拼接进回复正文；仅以隐藏注释形式随消息落库，供历史回看还原。
                        const relatedCasesMeta = buildRelatedCasesMeta(caseData.detailedCases);
                        const truncationNotice = modelResult.truncated ? TRUNCATION_NOTICE : '';
                        const finalResponse = modelResult.content + truncationNotice + relatedCasesMeta;

                        if (modelResult.truncated) {
                            sendEvent('token', { content: truncationNotice });
                        }

                        await saveConversationMessage({
                            supabaseUrl,
                            serviceRoleKey,
                            sessionId,
                            userId,
                            type: 'assistant',
                            content: finalResponse,
                            metadata: {
                                apiProviderUsed: apiConfig.api_provider,
                                modelUsed: modelResult.modelUsed || apiConfig.model_name,
                                tokensUsed: modelResult.tokensUsed,
                                responseTime: modelResult.responseTime
                            }
                        });

                        sendEvent('done', {
                            tokensUsed: modelResult.tokensUsed,
                            responseTime: modelResult.responseTime,
                            caseCount: caseData.detailedCases.length,
                            apiProvider: apiConfig.api_provider,
                            model: modelResult.modelUsed || apiConfig.model_name,
                            relatedCases: caseData.detailedCases,
                            reasoningContent: modelResult.reasoningContent || ''
                        });
                    } catch (error: any) {
                        console.error('流式响应错误:', error);
                        sendEvent('error', {
                            message: error?.message || 'AI对话失败，请稍后再试'
                        });
                    } finally {
                        controller.close();
                    }
                }
            }), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            });
        }

        const caseData = await caseContextPromise;
        if (caseData.systemPromptAddon) {
            systemPrompt += caseData.systemPromptAddon;
        }

        const modelResult = await callModel(providerType, apiConfig, systemPrompt, message, validEnableThinking, managedHistory);
        // 同流式分支：案例不再拼进正文，只作为隐藏元数据随消息落库
        const relatedCasesMeta = buildRelatedCasesMeta(caseData.detailedCases);
        const truncationNotice = modelResult.truncated ? TRUNCATION_NOTICE : '';
        const finalResponse = modelResult.content + truncationNotice + relatedCasesMeta;

        await saveConversationMessage({
            supabaseUrl,
            serviceRoleKey,
            sessionId,
            userId,
            type: 'assistant',
            content: finalResponse,
            metadata: {
                apiProviderUsed: apiConfig.api_provider,
                modelUsed: modelResult.modelUsed || apiConfig.model_name,
                tokensUsed: modelResult.tokensUsed,
                responseTime: modelResult.responseTime
            }
        });

        return new Response(JSON.stringify({
            data: {
                message: finalResponse,
                sessionId,
                tokensUsed: modelResult.tokensUsed,
                responseTime: modelResult.responseTime,
                apiProvider: apiConfig.api_provider,
                model: modelResult.modelUsed || apiConfig.model_name,
                relatedCases: caseData.detailedCases,
                caseCount: caseData.detailedCases.length,
                reasoningContent: modelResult.reasoningContent || ''
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('AI对话处理错误:', error);
        console.error('错误堆栈:', error.stack);

        const errorResponse = {
            error: {
                code: 'AI_CHAT_FAILED',
                message: error.message,
                details: error.stack
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
