// 德理法律案例检索 API 配置
const DELI_APPID = 'qHMfAfNYjhYHaajh';
const DELI_SECRET = '0658DEC258D54A6BBE9190BB404E6206';
const DELI_API_BASE = 'https://openapi.delilegal.com';

// 全局缓存 access_token
let cachedToken: { token: string; expireTime: number } | null = null;

// 获取德理 API access_token
async function getDeliAccessToken(): Promise<string> {
    // 检查缓存
    if (cachedToken && cachedToken.expireTime > Date.now()) {
        return cachedToken.token;
    }

    const tokenUrl = `${DELI_API_BASE}/oauth/authorize?appid=${DELI_APPID}&secret=${DELI_SECRET}&grant_type=client_credential`;
    const response = await fetch(tokenUrl, { method: 'GET' });
    
    if (!response.ok) {
        throw new Error('获取德理API token失败');
    }

    const data = await response.json();
    // 注意：accessToken 在响应数据的 body 字段中
    const token = data.body?.accessToken;
    
    if (!token) {
        console.error('德理API响应数据:', data);
        console.error('期望在 data.body.accessToken 中找到 token');
        throw new Error('获取德理API token失败: 响应格式错误');
    }
    
    console.log('德理API token 获取成功');
    
    // 缓存 token（假设有效期 2 小时）
    cachedToken = {
        token,
        expireTime: Date.now() + 2 * 60 * 60 * 1000
    };

    return token;
}

// 搜索相关案例
async function searchCases(keyword: string, token: string, pageSize: number = 3) {
    const searchUrl = `${DELI_API_BASE}/api/qa/v2/search/queryListCase`;
    
    // 将关键词字符串分割成数组（如果包含空格）
    const keywordArr = keyword.includes(' ') 
        ? keyword.split(' ').filter(k => k.trim().length > 0)
        : [keyword];
    
    console.log('搜索关键词数组:', keywordArr);
    
    const response = await fetch(searchUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        },
        body: JSON.stringify({
            pageNo: 1,
            pageSize,
            sortField: 'correlation',
            sortOrder: 'desc',
            condition: {
                keywordArr: keywordArr
            }
        })
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('案例搜索失败:', response.status, errorText);
        return null;
    }

    const result = await response.json();
    console.log('案例搜索响应:', { success: result.success, code: result.code, dataCount: result.body?.data?.length });
    
    // 响应数据在 body 字段中
    if (!result.body) {
        console.error('响应中没有 body 字段:', result);
        return null;
    }
    
    return result.body;
}

// 获取案例详情
async function getCaseDetail(caseId: string, token: string) {
    const detailUrl = `${DELI_API_BASE}/api/qa/v2/search/caseInfo?caseId=${caseId}`;
    const response = await fetch(detailUrl, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('获取案例详情失败:', response.status, errorText);
        return null;
    }

    const result = await response.json();
    console.log('案例详情响应:', { success: result.success, code: result.code, hasBody: !!result.body });
    
    // 响应数据在 body 字段中，注意：详情数据直接在 body 中，不在 body.data 中
    if (!result.body) {
        console.error('响应中没有 body 字段:', result);
        return null;
    }
    
    // 返回包含 data 属性的对象以保持与搜索结果的一致性
    return { data: result.body };
}

interface CollectedCaseData {
    systemPromptAddon: string;
    detailedCases: any[];
}

interface CaseAppendix {
    appendText: string;
    caseCount: number;
}

