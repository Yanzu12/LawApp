import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { userId, sessionId, limit = 50 } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({
        error: { code: 'MISSING_USER_ID', message: '缺少用户 ID' }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 如果提供了 sessionId，获取特定会话的历史
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    query = query.limit(limit);

    const { data: conversations, error } = await query;

    if (error) {
      console.error('获取对话历史失败:', error);
      return new Response(JSON.stringify({
        error: { code: 'QUERY_FAILED', message: '获取对话历史失败' }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 返回对话历史
    return new Response(JSON.stringify({
      data: {
        conversations: conversations || []
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('获取对话历史错误:', error);
    return new Response(JSON.stringify({
      error: {
        code: 'SERVER_ERROR',
        message: error.message || '服务器错误'
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
