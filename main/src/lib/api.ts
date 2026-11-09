import { supabase } from './supabase';

const SUPABASE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

type StreamEventHandler = {
  onToken?: (chunk: string) => void;
  onThinkingToken?: (chunk: string) => void;
  onRelatedCases?: (cases: any[]) => void;
  onCaseStatus?: (payload: { status: string; message?: string }) => void;
  onDone?: (payload: {
    tokensUsed?: number;
    responseTime?: number;
    caseCount?: number;
    apiProvider?: string;
    model?: string;
    relatedCases?: any[];
    reasoningContent?: string;
  }) => void;
  onError?: (message: string) => void;
};

interface StreamParams {
  message: string;
  sessionId: string;
  userId?: string;
  enableCaseSearch?: boolean;
  enableThinking?: boolean;
  provider?: string;
  caseCount?: number;
}

export const sendChatMessageStream = async (
  params: StreamParams,
  handlers: StreamEventHandler
) => {
  const controller = new AbortController();

  try {
    const response = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        message: params.message,
        sessionId: params.sessionId,
        userId: params.userId,
        enableCaseSearch: params.enableCaseSearch ?? true,
        enableThinking: params.enableThinking ?? false,
        provider: params.provider,
        caseCount: params.caseCount ?? 1,
        stream: true
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'AI服务请求失败');
    }

    if (!response.body) {
      throw new Error('AI服务没有返回可读取的响应体');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const processEvent = (rawEvent: string) => {
      const lines = rawEvent.split('\n');
      let eventType = 'message';
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventType = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }

      if (dataLines.length === 0) return;

      const dataRaw = dataLines.join('\n');
      if (!dataRaw) return;

      let payload: any;
      try {
        payload = JSON.parse(dataRaw);
      } catch (error) {
        console.error('解析流事件失败:', error, dataRaw);
        return;
      }

      switch (eventType) {
        case 'token':
          if (payload?.content) {
            handlers.onToken?.(payload.content);
          }
          break;
        case 'reasoning-token':
          if (payload?.content) {
            handlers.onThinkingToken?.(payload.content);
          }
          break;
        case 'related-cases':
          handlers.onRelatedCases?.(Array.isArray(payload?.cases) ? payload.cases : []);
          break;
        case 'case-status':
          if (payload?.status) {
            handlers.onCaseStatus?.(payload);
          }
          break;
        case 'done':
          handlers.onDone?.(payload || {});
          break;
        case 'error':
          handlers.onError?.(payload?.message || 'AI服务出现错误');
          break;
        default:
          break;
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        // 处理流结束时可能残留在缓冲区中的最后一个事件
        if (buffer.trim()) {
          processEvent(buffer.trim());
        }
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        if (rawEvent.trim()) {
          processEvent(rawEvent);
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('AI流式请求已取消');
      return;
    }
    console.error('AI流式调用错误:', error);
    handlers.onError?.(error?.message || 'AI服务调用失败');
    throw error;
  }

  return {
    cancel: () => controller.abort()
  };
};

// 管理员认证API
export const adminAuth = {
  login: async (username: string, password: string) => {
    const { data, error } = await supabase.functions.invoke('admin-auth', {
      body: { action: 'login', username, password }
    });
    if (error) throw error;
    return data;
  },
  
  create: async (username: string, password: string, email: string) => {
    const { data, error } = await supabase.functions.invoke('admin-auth', {
      body: { action: 'create', username, password, email }
    });
    if (error) throw error;
    return data;
  },
  
  verify: async (token: string) => {
    const { data, error } = await supabase.functions.invoke('admin-auth', {
      body: { action: 'verify' },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (error) throw error;
    return data;
  }
};
