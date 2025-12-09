import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Send, Bot, User as UserIcon, Loader2, Paperclip, X, FileText, LogOut, History, SlidersHorizontal, Download, Search, Clock, List, ChevronLeft, Sun, Moon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendChatMessageStream } from '../lib/api';
import { readDocumentFile, validateDocumentFile, formatFileSize } from '../lib/documentReader';
import { exportCaseToWord } from '../lib/exportCase';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
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
  timestamp: Date;
  streaming?: boolean;
  caseStatus?: string | null;
  relatedCases?: CaseData[];
}

const ChatInterface: React.FC = () => {
  const { user, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [enableCaseSearch, setEnableCaseSearch] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [justLoadedHistory, setJustLoadedHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'Qwen' | 'DeepSeek'>('Qwen');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [caseCount, setCaseCount] = useState(1);
  const [showHistoryMenu, setShowHistoryMenu] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [showMessageList, setShowMessageList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const advancedOptionsRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);

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

  // 初始化欢迎消息
  useEffect(() => {
    setSelectedProvider('Qwen');
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
          const loadedMessages: Message[] = conversations.map((conv: any) => ({
            id: conv.id.toString(),
            type: conv.message_type,
            content: conv.message_content,
            timestamp: new Date(conv.created_at)
          }));
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
          messageElements[foundIndex].classList.add('ring-2', 'ring-blue-400');
          setTimeout(() => {
            messageElements[foundIndex].classList.remove('ring-2', 'ring-blue-400');
          }, 2000);
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
        messageElements[index].classList.add('ring-2', 'ring-blue-400');
        setTimeout(() => {
          messageElements[index].classList.remove('ring-2', 'ring-blue-400');
        }, 2000);
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
    setSelectedProvider('Qwen');
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
                  relatedCases: payload?.relatedCases || []
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

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 flex flex-col transition-colors duration-300">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 p-4 shadow-sm relative z-50 transition-colors duration-300"
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/logo_background.png" alt="吉林大学法学院" className="w-12 h-12 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">法律知识助手模拟法庭智能检索网站</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">吉林大学法学院提供技术支持</p>
            </div>
          </div>

          {/* 用户菜单 */}
          <div className="flex items-center space-x-3">
            {/* 消息列表 */}
            <button
              onClick={() => setShowMessageList(!showMessageList)}
              className="p-2 rounded-lg border border-blue-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors"
              title="消息列表"
            >
              <List className="w-5 h-5" />
            </button>

            {/* 主题切换 */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-blue-200 dark:border-gray-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors"
              title={theme === 'dark' ? '切换亮色主题' : '切换暗色主题'}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* 法律文库 */}
            <div className="relative">
              <LawLibrary />
            </div>

            {/* 历史对话菜单 */}
            <div className="relative" ref={historyMenuRef}>
              <button
                onClick={() => {
                  setShowHistoryMenu(!showHistoryMenu);
                  setShowSearchDialog(false);
                }}
                disabled={isLoadingHistory}
                className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="历史对话"
              >
                {isLoadingHistory ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Clock className="w-5 h-5" />
                )}
              </button>

              {showHistoryMenu && !showSearchDialog && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-[100]"
                >
                  <button
                    onClick={handleLoadHistoryClick}
                    disabled={isLoadingHistory}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 flex items-center space-x-2 disabled:opacity-50"
                  >
                    <History className="w-4 h-4" />
                    <span>{historyLoaded ? '重新加载历史对话' : '加载历史对话'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowHistoryMenu(false);
                      setShowSearchDialog(true);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-gray-700 flex items-center space-x-2"
                  >
                    <Search className="w-4 h-4" />
                    <span>搜索历史对话</span>
                  </button>
                </motion.div>
              )}

              {showSearchDialog && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-[100]"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">搜索历史对话</h4>
                      <button
                        onClick={() => {
                          setShowSearchDialog(false);
                          setSearchKeyword('');
                        }}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSearchHistory();
                        }
                      }}
                      placeholder="输入关键字，如：合同、侵权..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />

                    <button
                      onClick={handleSearchHistory}
                      className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                    >
                      <Search className="w-4 h-4" />
                      <span>搜索</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded-full flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.username}</span>
              </button>

              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-[100]"
                >
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">登录为</p>
                    <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>退出登录</span>
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* 加载对话历史动画 */}
          {isLoadingHistory && messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <Bot className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-4 text-gray-600 text-sm">正在加载对话历史...</p>
            </motion.div>
          )}

          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                data-message-index={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.4,
                  delay: justLoadedHistory ? Math.min(index * 0.05, 2) : 0,
                  ease: "easeOut"
                }}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} transition-all duration-300 rounded-lg`}
              >
                <div className={`flex items-start space-x-3 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                  }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.type === 'user'
                    ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                    : 'bg-gradient-to-r from-blue-600 to-blue-800'
                    }`}>
                    {message.type === 'user' ? (
                      <UserIcon className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>

                  <div className={`rounded-2xl px-4 py-3 ${message.type === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 text-white'
                    : 'bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm border border-blue-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
                    }`}>
                    {message.type === 'assistant' ? (
                      message.content || !message.streaming ? (
                        <div className="prose prose-sm max-w-none prose-headings:font-bold prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-3 prose-h2:text-blue-800 prose-h3:text-base prose-h3:mt-3 prose-h3:mb-2 prose-h3:text-gray-800 prose-h4:text-sm prose-h4:mt-2 prose-h4:mb-1 prose-h4:text-blue-700 prose-h4:font-semibold prose-p:leading-relaxed prose-li:my-1 prose-strong:text-gray-900 prose-strong:font-bold">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0 text-gray-700 dark:text-gray-300 leading-relaxed">{children}</p>,
                              h2: ({ children }) => <h2 className="text-lg font-bold mt-4 mb-3 text-blue-800 dark:text-blue-300 border-b-2 border-blue-300 dark:border-blue-700 pb-1">{children}</h2>,
                              h3: ({ children }) => <h3 className="text-base font-extrabold mt-3 mb-2 text-gray-800 dark:text-gray-200">{children}</h3>,
                              h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">{children}</h4>,
                              ul: ({ children }) => <ul className="space-y-1 my-2">{children}</ul>,
                              li: ({ children }) => <li className="text-gray-700 dark:text-gray-300 leading-relaxed">{children}</li>,
                              strong: ({ children }) => <strong className="font-black text-gray-900 dark:text-white">{children}</strong>,
                              hr: () => <hr className="my-3 border-gray-300 dark:border-gray-600" />,
                              blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-600 pl-3 py-1 my-2 bg-blue-50 dark:bg-blue-900/20 text-gray-700 dark:text-gray-300 italic">{children}</blockquote>
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">我正在思考...</span>
                        </div>
                      )
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}

                    {message.type === 'assistant' && message.caseStatus && (
                      <div className="mt-2 flex items-center text-xs text-blue-500">
                        <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                        <span>{message.caseStatus}</span>
                      </div>
                    )}

                    {message.type === 'assistant' && message.relatedCases && message.relatedCases.length > 0 && !message.streaming && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">相关案例文档下载</p>
                        <div className="flex flex-wrap gap-2">
                          {message.relatedCases.map((caseItem, index) => (
                            <button
                              key={index}
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
                              className="flex items-center space-x-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              <Download className="w-3 h-3" />
                              <span>案例 {index + 1}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className={`text-xs mt-2 ${message.type === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                      }`}>
                      {message.timestamp.toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-800 p-4 relative z-40 transition-colors duration-300"
      >
        <div className="max-w-4xl mx-auto">
          {/* 文件上传预览 */}
          {uploadedFile && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between"
            >
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {uploadedFile.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(uploadedFile.size)} • {fileContent.length} 字符
                  </p>
                </div>
              </div>
              <button
                onClick={handleRemoveFile}
                disabled={isLoading}
                className="p-1 hover:bg-blue-100 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </motion.div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            {/* 高级参数入口 */}
            <div className="relative mb-3" ref={advancedOptionsRef}>
              <button
                type="button"
                onClick={() => setShowAdvancedOptions(prev => !prev)}
                className={`flex items-center justify-center p-3 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors ${showAdvancedOptions ? 'bg-blue-50 shadow-sm' : ''
                  }`}
                aria-haspopup="true"
                aria-expanded={showAdvancedOptions}
                aria-label="切换高级选项"
                disabled={isLoading}
              >
                <SlidersHorizontal className="w-5 h-5" />
              </button>

              <AnimatePresence>
                {showAdvancedOptions && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="absolute bottom-full left-0 mb-2 w-64 rounded-xl border border-blue-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl p-4 z-[100]"
                  >
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">选择模型</p>
                        <div className="flex items-center bg-blue-50 dark:bg-gray-700 border border-blue-200 dark:border-gray-600 rounded-full p-1">
                          {[
                            { label: '通义法睿-Plus', value: 'Qwen' as const },
                            { label: 'DeepSeek-V3.2', value: 'DeepSeek' as const }
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setSelectedProvider(option.value)}
                              disabled={isLoading}
                              className={`px-3 py-1 text-sm font-medium rounded-full transition-colors ${selectedProvider === option.value
                                ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow'
                                : 'text-blue-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-gray-200'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">类案检索</p>
                        <button
                          type="button"
                          onClick={() => setEnableCaseSearch(!enableCaseSearch)}
                          disabled={isLoading}
                          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-all ${enableCaseSearch
                            ? 'bg-blue-600 text-white shadow-md hover:bg-blue-700'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {enableCaseSearch ? '✓ 已启用类案检索' : '启用类案检索'}
                        </button>
                      </div>

                      {enableCaseSearch && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-2">案例数量</p>
                          <div className="flex items-center space-x-2">
                            {[1, 2, 3, 4, 5].map((num) => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => setCaseCount(num)}
                                disabled={isLoading}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${caseCount === num
                                  ? 'bg-blue-600 text-white shadow'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 文件上传按钮 */}
            <button
              type="button"
              onClick={handleFileButtonClick}
              disabled={isLoading || isReadingFile}
              className="p-3 mb-3 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="上传 PDF 或 Word 文档"
            >
              <Paperclip className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="flex-1 min-w-[240px] max-w-3xl mx-auto w-full">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={uploadedFile ? "输入你对文档的问题..." : "输入你的问题..."}
                className="w-full p-3 border border-blue-300 dark:border-blue-700 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-700 focus:border-transparent bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm dark:text-gray-100 dark:placeholder-gray-400 transition-colors duration-300"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={(!inputValue.trim() && !fileContent) || isLoading}
              className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-full flex items-center justify-center hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:from-blue-700 hover:to-blue-900"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-500 text-center">
            按 Enter 发送消息，Shift + Enter 换行 • 支持上传 PDF 和 Word 文档（最大 1000 字）
          </div>
        </div>
      </motion.div>

      {/* 左侧消息列表侧边栏 */}
      {
        showMessageList && createPortal(
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-900 shadow-2xl z-[99999] flex flex-col border-r border-gray-200 dark:border-gray-700 transition-colors duration-300"
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <List className="w-5 h-5" />
                消息列表
              </h3>
              <button
                onClick={() => setShowMessageList(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors dark:text-gray-400"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {messages.filter(msg => msg.type === 'user').map((msg) => {
                const actualIndex = messages.findIndex(m => m.id === msg.id);
                return (
                  <button
                    key={msg.id}
                    onClick={() => {
                      scrollToMessage(actualIndex);
                      setShowMessageList(false);
                    }}
                    className="w-full text-left p-3 mb-2 bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {msg.timestamp.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">
                      {msg.content}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>,
          document.body
        )
      }

    </div >
  );
};

export default ChatInterface;