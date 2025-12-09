import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, userId, isActive } = await req.json();

    // 获取所有用户列表
    if (action === 'list') {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('获取用户列表失败:', error);
        return new Response(JSON.stringify({
          error: { code: 'QUERY_FAILED', message: '获取用户列表失败' }
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 获取每个用户的对话统计
      const usersWithStats = await Promise.all(users.map(async (user: any) => {
        const { data: conversations } = await supabase
          .from('conversations')
          .select('id', { count: 'exact' })
          .eq('user_id', user.id);

        return {
          ...user,
          conversation_count: conversations?.length || 0
        };
      }));

      return new Response(JSON.stringify({
        data: { users: usersWithStats }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 更新用户状态（启用/禁用）
    if (action === 'toggle_status') {
      if (!userId) {
        return new Response(JSON.stringify({
          error: { code: 'MISSING_USER_ID', message: '缺少用户 ID' }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabase
        .from('users')
        .update({ is_active: isActive })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('更新用户状态失败:', error);
        return new Response(JSON.stringify({
          error: { code: 'UPDATE_FAILED', message: '更新用户状态失败' }
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        data: { user: data, message: '用户状态已更新' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 删除用户
    if (action === 'delete') {
      if (!userId) {
        return new Response(JSON.stringify({
          error: { code: 'MISSING_USER_ID', message: '缺少用户 ID' }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 删除用户（会话会通过外键级联删除）
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) {
        console.error('删除用户失败:', error);
        return new Response(JSON.stringify({
          error: { code: 'DELETE_FAILED', message: '删除用户失败' }
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        data: { message: '用户已删除' }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 获取用户详情（包含对话记录）
    if (action === 'detail') {
      if (!userId) {
        return new Response(JSON.stringify({
          error: { code: 'MISSING_USER_ID', message: '缺少用户 ID' }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 获取用户信息
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return new Response(JSON.stringify({
          error: { code: 'USER_NOT_FOUND', message: '用户不存在' }
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 获取用户的对话记录
      const { data: conversations } = await supabase
        .from('conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({
        data: {
          user,
          conversations: conversations || [],
          conversation_count: conversations?.length || 0
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      error: { code: 'INVALID_ACTION', message: '无效的操作类型' }
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('管理用户错误:', error);
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
