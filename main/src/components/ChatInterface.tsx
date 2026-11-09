import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Send,
  Loader2,
  Paperclip,
  X,
  FileText,
  LogOut,
  History,
  SlidersHorizontal,
  Download,
  Search,
  Sun,
  Moon,
  ChevronDown,
  CornerDownLeft,
  Cpu,
  Scale,
  PanelLeft,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeMarkdownTables } from '../lib/markdown';
import { sendChatMessageStream } from '../lib/api';
import { readDocumentFile, validateDocumentFile, formatFileSize } from '../lib/documentReader';
import { exportCaseToWord } from '../lib/exportCase';
import { useUser } from '../contexts/UserContext';
import toast from 'react-hot-toast';
import LawLibrary from './LawLibrary';
import { useTheme } from '../contexts/ThemeContext';

interface CaseData {
  title: string;
  caseNumber: string;
  court: string;
  caseType?: string;
  causeName?: string;
  cause?: string;
  judgementType: string;
  judgementDate: string;
  levelOfTrial: string;
  content?: string;
  detail?: any;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  thinkingContent?: string;
  thinkingEnabled?: boolean;
  timestamp: Date;
  streaming?: boolean;
  caseStatus?: string | null;
  relatedCases?: CaseData[];
}

const PROVIDER_LABEL: Record<'Qwen' | 'DeepSeek', string> = {
  Qwen: '通义法睿-Plus',
  DeepSeek: 'DeepSeek-V4.1-Flash',
};

const pad2 = (n: number) => String(n).padStart(2, '0');

/* 开关：36×18 轨道，胶囊只在轨道上使用；滑块用显式 left 定位，
   避免绝对定位元素落在静态（居中）位置上导致滑块溢出轨道。 */
const Switch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}> = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    disabled={disabled}
    className={`relative shrink-0 w-9 h-[18px] rounded-full border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
      checked ? 'bg-action border-action' : 'bg-paper-deep border-rule-strong'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform duration-150 ${
        checked ? 'translate-x-[18px] bg-card' : 'translate-x-0 bg-card'
      }`}
    />
  </button>
);

