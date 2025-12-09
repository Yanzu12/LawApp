const supabaseUrl = 'https://dbligsjxglessenqsewe.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRibGlnc2p4Z2xlc3NlbnFzZXdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwMjYwMTIsImV4cCI6MjA3NjYwMjAxMn0.GHi-18a0vX7hToQyh3nzBWDrFtbwnBggYIQEf_eAvJo';

// 管理员数据API
export const adminData = {
  getConversations: async (token: string, params?: any) => {
    const url = new URL(`${supabaseUrl}/functions/v1/admin-data/conversations`);
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key]) url.searchParams.append(key, params[key]);
      });
    }
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'x-admin-token': token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('对话记录API错误:', response.status, errorData);
      throw new Error(`获取对话记录失败: ${response.status} - ${errorData}`);
    }
    
    return await response.json();
  },
  
  getApiConfigs: async (token: string) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-data/api-configs`, {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'x-admin-token': token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('获取API配置失败');
    }
    
    return await response.json();
  },
  
  createApiConfig: async (token: string, config: any) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-data/api-configs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'x-admin-token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      throw new Error('创建API配置失败');
    }
    
    return await response.json();
  },
  
  getBasePrompts: async (token: string) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-data/base-prompts`, {
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'x-admin-token': token,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('获取基础提示词失败');
    }
    
    return await response.json();
  },
  
  createBasePrompt: async (token: string, prompt: any) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/admin-data/base-prompts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
        'x-admin-token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prompt)
    });
    
    if (!response.ok) {
      throw new Error('创建基础提示词失败');
    }
    
    return await response.json();
  }
};