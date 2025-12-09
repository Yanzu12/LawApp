import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 密码哈希函数（使用 Web Crypto API）
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 验证密码
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action, email, password, username, fullName } = await req.json();

    if (action === 'register') {
      // 用户注册
      console.log('注册请求:', { email, username });

      // 验证必填字段
      if (!email || !password || !username) {
        return new Response(JSON.stringify({
          error: { code: 'INVALID_INPUT', message: '邮箱、密码和用户名为必填项' }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 验证密码长度
      if (password.length < 6) {
        return new Response(JSON.stringify({
          error: { code: 'WEAK_PASSWORD', message: '密码长度至少为 6 位' }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 检查邮箱是否已存在
      const { data: existingEmail } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .single();

      if (existingEmail) {
        return new Response(JSON.stringify({
          error: { code: 'EMAIL_EXISTS', message: '该邮箱已被注册' }
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 检查用户名是否已存在
      const { data: existingUsername } = await supabase
        .from('users')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUsername) {
        return new Response(JSON.stringify({
          error: { code: 'USERNAME_EXISTS', message: '该用户名已被使用' }
        }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 创建用户
      const passwordHash = await hashPassword(password);
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email,
          password_hash: passwordHash,
          username,
          full_name: fullName || username
        })
        .select()
        .single();

      if (insertError) {
        console.error('创建用户失败:', insertError);
        return new Response(JSON.stringify({
          error: { code: 'REGISTER_FAILED', message: '注册失败，请稍后重试' }
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            username: newUser.username,
            fullName: newUser.full_name
          },
          message: '注册成功'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'login') {
      // 用户登录
      console.log('登录请求:', { email });

      if (!email || !password) {
        return new Response(JSON.stringify({
          error: { code: 'INVALID_INPUT', message: '邮箱和密码为必填项' }
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 查找用户
      const { data: user, error: queryError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (queryError || !user) {
        return new Response(JSON.stringify({
          error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' }
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 验证密码
      const isValidPassword = await verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return new Response(JSON.stringify({
          error: { code: 'INVALID_CREDENTIALS', message: '邮箱或密码错误' }
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 检查账户状态
      if (!user.is_active) {
        return new Response(JSON.stringify({
          error: { code: 'ACCOUNT_DISABLED', message: '账户已被禁用' }
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // 更新最后登录时间
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      return new Response(JSON.stringify({
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            fullName: user.full_name,
            avatarUrl: user.avatar_url
          },
          message: '登录成功'
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response(JSON.stringify({
        error: { code: 'INVALID_ACTION', message: '无效的操作类型' }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error: any) {
    console.error('用户认证错误:', error);
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