interface ModelCallResult {
    content: string;
    tokensUsed: number;
    responseTime: number;
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

async function collectCaseContext(message: string, enableCaseSearch: boolean, caseCount: number = 1): Promise<CollectedCaseData> {
    let systemPromptAddon = '';
    const detailedCases: any[] = [];

    if (!enableCaseSearch) {
        return { systemPromptAddon, detailedCases };
    }

    try {
        const deliToken = await getDeliAccessToken();
        console.log('德理 API token 获取成功');

        let searchKeyword = message;
        if (message.length > 30) {
            const legalKeywords = [
                '合同', '协议', '违约', '解除', '终止', '履行', '订立', '效力',
                '侵权', '赔偿', '损害', '补偿', '过错', '责任',
                '离婚', '抚养', '抚养费', '探望', '继承', '遗产', '遗嘱', '赡养',
                '劳动', '工伤', '辞退', '解雇', '加班', '社保', '工资', '竞业',
                '房产', '房屋', '买卖', '租赁', '拆迁', '征收', '物业',
                '交通', '事故', '肇事', '车祸',
                '刑事', '犯罪', '盗窃', '诈骗', '故意', '过失', '缓刑', '假释',
                '诉讼', '起诉', '上诉', '再审', '执行', '仲裁', '调解', '和解',
                '纠纷', '争议', '判决', '裁定', '民事', '行政', '医疗', '土地'
            ];

            let extractedKeywords: string[] = [];
            for (const keyword of legalKeywords) {
                if (message.includes(keyword)) {
                    extractedKeywords.push(keyword);
                }
            }
            extractedKeywords = [...new Set(extractedKeywords)];

            if (extractedKeywords.length > 0) {
                searchKeyword = extractedKeywords.slice(0, 3).join(' ');
                console.log(`从问题中提取的法律关键词: ${searchKeyword}`);
            } else {
                let cleaned = message
                    .replace(/请问|咨询|想问|怎么办|如何|什么|哪些|能否|可以|应该|需要|想要|帮我|告诉|说明/g, '')
                    .replace(/我|你|他|她|它|们|的|了|吗|呢|啊|吧|呀/g, '')
                    .replace(/[，。！？；：、\s]+/g, ' ')
                    .trim();

                searchKeyword = cleaned.substring(0, 20).trim();

                if (searchKeyword.length < 5) {
                    searchKeyword = message.substring(0, 20).trim();
                }

                console.log(`文本清洗后的关键词: ${searchKeyword}`);
            }
        }

        console.log(`最终搜索关键词: ${searchKeyword}`);

        const searchResult = await searchCases(searchKeyword, deliToken, caseCount);
        if (searchResult && searchResult.data && searchResult.data.length > 0) {
            console.log(`找到 ${searchResult.data.length} 个相关案例`);
            for (const caseItem of searchResult.data) {
                try {
                    const caseDetail = await getCaseDetail(caseItem.id, deliToken);
                    if (caseDetail && caseDetail.data) {
                        detailedCases.push({
                            ...caseItem,
                            detail: caseDetail.data
                        });
                    } else {
                        detailedCases.push(caseItem);
                    }
                } catch (detailError) {
                    console.error(`获取案例详情失败 (${caseItem.id}):`, detailError);
                    detailedCases.push(caseItem);
                }
            }

            if (detailedCases.length > 0) {
                let casesContext = '\n\n### 相关法律案例参考：\n';
                for (let i = 0; i < detailedCases.length; i++) {
                    const caseItem = detailedCases[i];
                    casesContext += `\n**案例${i + 1}：${caseItem.title}**\n`;
                    casesContext += `- 案号：${caseItem.caseNumber}\n`;
                    casesContext += `- 法院：${caseItem.court}（${caseItem.levelOfTrial}）\n`;
                    casesContext += `- 案由：${caseItem.cause}\n`;
                    casesContext += `- 判决日期：${caseItem.judgementDate}\n`;

                    if (caseItem.detail) {
                        if (caseItem.detail.judgeInfo) {
                            casesContext += `- 审判人员：${caseItem.detail.judgeInfo}\n`;
                        }
                        if (caseItem.detail.content) {
                            casesContext += `- 案情要点：${caseItem.detail.content.substring(0, 300)}...\n`;
                        }
                    } else if (caseItem.content) {
                        casesContext += `- 案情摘要：${caseItem.content.substring(0, 200)}...\n`;
                    }
                }

                systemPromptAddon = '\n\n在回答时，请深入参考以下相关法律案例，分析其判决理由和法律适用，引用案例时请注明案号和法院：' + casesContext;
            }
        } else {
            console.log('未找到相关案例');
        }
    } catch (error) {
        console.error('案例检索失败:', error);
    }

    return { systemPromptAddon, detailedCases };
}

function buildCaseAppendix(detailedCases: any[], enableCaseSearch: boolean): CaseAppendix {
    let appendText = '';

    if (detailedCases.length > 0) {
        appendText += '\n\n---\n\n## 📚 相关法律案例参考\n\n';
        appendText += `> 为您检索到 ${detailedCases.length} 个高度相关的法律案例，供参考：\n\n`;

        for (let i = 0; i < detailedCases.length; i++) {
            const caseItem = detailedCases[i];
            appendText += `### 📋 案例 ${i + 1}\n\n**${caseItem.title}**\n\n`;
            appendText += `**📋 案件基本信息**\n\n`;
            appendText += `- **案号**：${caseItem.caseNumber}\n`;
            appendText += `- **法院**：${caseItem.court}\n`;
            appendText += `- **案件类型**：${caseItem.caseType || '民事案件'}\n`;
            appendText += `- **案由**：${caseItem.causeName || caseItem.cause}\n`;
            appendText += `- **文书类型**：${caseItem.judgementType}\n`;
            appendText += `- **判决日期**：${caseItem.judgementDate}\n`;
            appendText += `- **审理程序**：${caseItem.levelOfTrial || caseItem.levelOfTria}\n`;

            appendText += `\n**📖 案情详情**\n\n`;
            if (caseItem.detail && caseItem.detail.data && caseItem.detail.data.docResult) {
                const docResult = caseItem.detail.data.docResult;
                for (let j = 0; j < docResult.length; j++) {
                    const section = docResult[j];
                    if (section.label && section.text) {
                        appendText += ` **${section.label}:**\n\n`;
                        let cleanText = section.text.trim()
                            .replace(/<em>/g, '')
                            .replace(/<\/em>/g, '')
                            .replace(/<strong>/g, '**')
                            .replace(/<\/strong>/g, '**')
                            .replace(/<[^>]+>/g, '');
                        const formattedText = cleanText.replace(/\n/g, '  \n');
                        appendText += `${formattedText}\n\n`;
                        if (j < docResult.length - 1) {
                            appendText += `---\n\n`;
                        }
                    }
                }
            } else if (caseItem.content) {
                let cleanContent = caseItem.content.trim()
                    .replace(/<em>/g, '')
                    .replace(/<\/em>/g, '')
                    .replace(/<strong>/g, '**')
                    .replace(/<\/strong>/g, '**')
                    .replace(/<[^>]+>/g, '');
                const formattedContent = cleanContent.replace(/\n/g, '  \n');
                appendText += `${formattedContent}\n`;
            }

            if (caseItem.detail && caseItem.detail.data && caseItem.detail.data.timelineNodes && caseItem.detail.data.timelineNodes.length > 0) {
                appendText += `\n**⏱️ 审理时间轴**\n\n`;
                for (const timeNode of caseItem.detail.data.timelineNodes.slice(0, 3)) {
                    appendText += `- ${timeNode.date || timeNode.time}：${timeNode.event || timeNode.description}\n`;
                }
            }

            if (i < detailedCases.length - 1) {
                appendText += `\n---\n\n`;
            } else {
                appendText += `\n`;
            }
        }

        appendText += `\n> 💡 **法律提示**：以上案例由法律案例库提供，仅供学习参考。每个案件具有特殊性，具体法律问题请咨询专业律师或法律机构，以获得针对性的法律意见。\n`;
    } else if (!enableCaseSearch) {
        appendText += `\n\n\n\n💡 如果您需要相似案情的案件信息，请启用输入框旁的"类案检索"。`;
    }

    return { appendText, caseCount: detailedCases.length };
}

async function callModel(
    providerType: string,
    apiConfig: any,
    systemPrompt: string,
    message: string
): Promise<ModelCallResult> {
    const startTime = Date.now();

    if (providerType === 'deepseek') {
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
        const { max_tokens: dsMaxTokens, temperature: dsTemperature, stream: dsStream, ...deepseekRest } = parameters;

        const deepseekResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiConfig.api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: apiConfig.model_name || 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                temperature: dsTemperature ?? 1.3,
                max_tokens: dsMaxTokens ?? 1000,
                stream: dsStream ?? false,
                ...deepseekRest
            })
        });

        if (!deepseekResponse.ok) {
            const errorText = await deepseekResponse.text();
            throw new Error(`DeepSeek API调用失败: ${errorText}`);
        }

        const deepseekData = await deepseekResponse.json();
        const content = deepseekData.choices?.[0]?.message?.content || deepseekData.output_text || '';
        const tokensUsed = deepseekData.usage?.total_tokens || deepseekData.usage?.output_tokens || 0;
        return {
            content,
            tokensUsed,
            responseTime: Date.now() - startTime
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

    const aliyunResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiConfig.api_key}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: apiConfig.model_name || 'qwen-turbo',
            input: {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]
            },
            parameters: {
                max_tokens: qwenMaxTokens ?? 1000,
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
        responseTime: Date.now() - startTime
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
    onToken: (chunk: string) => void;
}