const ChatInterface: React.FC = () => {
  const { user, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enableCaseSearch, setEnableCaseSearch] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [justLoadedHistory, setJustLoadedHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'Qwen' | 'DeepSeek'>('DeepSeek');
  const [enableThinking, setEnableThinking] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [caseCount, setCaseCount] = useState(1);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const advancedOptionsRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!showAdvancedOptions) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!advancedOptionsRef.current) return;
      if (!advancedOptionsRef.current.contains(event.target as Node)) {
        setShowAdvancedOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAdvancedOptions]);

  useEffect(() => {
    if (selectedProvider !== 'DeepSeek' && enableThinking) {
      setEnableThinking(false);
    }
  }, [selectedProvider, enableThinking]);

  useEffect(() => {
    if (!showHistoryMenu && !showSearchDialog) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!historyMenuRef.current) return;
      if (!historyMenuRef.current.contains(event.target as Node)) {
        setShowHistoryMenu(false);
        setShowSearchDialog(false);
        setSearchKeyword('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showHistoryMenu, showSearchDialog]);

  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!userMenuRef.current) return;
      if (!userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Esc 关闭所有浮层
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setShowAdvancedOptions(false);
      setShowHistoryMenu(false);
      setShowSearchDialog(false);
      setShowUserMenu(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // 初始化欢迎消息
  useEffect(() => {
    setSelectedProvider('DeepSeek');
    setEnableThinking(false);
    if (user) {
      setHistoryLoaded(false);
      setJustLoadedHistory(false);
      setMessages([{
        id: 'welcome-user',
        type: 'assistant',
        content: `你好，${user.username}！我是吉林大学法学院旗下的法律知识助手，我能为您的法律问题提供专业的回复，您有什么想问我的吗？`,
        timestamp: new Date()
      }]);
    } else {
      setHistoryLoaded(false);
      setJustLoadedHistory(false);
      setMessages([{
        id: 'welcome-guest',
        type: 'assistant',
        content: '你好！我是吉林大学法学院旗下的法律知识助手，我能为您的法律问题提供专业的回复，您有什么想问我的吗？',
        timestamp: new Date()
      }]);
    }
  }, [user]);

  const loadConversationHistory = async () => {
    if (!user) return;

    setIsLoadingHistory(true);
    try {
      // 不传递 sessionId，加载用户的最近对话记录
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/user-conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ userId: user.id, limit: 100 })
      });

      if (response.ok) {
        const result = await response.json();
        const conversations = result.data.conversations || [];

        if (conversations.length > 0) {
          const parseField = (block: string, fieldLabel: string): string => {
            const regex = new RegExp(`-\\s*\\*\\*${fieldLabel}\\*\\*：(.+)`);
            const match = block.match(regex);
            return match?.[1]?.trim() || '';
          };

          const parseStoredAssistantMessage = (rawContent: string): { content: string; relatedCases: CaseData[] } => {
            if (!rawContent) {
              return { content: '', relatedCases: [] };
            }

            // 新格式：案例数据以隐藏注释随消息落库，正文保持模型原始输出
            const metaMatch = rawContent.match(/<!--RELATED_CASES:([\s\S]*?)-->\s*$/);
            if (metaMatch) {
              let cases: CaseData[] = [];
              try {
                const parsedJson = JSON.parse(metaMatch[1]);
                if (Array.isArray(parsedJson)) {
                  cases = parsedJson as CaseData[];
                }
              } catch (error) {
                console.error('解析历史案例数据失败:', error);
              }
              return {
                content: rawContent.slice(0, metaMatch.index).trimEnd(),
                relatedCases: cases
              };
            }

            // 旧格式兼容：历史消息里曾把案例附录直接拼接在正文末尾
            const marker = '## 📚 相关法律案例参考';
            const markerIndex = rawContent.indexOf(marker);

            if (markerIndex === -1) {
              return { content: rawContent, relatedCases: [] };
            }

            const mainContent = rawContent.slice(0, markerIndex).trimEnd();
            const appendixContent = rawContent.slice(markerIndex);
            const caseBlocks = appendixContent.split(/###\s+📋\s+案例\s+\d+/g).slice(1);

            const parsedCases: CaseData[] = caseBlocks.map((block, index) => {
              const titleMatch = block.match(/\*\*([^*\n]+)\*\*/);
              const detailMatch = block.match(/\*\*📖\s*案情详情\*\*\s*([\s\S]*?)(?:\n\*\*⏱️\s*审理时间轴\*\*|\n---|\n>\s*💡|$)/);
              const cleanedDetail = (detailMatch?.[1] || '')
                .replace(/\*\*/g, '')
                .replace(/^[-\s]+/gm, '')
                .trim();

              return {
                title: titleMatch?.[1]?.trim() || `案例 ${index + 1}`,
                caseNumber: parseField(block, '案号') || `HISTORY-${index + 1}`,
                court: parseField(block, '法院') || '未知法院',
                caseType: parseField(block, '案件类型') || '民事案件',
                cause: parseField(block, '案由') || '-',
                judgementType: parseField(block, '文书类型') || '判决书',
                judgementDate: parseField(block, '判决日期') || '-',
                levelOfTrial: parseField(block, '审理程序') || '-',
                content: cleanedDetail || undefined
              };
            }).filter(item => item.title && item.caseNumber);

            return {
              content: mainContent,
              relatedCases: parsedCases
            };
          };

          const loadedMessages: Message[] = conversations.map((conv: any) => {
            if (conv.message_type === 'assistant') {
              const parsed = parseStoredAssistantMessage(conv.message_content);
              return {
                id: conv.id.toString(),
                type: conv.message_type,
                content: parsed.content,
                relatedCases: parsed.relatedCases,
                timestamp: new Date(conv.created_at)
              } as Message;
            }
            return {
              id: conv.id.toString(),
              type: conv.message_type,
              content: conv.message_content,
              timestamp: new Date(conv.created_at)
            } as Message;
          });
          setJustLoadedHistory(true);
          setMessages(loadedMessages);
          // 3秒后重置标记，允许新消息立即显示
          setTimeout(() => setJustLoadedHistory(false), 3000);
          setHistoryLoaded(true);
        } else {
          // 如果没有历史对话，显示欢迎消息
          setMessages([{
            id: '1',
            type: 'assistant',
            content: `你好，${user.username}！我是吉林大学法学院旗下的法律知识助手，我能为您的法律问题提供专业的回复，您有什么想问我的吗？`,
            timestamp: new Date()
          }]);
          setHistoryLoaded(true);
        }
      }
    } catch (error) {
      console.error('加载对话历史失败:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLoadHistoryClick = () => {
    if (!user || isLoadingHistory) return;
    setShowHistoryMenu(false);
    loadConversationHistory();
  };

  const handleSearchHistory = () => {
    if (!searchKeyword.trim()) {
      toast.error('请输入搜索关键字');
      return;
    }

    const keyword = searchKeyword.trim().toLowerCase();
    let foundIndex = -1;

    // 搜索包含关键字的消息
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].content.toLowerCase().includes(keyword)) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== -1) {
      // 找到匹配项，滚动到该消息
      setShowSearchDialog(false);
      setSearchKeyword('');

      // 延迟一下再滚动，确保DOM已更新
      setTimeout(() => {
        const messageElements = document.querySelectorAll('[data-message-index]');
        if (messageElements[foundIndex]) {
          messageElements[foundIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 高亮显示
          setFlashIndex(foundIndex);
          setTimeout(() => setFlashIndex(null), 1900);
        }
      }, 100);

      toast.success(`找到匹配项：第 ${foundIndex + 1} 条消息`);
    } else {
      toast.error('暂无搜索结果，请尝试其他关键字');
    }
  };

  // 消息列表跳转功能
  const scrollToMessage = async (index: number) => {
    // 如果未加载历史，先加载
    if (!historyLoaded && user) {
      toast.loading('正在加载历史记录...');
      await loadConversationHistory();
      toast.dismiss();
    }

    setTimeout(() => {
      const messageElements = document.querySelectorAll('[data-message-index]');
      if (messageElements[index]) {
        messageElements[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFlashIndex(index);
        setTimeout(() => setFlashIndex(null), 1900);
      }
    }, historyLoaded ? 100 : 1000);
  };

  const handleLogout = () => {
    logout();
    setMessages([{
      id: '1',
      type: 'assistant',
      content: '你好！我是吉林大学法学院旗下的法律知识助手，我能为您的法律问题提供专业的回复，您有什么想问我的吗？',
      timestamp: new Date()
    }]);
    toast.success('已退出登录');
    setHistoryLoaded(false);
    setJustLoadedHistory(false);
    setSelectedProvider('DeepSeek');
    setEnableThinking(false);
    setShowAdvancedOptions(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!validateDocumentFile(file)) {
      toast.error('不支持的文件格式，仅支持 PDF 和 DOCX 文件');
      return;
    }

    // 验证文件大小（限制 10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('文件过大，请上传小于 10MB 的文件');
      return;
    }

    setIsReadingFile(true);
    toast.loading('正在读取文档内容...');

    try {
      const content = await readDocumentFile(file);

      // 验证字符数限制（1000字以内）
      if (content.length > 1000) {
        toast.dismiss();
        toast.error(`文档内容过长（${content.length} 字符），请上传不超过 1000 字的文档`);
        return;
      }

      setUploadedFile(file);
      setFileContent(content);
      toast.dismiss();
      toast.success(`文档读取成功！共 ${content.length} 字符`);
    } catch (error: any) {
      toast.dismiss();
      toast.error(error.message || '文档读取失败');
      console.error('文档读取错误:', error);
    } finally {
      setIsReadingFile(false);
      // 清空 input 以允许重复上传同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 移除已上传的文档
  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFileContent('');
    toast.success('已移除文档');
  };

  // 触发文件选择
  const handleFileButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleSendMessage = async () => {
    if ((!inputValue.trim() && !fileContent) || isLoading) return;

    // 构建消息内容
    let messageContent = '';

    if (fileContent && uploadedFile) {
      messageContent += `【已上传文档：${uploadedFile.name}】\n\n`;
      messageContent += `【文档内容】\n${fileContent}\n\n`;
      messageContent += `【我的问题】\n${inputValue.trim() || '请分析以上文档内容'}`;
      console.log('messageContent:', messageContent);
    } else {
      messageContent = inputValue.trim();
    }

    const userMessageId = Date.now().toString();
    const assistantMessageId = `${Date.now()}-assistant`;

    const userMessage: Message = {
      id: userMessageId,
      type: 'user',
      content: inputValue.trim() || `已上传文档：${uploadedFile?.name}`,
      timestamp: new Date()
    };

    const assistantMessage: Message = {
      id: assistantMessageId,
      type: 'assistant',
      content: '',
      thinkingContent: '',
      thinkingEnabled: selectedProvider === 'DeepSeek' && enableThinking,
      timestamp: new Date(),
      streaming: true,
      caseStatus: null,
      relatedCases: []
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputValue('');
    setUploadedFile(null);
    setFileContent('');
    setShowAdvancedOptions(false);
    setIsLoading(true);

    try {
      await sendChatMessageStream(
        {
          message: messageContent,
          sessionId,
          userId: user?.id,
          enableCaseSearch,
          enableThinking: selectedProvider === 'DeepSeek' ? enableThinking : false,
          provider: selectedProvider,
          caseCount
        },
        {
          onToken: (chunk) => {
            if (!chunk) return;
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: msg.content + chunk }
                : msg
            ));
          },
          onThinkingToken: (chunk) => {
            if (!chunk) return;
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, thinkingContent: (msg.thinkingContent || '') + chunk }
                : msg
            ));
          },
          onRelatedCases: (cases) => {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, relatedCases: Array.isArray(cases) ? cases : [] }
                : msg
            ));
          },
          onCaseStatus: ({ status, message }) => {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                  ...msg,
                  caseStatus: status === 'completed' ? null : (message || '正在为您检索相似案例')
                }
                : msg
            ));
          },
          onDone: (payload) => {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                  ...msg,
                  streaming: false,
                  caseStatus: null,
                  timestamp: new Date(),
                  relatedCases: payload?.relatedCases || [],
                  thinkingContent: msg.thinkingContent || payload?.reasoningContent || ''
                }
                : msg
            ));
          },
          onError: (message) => {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                  ...msg,
                  streaming: false,
                  caseStatus: null,
                  content: msg.content || '抱歉，我遇到了一些问题，请稍后再试。或者联系管理员检查API配置。'
                }
                : msg
            ));
            if (message) {
              toast.error(message);
            }
          }
        }
      );
    } catch (error: any) {
      console.error('发送消息失败:', error);
      toast.error(error.message || '发送失败，请稍后重试');
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
            ...msg,
            streaming: false,
            caseStatus: null,
            content: msg.content || '抱歉，我遇到了一些问题，请稍后再试。或者联系管理员检查API配置。'
          }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 输入框随内容增高
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [inputValue]);

  const stripHtmlTags = (text: string) => {
    return (text || '')
      .replace(/<em>/g, '')
      .replace(/<\/em>/g, '')
      .replace(/<strong>/g, '')
      .replace(/<\/strong>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\r\n/g, '\n')
      .trim();
  };

  const getCaseDocResult = (caseItem: CaseData): any[] => {
    if (Array.isArray(caseItem?.detail?.data?.docResult)) {
      return caseItem.detail.data.docResult;
    }
    if (Array.isArray(caseItem?.detail?.docResult)) {
      return caseItem.detail.docResult;
    }
    return [];
  };

  const getCasePreviewBlocks = (caseItem: CaseData): { label: string; text: string }[] => {
    const docResult = getCaseDocResult(caseItem);
    if (docResult.length > 0) {
      return docResult
        .filter((section: any) => section?.text)
        .slice(0, 6)
        .map((section: any, idx: number) => ({
          label: section.label || `段落 ${idx + 1}`,
          text: stripHtmlTags(String(section.text))
        }))
        .filter((section: { label: string; text: string }) => section.text.length > 0);
    }

    const fallbackContent = stripHtmlTags(
      String(
        caseItem?.detail?.data?.content ||
        caseItem?.detail?.content ||
        caseItem?.content ||
        ''
      )
    );

    if (fallbackContent) {
      return [{ label: '案情摘要', text: fallbackContent }];
    }

    return [];
  };

  // 会话目录：只取用户提问
  const questions = useMemo(
    () =>
      messages
        .map((m, index) => ({ message: m, index }))
        .filter(({ message }) => message.type === 'user'),
    [messages]
  );

  const sendDisabled = (!inputValue.trim() && !fileContent) || isLoading;

  // 目录栏内容：桌面固定在左侧，手机上作为抽屉使用
  const renderDirectory = (onNavigate?: () => void) => (
    <>
      {/* 品牌 */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-3">
          <img
            src="/logo_background.png"
            alt="吉林大学法学院院徽"
            className="w-10 h-10 object-contain shrink-0"
          />
          <div className="min-w-0">
            <div className="text-[15px] font-semibold leading-tight tracking-tight">
              法律知识助手
            </div>
            <div className="serif text-[12px] text-ink-3 mt-1 leading-tight">
              模拟法庭智能检索
            </div>
          </div>
        </div>
        <div className="mt-4 border-t border-rule pt-3 text-center">
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

      <div className="h-px bg-rule mx-5" />

      {/* 会话目录 */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="field-label">会话目录</h2>
        <span className="entry-line tnum">{questions.length} 条</span>
      </div>

      <nav aria-label="会话目录" className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {questions.length === 0 ? (
          <div className="px-2 py-6 text-[13px] leading-relaxed text-ink-3">
            还没有提问。发送第一条问题后，目录会在这里逐条登记。
          </div>
        ) : (
          <ol className="space-y-px">
            {questions.map(({ message, index }, order) => (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => {
                    scrollToMessage(index);
                    onNavigate?.();
                  }}
                  className="rail-row group"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="entry-line tnum shrink-0 text-ink-3">
                      {pad2(order + 1)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] leading-snug line-clamp-2 text-ink-2 group-hover:text-ink">
                        {message.content}
                      </span>
                      <span className="entry-line block mt-1 tnum">
                        {message.timestamp.toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </nav>

      {/* 底部账户行 */}
      <div className="border-t border-rule px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium truncate">{user?.username}</div>
            <div className="entry-line truncate">{user?.email}</div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-icon btn btn-quiet"
            title={theme === 'dark' ? '切换到亮色' : '切换到暗色'}
            aria-label={theme === 'dark' ? '切换到亮色主题' : '切换到暗色主题'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="btn-icon btn btn-quiet"
            title="退出登录"
            aria-label="退出登录"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="h-screen flex bg-paper text-ink overflow-hidden">
      {/* ============ 左侧目录栏（桌面） ============ */}
      <aside className="hidden lg:flex w-[272px] shrink-0 flex-col border-r border-rule bg-paper-deep">
        {renderDirectory()}
      </aside>

      {/* ============ 左侧目录栏（手机抽屉） ============ */}
      <AnimatePresence>
        {showDirectory && (
          <>
            <motion.div
              key="dir-scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="lg:hidden fixed inset-0 bg-[rgba(20,20,18,0.32)] z-[9998]"
              onClick={() => setShowDirectory(false)}
            />
            <motion.aside
              key="dir-panel"
              role="dialog"
              aria-modal="true"
              aria-label="会话目录"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.22, ease: [0.2, 0.7, 0.3, 1] }}
              className="lg:hidden fixed left-0 top-0 bottom-0 w-[280px] flex flex-col bg-paper-deep border-r border-rule-strong z-[9999] shadow-[16px_0_48px_-24px_rgba(0,0,0,0.4)]"
            >
              <div className="flex justify-end px-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDirectory(false)}
                  className="btn btn-quiet btn-icon"
                  aria-label="关闭目录"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {renderDirectory(() => setShowDirectory(false))}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ============ 主列 ============ */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 工具栏 */}
        <header className="shrink-0 border-b border-rule bg-paper">
          <div className="h-14 max-w-[980px] mx-auto px-4 sm:px-5 lg:px-6 flex items-center justify-between gap-2 sm:gap-4">
            <div className="min-w-0 flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setShowDirectory(true)}
                className="lg:hidden btn btn-quiet btn-icon h-9 w-9 shrink-0 -ml-1.5"
                aria-label="打开会话目录"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
              <h1 className="text-[15px] font-semibold tracking-tight whitespace-nowrap">
                检索对话
              </h1>
              <span className="entry-line hidden sm:inline truncate">
                会话 {sessionId.slice(-6)}
                <span className="sep">·</span>
                {PROVIDER_LABEL[selectedProvider]}
                {selectedProvider === 'DeepSeek' && enableThinking ? (
                  <>
                    <span className="sep">·</span>思维链
                  </>
                ) : null}
                {enableCaseSearch ? (
                  <>
                    <span className="sep">·</span>类案 {caseCount}
                  </>
                ) : null}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* 法律文库 */}
              <div className="relative">
                <LawLibrary />
              </div>

              {/* 历史对话 */}
              <div className="relative" ref={historyMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryMenu(!showHistoryMenu);
                    setShowSearchDialog(false);
                  }}
                  disabled={isLoadingHistory}
                  aria-haspopup="true"
                  aria-expanded={showHistoryMenu || showSearchDialog}
                  className="tool-btn h-9 px-2.5"
                  title="历史对话"
                >
                  {isLoadingHistory ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <History className="w-4 h-4" />
                  )}
                  <span className="hidden md:inline">历史</span>
                </button>

                <AnimatePresence>
                  {showHistoryMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-60 origin-top-right border border-rule-strong bg-card shadow-[0_8px_24px_-8px_rgba(0,0,0,0.28)] z-[100]"
                    >
                      <div className="px-3 py-2 border-b border-rule">
                        <span className="field-label">历史记录</span>
                      </div>
                      <div className="p-1">
                        <button
                          type="button"
                          onClick={handleLoadHistoryClick}
                          disabled={isLoadingHistory}
                          className="w-full flex items-start gap-2.5 px-2 py-2 text-left text-[13px] hover:bg-card-2 rounded-[2px] transition-colors disabled:opacity-50"
                        >
                          <History className="w-4 h-4 mt-0.5 text-ink-3 shrink-0" />
                          <span>
                            {historyLoaded ? '重新加载历史对话' : '加载历史对话'}
                            <span className="block entry-line mt-0.5 font-sans">
                              取回该账户最近 100 条记录
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowHistoryMenu(false);
                            setShowSearchDialog(true);
                          }}
                          className="w-full flex items-start gap-2.5 px-2 py-2 text-left text-[13px] hover:bg-card-2 rounded-[2px] transition-colors"
                        >
                          <Search className="w-4 h-4 mt-0.5 text-ink-3 shrink-0" />
                          <span>
                            搜索当前对话
                            <span className="block entry-line mt-0.5 font-sans">
                              按关键字定位到某一条
                            </span>
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showSearchDialog && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-80 border border-rule-strong bg-card shadow-[0_8px_24px_-8px_rgba(0,0,0,0.28)] z-[100] p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="field-label">搜索当前对话</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSearchDialog(false);
                            setSearchKeyword('');
                          }}
                          className="btn btn-quiet btn-icon h-7 w-7"
                          aria-label="关闭搜索"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSearchHistory();
                          }}
                          placeholder="合同、侵权、租赁…"
                          className="flex-1 min-w-0 h-9 px-2.5 text-[13px] bg-paper border border-rule-strong rounded-[2px] placeholder:text-ink-3 focus:outline-none focus:border-action focus:ring-2 focus:ring-action/25"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleSearchHistory}
                          className="btn btn-primary h-9 px-3"
                        >
                          搜索
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 用户菜单 */}
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  aria-haspopup="true"
                  aria-expanded={showUserMenu}
                  className="tool-btn h-9 pl-1 pr-2"
                  title="账户"
                >
                  <span className="w-6 h-6 grid place-items-center bg-action text-action-ink text-[11px] font-semibold rounded-[2px] uppercase">
                    {(user?.username || '·').slice(0, 1)}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-ink-3" />
                </button>

                <AnimatePresence>
                  {showUserMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-1.5 w-56 border border-rule-strong bg-card shadow-[0_8px_24px_-8px_rgba(0,0,0,0.28)] z-[100]"
                    >
                      <div className="px-3 py-2.5 border-b border-rule">
                        <div className="entry-line">已登录</div>
                        <div className="text-[13px] font-medium mt-0.5 truncate">{user?.username}</div>
                        <div className="entry-line truncate">{user?.email}</div>
                      </div>
                      <div className="p-1">
                        <button
                          type="button"
                          onClick={toggleTheme}
                          className="w-full flex items-center gap-2.5 px-2 py-2 text-left text-[13px] hover:bg-card-2 rounded-[2px] transition-colors"
                        >
                          {theme === 'dark' ? <Sun className="w-4 h-4 text-ink-3" /> : <Moon className="w-4 h-4 text-ink-3" />}
                          {theme === 'dark' ? '亮色主题' : '暗色主题'}
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-2 py-2 text-left text-[13px] text-seal-ink hover:bg-seal-soft rounded-[2px] transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          退出登录
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        {/* 消息流 */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-[980px] mx-auto px-4 sm:px-5 lg:px-6 py-6">
            {/* 加载历史 */}
            {isLoadingHistory && messages.length === 0 && (
              <div className="flex items-center gap-3 py-10 text-ink-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-[13px]">正在调取历史记录…</span>
              </div>
            )}

            <ol className="space-y-8">
              {messages.map((message, index) => {
                const isUser = message.type === 'user';
                return (
                  <li
                    key={message.id}
                    data-message-index={index}
                    className={`grid grid-cols-[20px_minmax(0,1fr)] sm:grid-cols-[28px_minmax(0,1fr)] gap-x-2.5 sm:gap-x-3 ${flashIndex === index ? 'flash-target' : ''}`}
                  >
                    {/* 索引标签 */}
                    <div className="pt-1 select-none" aria-hidden="true">
                      <span className="entry-line tnum block text-[11px] text-ink-3">
                        {pad2(index + 1)}
                      </span>
                    </div>

                    <motion.div
                      initial={justLoadedHistory ? { opacity: 0, y: 4 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.22,
                        delay: justLoadedHistory ? Math.min(index * 0.03, 0.6) : 0,
                        ease: [0.2, 0.7, 0.3, 1],
                      }}
                      className="min-w-0"
                    >
                      {isUser ? (
                        /* ---- 提问：权属块，无气泡 ---- */
                        <div className="border-l-2 border-seal pl-3.5">
                          <div className="entry-line mb-1.5">
                            提问
                            <span className="sep">·</span>
                            <span className="tnum">
                              {message.timestamp.toLocaleTimeString('zh-CN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-[15px] leading-[1.7] font-medium whitespace-pre-wrap break-words">
                            {message.content}
                          </p>
                        </div>
                      ) : (
                        /* ---- 回答：编目卡 ---- */
                        <article className="border border-rule bg-card">
                          {/* 款目行 */}
                          <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-rule bg-card-2 min-w-0">
                            <Scale className="w-3.5 h-3.5 text-action shrink-0" aria-hidden="true" />
                            <span className="entry-line truncate min-w-0">
                              {message.thinkingEnabled ? 'DeepSeek-V4.1-Flash · 思维链' : 'DeepSeek-V4.1-Flash'}
                              <span className="sep">·</span>
                              <span className="tnum">
                                {message.timestamp.toLocaleTimeString('zh-CN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {message.content ? (
                                <>
                                  <span className="sep">·</span>
                                  <span className="tnum">{message.content.length.toLocaleString('zh-CN')} 字</span>
                                </>
                              ) : null}
                              {message.relatedCases && message.relatedCases.length > 0 ? (
                                <>
                                  <span className="sep">·</span>
                                  <span className="tnum">类案 {message.relatedCases.length}</span>
                                </>
                              ) : null}
                            </span>
                            <span className="ml-auto flex items-center gap-1.5 shrink-0">
                              {message.streaming ? (
                                <span className="entry-line flex items-center gap-1.5 text-action whitespace-nowrap">
                                  <span className="w-1.5 h-1.5 bg-seal caret-pulse rounded-full" />
                                  {message.thinkingContent ? '组织答案' : '生成中'}
                                </span>
                              ) : (
                                <span className="entry-line hidden sm:inline">已生成</span>
                              )}
                            </span>
                          </div>

                          <div className="px-4 py-4 space-y-4">
                            {/* 相关案例 */}
                            {message.relatedCases && message.relatedCases.length > 0 && (
                              <details className="group border border-rule-strong bg-card-2/60">
                                <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                                  <ChevronDown className="w-3.5 h-3.5 text-ink-3 transition-transform group-open:rotate-180" />
                                  <span className="field-label">相关案例</span>
                                  <span className="entry-line tnum">
                                    {pad2(message.relatedCases.length)}
                                  </span>
                                  <span className="ml-auto entry-line">
                                    {message.streaming ? '检索中' : '展开查阅'}
                                  </span>
                                </summary>
                                <div className="border-t border-rule divide-y divide-rule">
                                  {message.relatedCases.map((caseItem, caseIdx) => (
                                    <div key={caseIdx} className="px-3 py-3">
                                      <div className="flex items-start gap-2.5">
                                        <span className="entry-line tnum shrink-0 mt-0.5">
                                          {pad2(caseIdx + 1)}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <h4 className="text-[14px] font-semibold leading-snug">
                                            {caseItem.title}
                                          </h4>
                                          {/* 结构化字段：案号、法院、案由可扫描 */}
                                          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px] leading-relaxed">
                                            <dt className="entry-line">案号</dt>
                                            <dd className="font-mono tnum break-all text-ink-2">
                                              {caseItem.caseNumber || '—'}
                                            </dd>
                                            <dt className="entry-line">法院</dt>
                                            <dd className="text-ink-2">{caseItem.court || '—'}</dd>
                                            {(caseItem.causeName || caseItem.cause) && (
                                              <>
                                                <dt className="entry-line">案由</dt>
                                                <dd className="text-ink-2">
                                                  {caseItem.causeName || caseItem.cause}
                                                </dd>
                                              </>
                                            )}
                                          </dl>

                                          <details className="group/inner mt-2">
                                            <summary className="inline-flex items-center gap-1 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-[13px] text-action hover:underline underline-offset-2">
                                              <ChevronDown className="w-3 h-3 transition-transform group-open/inner:rotate-180" />
                                              案情摘要
                                            </summary>
                                            <div className="mt-2 max-h-56 overflow-y-auto pr-1 space-y-2.5">
                                              {getCasePreviewBlocks(caseItem).length > 0 ? (
                                                getCasePreviewBlocks(caseItem).map((block, blockIndex) => (
                                                  <div key={blockIndex}>
                                                    <div className="field-label">{block.label}</div>
                                                    <p className="mt-1 text-[13px] leading-[1.7] whitespace-pre-wrap text-ink-2">
                                                      {block.text}
                                                    </p>
                                                  </div>
                                                ))
                                              ) : (
                                                <p className="text-[13px] text-ink-3">
                                                  当前案例暂无可展示的正文内容，请使用“导出案例”查看完整信息。
                                                </p>
                                              )}
                                            </div>
                                          </details>

                                          <button
                                            type="button"
                                            onClick={async () => {
                                              try {
                                                toast.loading('正在生成Word文档...');
                                                await exportCaseToWord(caseItem);
                                                toast.dismiss();
                                                toast.success('文档已下载');
                                              } catch (error) {
                                                toast.dismiss();
                                                toast.error('导出失败，请重试');
                                                console.error('导出案例失败:', error);
                                              }
                                            }}
                                            className="btn h-8 px-2.5 mt-3 text-[13px]"
                                          >
                                            <Download className="w-3 h-3" />
                                            导出案例
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}

                            {/* 思维链 */}
                            {message.thinkingContent && (
                              <details
                                open={Boolean(message.streaming)}
                                className="group border border-rule bg-card-2/40"
                              >
                                <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
                                  <Cpu className="w-3.5 h-3.5 text-ink-3" />
                                  <span className="field-label">思维链</span>
                                  {message.streaming && (
                                    <span className="entry-line text-seal-ink">记录中</span>
                                  )}
                                  <ChevronDown className="w-3.5 h-3.5 ml-auto text-ink-3 transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="border-t border-rule px-3 py-2.5 max-h-72 overflow-y-auto">
                                  <p className="entry-line font-sans whitespace-pre-wrap leading-[1.75] tracking-normal">
                                    {message.thinkingContent}
                                  </p>
                                </div>
                              </details>
                            )}

                            {/* 正文 */}
                            {message.content ? (
                              <div className="md measure">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({ children }) => <p>{children}</p>,
                                    table: ({ children }) => (
                                      <div className="mb-4 overflow-x-auto border border-rule">
                                        <table>{children}</table>
                                      </div>
                                    ),
                                    a: ({ children, href }) => (
                                      <a href={href} target="_blank" rel="noopener noreferrer">
                                        {children}
                                      </a>
                                    ),
                                    ol: ({ children }) => <ol>{children}</ol>,
                                    ul: ({ children }) => <ul>{children}</ul>,
                                    li: ({ children }) => <li>{children}</li>,
                                    hr: () => <hr />,
                                  }}
                                >
                                  {normalizeMarkdownTables(message.content)}
                                </ReactMarkdown>
                              </div>
                            ) : message.streaming ? (
                              <div className="flex items-center gap-2 text-ink-3">
                                <span className="w-1.5 h-1.5 bg-seal caret-pulse rounded-full" />
                                <span className="text-[13px]">
                                  {message.thinkingContent ? '正在组织最终答案…' : '正在检索…'}
                                </span>
                              </div>
                            ) : null}

                            {/* 类案检索状态 */}
                            {message.caseStatus && (
                              <div className="flex items-center gap-2 pt-1 border-t border-rule text-[13px] text-ink-3">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-action" />
                                {message.caseStatus}
                              </div>
                            )}
                          </div>
                        </article>
                      )}
                    </motion.div>
                  </li>
                );
              })}
            </ol>

            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {/* 输入台 */}
        <div className="shrink-0 border-t border-rule bg-paper-deep">
          <div className="max-w-[980px] mx-auto px-3 sm:px-5 lg:px-6 py-3">
            {/* 附件 */}
            {uploadedFile && (
              <div className="mb-2 flex items-center gap-2 border border-rule-strong bg-card px-2.5 py-2">
                <FileText className="w-4 h-4 text-action shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">{uploadedFile.name}</div>
                  <div className="entry-line tnum">
                    {formatFileSize(uploadedFile.size)}
                    <span className="sep">·</span>
                    {fileContent.length} 字符
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  disabled={isLoading}
                  className="btn btn-quiet btn-icon h-7 w-7"
                  aria-label="移除文档"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="border border-rule-strong bg-card focus-within:border-action transition-colors">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={uploadedFile ? '就这份文档提问…' : '输入法律问题，例如：承租人擅自转租，出租人能否解除合同？'}
                className="w-full px-3.5 pt-3 pb-1 bg-transparent border-0 resize-none focus:outline-none text-[15px] leading-[1.65] placeholder:text-ink-3"
                rows={1}
                style={{ maxHeight: 180 }}
                disabled={isLoading}
              />

              <div className="flex flex-wrap items-center gap-1 px-2 pb-2 pt-1">
                {/* 附件 */}
                <button
                  type="button"
                  onClick={handleFileButtonClick}
                  disabled={isLoading || isReadingFile}
                  className="tool-btn"
                  title="上传 PDF 或 Word 文档（正文不超过 1000 字）"
                >
                  {isReadingFile ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">文档</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <span className="w-px h-5 bg-rule mx-1" aria-hidden="true" />

                {/* 模型：暂时只开放 DeepSeek，通义法睿已下线 */}
                <div
                  role="group"
                  aria-label="选择模型"
                  className="flex items-center border border-rule rounded-[2px] p-px"
                >
                  <button
                    type="button"
                    disabled
                    aria-pressed
                    className="h-7 px-2.5 text-[12px] font-medium rounded-[1px] bg-action text-action-ink opacity-100 cursor-default"
                  >
                    DeepSeek
                  </button>
                </div>

                {/* 高级参数 */}
                <div className="relative" ref={advancedOptionsRef}>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedOptions(prev => !prev)}
                    className="tool-btn"
                    data-on={showAdvancedOptions || enableThinking || enableCaseSearch}
                    aria-haspopup="true"
                    aria-expanded={showAdvancedOptions}
                    aria-label="检索参数"
                    disabled={isLoading}
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">参数</span>
                    {(enableThinking || enableCaseSearch) && (
                      <span className="w-1.5 h-1.5 bg-seal rounded-full" aria-hidden="true" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showAdvancedOptions && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full left-0 mb-2 w-[280px] border border-rule-strong bg-card shadow-[0_-8px_24px_-8px_rgba(0,0,0,0.28)] z-[100]"
                      >
                        <div className="px-3 py-2 border-b border-rule">
                          <span className="field-label">检索参数</span>
                        </div>
                        <div className="p-3 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium">思维链</div>
                              <div className="entry-line mt-0.5 font-sans">
                                仅 DeepSeek 可用，流式返回推理过程
                              </div>
                            </div>
                            <Switch
                              checked={enableThinking}
                              onChange={setEnableThinking}
                              disabled={isLoading || selectedProvider !== 'DeepSeek'}
                              label="启用思维链"
                            />
                          </div>

                          <div className="h-px bg-rule" />

                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium">类案检索</div>
                              <div className="entry-line mt-0.5 font-sans">
                                回答后附相似的已裁判案例
                              </div>
                            </div>
                            <Switch
                              checked={enableCaseSearch}
                              onChange={setEnableCaseSearch}
                              disabled={isLoading}
                              label="启用类案检索"
                            />
                          </div>

                          {enableCaseSearch && (
                            <>
                              <div className="h-px bg-rule" />
                              <div>
                                <div className="text-[13px] font-medium mb-1.5">案例数量</div>
                                <div
                                  role="group"
                                  aria-label="案例数量"
                                  className="grid grid-cols-5 border border-rule rounded-[2px] p-px"
                                >
                                  {[1, 2, 3, 4, 5].map((num) => (
                                    <button
                                      key={num}
                                      type="button"
                                      onClick={() => setCaseCount(num)}
                                      disabled={isLoading}
                                      aria-pressed={caseCount === num}
                                      className={`h-7 text-[12px] font-medium tnum rounded-[1px] transition-colors disabled:opacity-40 ${
                                        caseCount === num
                                          ? 'bg-action text-action-ink'
                                          : 'text-ink-2 hover:bg-card-2'
                                      }`}
                                    >
                                      {num}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="ml-auto flex items-center gap-2 shrink-0">
                  <span className="entry-line hidden lg:inline">
                    Enter 发送
                    <span className="sep">·</span>
                    Shift+Enter 换行
                  </span>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sendDisabled}
                    className="btn btn-primary h-8 px-3 text-[13px]"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    发送
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="entry-line">支持 PDF / DOCX，正文不超过 1000 字</span>
              <span className="entry-line hidden sm:inline">
                场景 {pad2(messages.filter(m => m.type === 'user').length + 1)}
                <span className="sep">·</span>
                每次提问单独登记
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 移动端：待补充说明 */}
    </div>
  );
};

export default ChatInterface;
