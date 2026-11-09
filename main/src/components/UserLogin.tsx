import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

type Mode = 'login' | 'register';

interface FieldErrors {
  email?: string;
  password?: string;
  username?: string;
}

const UserLogin: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const { login, register } = useUser();
  const navigate = useNavigate();

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
  };

  // 每个错误挂在自己的字段下，而不是一条飘过去的提示
  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = '请输入邮箱';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = '邮箱格式不正确';
    if (!password) next.password = '请输入密码';
    else if (mode === 'register' && password.length < 6) next.password = '密码至少 6 位';
    if (mode === 'register' && !username.trim()) next.username = '请输入用户名';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
        toast.success('登录成功');
        navigate('/');
      } else {
        await register(email.trim(), password, username.trim(), fullName.trim() || undefined);
        toast.success('注册成功');
        navigate('/');
      }
    } catch (error: any) {
      const message = error.message || (mode === 'login' ? '登录失败' : '注册失败');
      // 把服务端的账号类错误落到密码字段下
      if (/密码|password|凭证|认证/i.test(message)) {
        setErrors({ password: message });
      } else if (/邮箱|email|已存在|注册/i.test(message)) {
        setErrors({ email: message });
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase =
    'w-full h-11 pl-10 pr-4 text-[14px] bg-card border rounded-[2px] transition-colors focus:outline-none focus:ring-2 placeholder:text-ink-3';

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      {/* ---- 左：入口说明与卡片目录的装订边 ---- */}
      <div className="hidden lg:flex w-[46%] max-w-[620px] shrink-0 flex-col justify-between border-r border-rule bg-paper-deep px-12 py-10">
        <div>
          <div className="flex items-center gap-3">
            <img
              src="/logo_background.png"
              alt="吉林大学法学院院徽"
              className="w-11 h-11 object-contain"
            />
            <div>
              <div className="text-[15px] font-semibold tracking-tight leading-tight">
                法律知识助手
              </div>
              <div className="entry-line mt-0.5">模拟法庭智能检索</div>
            </div>
          </div>

          <div className="mt-5 border-t border-rule pt-3 text-center">
            <div className="text-[12px] leading-relaxed text-ink-2 tracking-[0.02em]">
              吉林大学法学院
            </div>
            <div className="my-1 text-[13px] leading-none text-ink-3">×</div>
            <div className="text-[12px] leading-relaxed text-ink-2 tracking-[0.02em]">
              吉林大学计算机科学与技术学院
            </div>
            <div className="entry-line mt-1.5">联合提供技术支持</div>
          </div>
        </div>

        <div className="max-w-[30ch]">
          <h1 className="serif text-[34px] leading-[1.25] tracking-tight">
            把案卷、法条与判例
            <br />
            放在同一张桌上。
          </h1>
          <p className="mt-5 text-[14px] leading-[1.8] text-ink-2">
            提问、检索类案、查阅成文法原文，导出文书。所有条目按会话登记，随时可以回到某一条重新对照。
          </p>

          <dl className="mt-8 border-t border-rule">
            {[
              ['问答', 'DeepSeek-V4.1-Flash 模型'],
              ['类案', '按案号、法院、案由检索已裁判案例'],
              ['法条', '宪法至社会法，逐章原文'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4 py-3 border-b border-rule">
                <dt className="field-label w-10 shrink-0 pt-0.5">{k}</dt>
                <dd className="text-[13px] leading-relaxed text-ink-2">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="entry-line">
          模拟法庭智能检索
          <span className="sep">·</span>
          长春
        </div>
      </div>

      {/* ---- 右：表单 ---- */}
      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.2, 0.7, 0.3, 1] }}
          className="w-full max-w-[400px]"
        >
          {/* 小屏品牌 */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <img src="/logo_background.png" alt="吉林大学法学院院徽" className="w-10 h-10 object-contain" />
            <div>
              <div className="text-[15px] font-semibold tracking-tight">法律知识助手</div>
              <div className="entry-line mt-0.5">吉林大学法学院</div>
            </div>
          </div>

          <div className="border border-rule-strong bg-card">
            {/* 卡头 */}
            <div className="px-6 pt-6 pb-4 border-b border-rule">
              <div className="entry-line mb-2">
                账户
                <span className="sep">·</span>
                {mode === 'login' ? '登录' : '注册'}
              </div>
              <h2 className="text-[20px] font-semibold tracking-tight leading-tight">
                {mode === 'login' ? '回到你的检索桌' : '建立一个新的账户'}
              </h2>
            </div>

            {/* 模式切换 */}
            <div className="px-6 pt-5">
              <div
                role="tablist"
                aria-label="登录或注册"
                className="grid grid-cols-2 border border-rule rounded-[2px] p-px"
              >
                {([
                  { id: 'login' as Mode, label: '登录' },
                  { id: 'register' as Mode, label: '注册' },
                ]).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={mode === tab.id}
                    onClick={() => switchMode(tab.id)}
                    className={`h-9 text-[13px] font-medium rounded-[1px] transition-colors ${
                      mode === tab.id
                        ? 'bg-action text-action-ink'
                        : 'text-ink-2 hover:bg-card-2'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="px-6 py-5 space-y-4">
              {/* 邮箱 */}
              <div>
                <label htmlFor="email" className="field-label block mb-1.5">
                  邮箱
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: undefined });
                    }}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    autoComplete="email"
                    className={`${inputBase} ${
                      errors.email
                        ? 'border-seal focus:border-seal focus:ring-seal/20'
                        : 'border-rule-strong focus:border-action focus:ring-action/20'
                    }`}
                    placeholder="your@email.com"
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p id="email-error" className="mt-1.5 flex items-start gap-1.5 text-[12px] text-seal-ink">
                    <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* 用户名 / 姓名（注册） */}
              {mode === 'register' && (
                <>
                  <div>
                    <label htmlFor="username" className="field-label block mb-1.5">
                      用户名
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value);
                          if (errors.username) setErrors({ ...errors, username: undefined });
                        }}
                        aria-invalid={Boolean(errors.username)}
                        aria-describedby={errors.username ? 'username-error' : undefined}
                        autoComplete="username"
                        className={`${inputBase} ${
                          errors.username
                            ? 'border-seal focus:border-seal focus:ring-seal/20'
                            : 'border-rule-strong focus:border-action focus:ring-action/20'
                        }`}
                        placeholder="用于目录与导出"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.username && (
                      <p id="username-error" className="mt-1.5 flex items-start gap-1.5 text-[12px] text-seal-ink">
                        <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
                        {errors.username}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="fullName" className="field-label block mb-1.5">
                      姓名 <span className="text-ink-3 font-normal">（可选）</span>
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        autoComplete="name"
                        className={`${inputBase} border-rule-strong focus:border-action focus:ring-action/20`}
                        placeholder="真实姓名"
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 密码 */}
              <div>
                <label htmlFor="password" className="field-label block mb-1.5">
                  密码
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: undefined });
                    }}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className={`${inputBase} !pr-11 ${
                      errors.password
                        ? 'border-seal focus:border-seal focus:ring-seal/20'
                        : 'border-rule-strong focus:border-action focus:ring-action/20'
                    }`}
                    placeholder={mode === 'login' ? '输入密码' : '至少 6 位'}
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-quiet btn-icon h-8 w-8"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <p id="password-error" className="mt-1.5 flex items-start gap-1.5 text-[12px] text-seal-ink">
                    <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />
                    {errors.password}
                  </p>
                ) : mode === 'register' ? (
                  <p className="mt-1.5 entry-line">密码长度至少 6 位</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn btn-primary w-full h-11 mt-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {mode === 'login' ? '正在登录…' : '正在注册…'}
                  </>
                ) : (
                  <>
                    {mode === 'login' ? '登录' : '注册并进入'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="px-6 py-3 border-t border-rule bg-card-2 flex items-center justify-between">
              <span className="entry-line">吉林大学法学院</span>
              <button
                type="button"
                onClick={() => navigate('/admin/login')}
                className="text-[12px] text-ink-3 hover:text-action transition-colors"
              >
                管理员入口
              </button>
            </div>
          </div>

          <p className="mt-4 text-[12px] leading-relaxed text-ink-3 text-center">
            账户仅用于保存你的检索记录。
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default UserLogin;