async function streamModelResponse(options: StreamModelOptions): Promise<ModelCallResult> {
    const { providerType, apiConfig, systemPrompt, message, onToken } = options;
    const startTime = Date.now();
    let tokensUsed = 0;
    let accumulatedContent = '';

    const fallbackReturn = (content: string, usage?: any) => {
        if (content) {
            onToken(content);
        }
        const totalTokens = usage?.total_tokens || usage?.output_tokens || 0;
        return {
            content,
            tokensUsed: totalTokens,
            responseTime: Date.now() - startTime
        };
    };

    if (providerType === 'deepseek') {
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
        const { max_tokens: dsMaxTokens, temperature: dsTemperature, ...deepseekRest } = parameters;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiConfig.api_key}`,
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: JSON.stringify({
                model: apiConfig.model_name || 'deepseek-chat',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                temperature: dsTemperature ?? 1.3,
                max_tokens: dsMaxTokens ?? 1000,
                stream: true,
                ...deepseekRest
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API调用失败: ${errorText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/event-stream')) {
            const payload = await response.json();
            const content = payload.choices?.[0]?.message?.content || payload.output_text || '';
            return fallbackReturn(content, payload.usage);
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

            if (payload.usage?.total_tokens) {
                tokensUsed = payload.usage.total_tokens;
            }
        });

        return {
            content: accumulatedContent,
            tokensUsed,
            responseTime: Date.now() - startTime
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
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ]
            },
            parameters: {
                max_tokens: qwenMaxTokens ?? 1000,
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
        tokensUsed,
        responseTime: Date.now() - startTime
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
        const { message, sessionId, userId, enableCaseSearch = true, provider: preferredProvider, stream = false, caseCount = 1 } = await req.json();

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

        let systemPrompt = "你是由吉林大学法学院与吉林大学计算机科学与技术学院联合开发的法律知识助手，致力于解答法律问题。请以聪明、友好而又可爱的方式回答用户的问题";
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

        const providerType = normalizeProvider(apiConfig.api_provider) || 'qwen';
        const caseContextPromise = collectCaseContext(message, enableCaseSearch, validCaseCount);

        if (streamRequested) {
            return new Response(new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    const sendEvent = (event: string, payload: any) => {
                        controller.enqueue(encoder.encode(`event:${event}\ndata:${JSON.stringify(payload)}\n\n`));
                    };

                    try {
                        const modelResult = await streamModelResponse({
                            providerType,
                            apiConfig,
                            systemPrompt,
                            message,
                            onToken: (chunk) => {
                                if (chunk) {
                                    sendEvent('token', { content: chunk });
                                }
                            }
                        });

                        const caseData = await caseContextPromise;
                        const caseAppendix = buildCaseAppendix(caseData.detailedCases, enableCaseSearch);

                        if (enableCaseSearch && caseAppendix.appendText) {
                            sendEvent('case-status', { status: 'searching', message: '正在为您检索相似案例' });
                            for (const chunk of chunkTextForStream(caseAppendix.appendText)) {
                                if (chunk) {
                                    sendEvent('token', { content: chunk });
                                }
                            }
                            sendEvent('case-status', { status: 'completed' });
                        } else if (caseAppendix.appendText) {
                            for (const chunk of chunkTextForStream(caseAppendix.appendText)) {
                                if (chunk) {
                                    sendEvent('token', { content: chunk });
                                }
                            }
                        }

                        const finalResponse = modelResult.content + caseAppendix.appendText;

                        await saveConversationMessage({
                            supabaseUrl,
                            serviceRoleKey,
                            sessionId,
                            userId,
                            type: 'assistant',
                            content: finalResponse,
                            metadata: {
                                apiProviderUsed: apiConfig.api_provider,
                                modelUsed: apiConfig.model_name,
                                tokensUsed: modelResult.tokensUsed,
                                responseTime: modelResult.responseTime
                            }
                        });

                        sendEvent('done', {
                            tokensUsed: modelResult.tokensUsed,
                            responseTime: modelResult.responseTime,
                            caseCount: caseAppendix.caseCount,
                            apiProvider: apiConfig.api_provider,
                            model: apiConfig.model_name,
                            relatedCases: caseData.detailedCases
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

        const modelResult = await callModel(providerType, apiConfig, systemPrompt, message);
        const caseAppendix = buildCaseAppendix(caseData.detailedCases, enableCaseSearch);
        const finalResponse = modelResult.content + caseAppendix.appendText;

        await saveConversationMessage({
            supabaseUrl,
            serviceRoleKey,
            sessionId,
            userId,
            type: 'assistant',
            content: finalResponse,
            metadata: {
                apiProviderUsed: apiConfig.api_provider,
                modelUsed: apiConfig.model_name,
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
                model: apiConfig.model_name,
                relatedCases: caseData.detailedCases,
                caseCount: caseAppendix.caseCount
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