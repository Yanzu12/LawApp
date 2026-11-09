import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Search, X, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { lawCategories, type LawCategory, type Law, type LawChapter, searchLaws } from '../lib/lawData';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const pad2 = (n: number) => String(n).padStart(2, '0');

// ID 到目录名的映射：文件系统里的目录名与法律 id 并不一致
const LAW_DIR_MAP: Record<string, string> = {
  'company-law': 'company-law',
  'copyright-law': 'copyright-law',
  'consumer-protection': 'protection-of-the-rights-and-interests-of-consumers',
  'anti-organized-crime': 'anti-organized-crime-law',
  'anti-telecom-fraud': 'combating-telecom-and-online-fraud',
  'criminal-procedure': 'criminal-procedure',
  'civil-procedure': 'civil-procedure',
  'administrative-procedure': 'administrative-procedure',
  'administrative-penalty': 'administrative-penalty',
  'public-security-penalty': 'penalties-for-administration-of-public-security',
  'compulsory-education': 'compulsory education-law',
  'environment-protection': 'environment-protection',
  'wildlife-protection': 'protection-of-wildlife',
  'infectious-disease': 'prevention-and-treatment-of-infections-diseases',
  'individual-income-tax': 'individual-income-tax-law',
  'cybersecurity': 'cybersecurity-law',
  'data-security': 'data-security-law',
  'personal-info-protection': 'personal-information-protection-law',
  'anti-monopoly': 'anti monopoly law',
  'seed-law': 'seed-law',
  'labor-law': 'labor-law',
  'minors-protection': 'protection-of-minors',
  'juvenile-delinquency': 'prevention-of-juvenile-delinquency',
  'work-safety': 'work-safety-law',
  'legislation-law': 'legislation-law',
  'national-flag-law': 'national-flag-law',
  'national-emblem-law': 'national-emblem-law',
  'national-anthem-law': 'national-anthem-law',
};

/** 由分类 / 法律 / 章节算出该章节 Markdown 的地址 */
const chapterPath = (category: LawCategory, law: Law, chapter: LawChapter) => {
  const categoryFolder = category.id;
  const lawDir = LAW_DIR_MAP[law.id] || law.id;

  if (categoryFolder === 'constitution' && law.id === 'constitution-main') {
    return `/docs/constitution/${chapter.fileName}`;
  }
  if (categoryFolder === 'civil-and-commercial' && law.id === 'civil-code') {
    return `/docs/civil-and-commercial/civil-code/${chapter.fileName}`;
  }
  if (categoryFolder === 'criminal-law' && law.id === 'criminal-law-main') {
    return `/docs/criminal-law/criminal-law/${chapter.fileName}`;
  }
  return `/docs/${categoryFolder}/${lawDir}/${chapter.fileName}`;
};

const LawLibrary: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<LawCategory>(lawCategories[0]);
  const [selectedLaw, setSelectedLaw] = useState<Law | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<LawChapter | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [chapterContent, setChapterContent] = useState('');
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [headings, setHeadings] = useState<{ level: number; text: string; id: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ law: Law; category: LawCategory; headingText: string; headingId: string }[]>([]);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // 点击外部关闭面板（但点击触发按钮本身交给按钮处理）
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Esc：先收章节，再收面板
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selectedChapter) {
        setSelectedChapter(null);
      } else if (isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedChapter, isOpen]);

  const loadChapterContent = async (
    category: LawCategory,
    law: Law,
    chapter: LawChapter,
    anchorText?: string
  ) => {
    setIsLoadingContent(true);
    setSelectedChapter(chapter);
    setChapterContent('');
    setHeadings([]);
    setActiveHeading(null);
    setPendingAnchor(anchorText ?? null);

    try {
      const response = await fetch(chapterPath(category, law, chapter));
      if (!response.ok) {
        throw new Error('无法加载法律内容');
      }

      const text = await response.text();
      setChapterContent(text);

      const parsedHeadings: { level: number; text: string; id: string }[] = [];
      for (const match of text.matchAll(/^(##|###)\s+(.+)$/gm)) {
        parsedHeadings.push({
          level: match[1].length,
          text: match[2].trim(),
          id: `heading-${parsedHeadings.length}`,
        });
      }
      setHeadings(parsedHeadings);
    } catch (error) {
      console.error('加载章节内容失败:', error);
      setChapterContent('# 加载失败\n\n无法加载该章节内容，请稍后重试。');
    } finally {
      setIsLoadingContent(false);
    }
  };

  // 内容与标题就绪后再滚动到锚点，避免原先 500ms 猜测造成的错位
  useEffect(() => {
    if (!pendingAnchor || isLoadingContent || headings.length === 0) return;
    const heading = headings.find((h) => h.text === pendingAnchor);
    if (heading) {
      const el = document.getElementById(heading.id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveHeading(heading.id);
    }
    setPendingAnchor(null);
  }, [pendingAnchor, isLoadingContent, headings]);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const results: { law: Law; category: LawCategory; headingText: string; headingId: string }[] = [];
    const keyword = searchKeyword.trim().toLowerCase();

    for (const category of lawCategories) {
      for (const law of category.laws) {
        if (!law.chapters || law.chapters.length === 0) continue;
        try {
          const response = await fetch(chapterPath(category, law, law.chapters[0]));
          if (!response.ok) continue;
          const text = await response.text();

          for (const match of text.matchAll(/^(##|###)\s+(.+)$/gm)) {
            const headingText = match[2].trim();
            if (headingText.toLowerCase().includes(keyword) || law.title.toLowerCase().includes(keyword)) {
              results.push({
                law,
                category,
                headingText,
                headingId: `heading-${results.length}`,
              });
            }
          }
        } catch (error) {
          console.error(`搜索 ${law.title} 章节失败:`, error);
        }
      }
    }

    setSearchResults(results);
    setIsSearching(false);
  };

  const filteredLaws = selectedCategory.laws;

  return (
    <>
      {/* 触发按钮 */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="tool-btn h-9 px-2.5"
        data-on={isOpen}
        title="法律文库"
      >
        <BookOpen className="w-4 h-4" />
        <span className="hidden md:inline">法条</span>
      </button>

      {/* 下拉面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-label="法律文库"
            className="absolute top-full right-0 mt-1.5 w-[min(760px,calc(100vw-2rem))] h-[min(600px,calc(100vh-8rem))] border border-rule-strong bg-card shadow-[0_12px_32px_-12px_rgba(0,0,0,0.34)] overflow-hidden z-[100] flex"
          >
            {/* 左：分类 */}
            <div className="w-44 shrink-0 border-r border-rule bg-card-2 flex flex-col">
              <div className="px-3 h-10 flex items-center border-b border-rule">
                <span className="field-label">法律分类</span>
              </div>
              <nav aria-label="法律分类" className="flex-1 overflow-y-auto p-2">
                {lawCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(category);
                      setSelectedLaw(null);
                      setSearchKeyword('');
                      setSearchResults([]);
                    }}
                    className="rail-row"
                    data-active={selectedCategory.id === category.id}
                  >
                    <span className="text-[13px] leading-snug">
                      {category.name}
                      <span className="entry-line tnum ml-1.5">{pad2(category.laws.length)}</span>
                    </span>
                  </button>
                ))}
              </nav>
            </div>

            {/* 右：内容 */}
            <div className="flex-1 min-w-0 flex flex-col">
              {/* 搜索 */}
              <div className="border-b border-rule p-3">
                <div className="flex gap-1.5">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-3 pointer-events-none" />
                    <input
                      type="text"
                      value={searchKeyword}
                      onChange={(e) => {
                        setSearchKeyword(e.target.value);
                        if (!e.target.value.trim()) {
                          setSearchResults([]);
                          setIsSearching(false);
                        }
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="搜索法律或章节标题…"
                      aria-label="搜索法律或章节"
                      className="w-full h-9 pl-8 pr-8 text-[13px] bg-paper border border-rule-strong rounded-[2px] placeholder:text-ink-3 focus:outline-none focus:border-action focus:ring-2 focus:ring-action/20"
                    />
                    {searchKeyword && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchKeyword('');
                          setSearchResults([]);
                          setIsSearching(false);
                        }}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 btn btn-quiet btn-icon h-6 w-6"
                        aria-label="清空搜索"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={!searchKeyword.trim() || isSearching}
                    className="btn btn-primary h-9 px-3 shrink-0"
                  >
                    {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    搜索
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-2 border border-rule bg-paper max-h-52 overflow-y-auto">
                    <div className="entry-line px-2.5 py-1.5 border-b border-rule sticky top-0 bg-paper">
                      命中 <span className="tnum">{searchResults.length}</span> 条
                    </div>
                    {searchResults.map((result, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={async () => {
                          setSelectedCategory(result.category);
                          setSelectedLaw(result.law);
                          if (result.law.chapters && result.law.chapters.length > 0) {
                            await loadChapterContent(
                              result.category,
                              result.law,
                              result.law.chapters[0],
                              result.headingText
                            );
                          }
                        }}
                        className="w-full text-left px-2.5 py-2 hover:bg-card-2 border-b border-rule last:border-b-0 transition-colors"
                      >
                        <div className="text-[13px] text-ink-3">{result.law.title}</div>
                        <div className="text-[13px] text-action mt-0.5 line-clamp-1">
                          {result.headingText}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchKeyword.trim() && !isSearching && searchResults.length === 0 && (
                  <div className="mt-2 entry-line">尚未搜索，按回车或点“搜索”</div>
                )}
              </div>

              {/* 列表 / 章节 */}
              <div className="flex-1 overflow-y-auto">
                {!selectedLaw ? (
                  <div>
                    {filteredLaws.length > 0 ? (
                      filteredLaws.map((law) => (
                        <button
                          key={law.id}
                          type="button"
                          onClick={() => setSelectedLaw(law)}
                          className="w-full text-left px-4 py-3 border-b border-rule last:border-b-0 hover:bg-card-2 transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-[14px] font-medium leading-snug">
                                {law.title}
                              </div>
                              {law.description && (
                                <div className="entry-line mt-1 font-sans leading-relaxed">
                                  {law.description}
                                </div>
                              )}
                            </div>
                            <span className="entry-line tnum shrink-0">
                              {pad2(law.chapters.length)} 章
                            </span>
                            <ChevronRight className="w-4 h-4 text-ink-3 group-hover:text-action transition-colors shrink-0" />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-10 text-[13px] text-ink-3">该分类下暂无法律。</div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="px-4 py-2.5 border-b border-rule flex items-center gap-2 sticky top-0 bg-card z-10">
                      <button
                        type="button"
                        onClick={() => setSelectedLaw(null)}
                        className="btn btn-quiet h-8 px-2 text-[13px]"
                      >
                        <ChevronRight className="w-3 h-3 rotate-180" />
                        返回
                      </button>
                      <span className="text-[13px] font-medium truncate">{selectedLaw.title}</span>
                    </div>
                    {selectedLaw.chapters.map((chapter, idx) => (
                      <button
                        key={chapter.id}
                        type="button"
                        onClick={() => loadChapterContent(selectedCategory, selectedLaw, chapter)}
                        className="w-full text-left px-4 py-2.5 border-b border-rule last:border-b-0 hover:bg-card-2 transition-colors group flex items-center gap-3"
                      >
                        <span className="entry-line tnum shrink-0 w-5">{pad2(idx + 1)}</span>
                        <span className="text-[13px] flex-1 min-w-0">{chapter.title}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-ink-3 group-hover:text-action shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 章节阅读器 */}
      {selectedChapter &&
        createPortal(
          <AnimatePresence>
            <motion.div
              key="statute"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-[rgba(20,20,18,0.32)] z-[99998]"
              onClick={() => setSelectedChapter(null)}
            />
            <motion.div
              key="panel"
              role="dialog"
              aria-modal="true"
              aria-label={selectedChapter.title}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.24, ease: [0.2, 0.7, 0.3, 1] }}
              className="fixed right-0 top-0 bottom-0 w-[min(920px,94vw)] bg-card border-l border-rule-strong z-[99999] flex flex-col shadow-[-16px_0_48px_-24px_rgba(0,0,0,0.4)]"
            >
              {/* 头部 */}
              <div className="shrink-0 h-14 px-4 border-b border-rule flex items-center gap-3">
                <BookOpen className="w-4 h-4 text-action shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold truncate leading-tight">
                    {selectedChapter.title}
                  </div>
                  <div className="entry-line mt-0.5">
                    {selectedCategory.name}
                    <span className="sep">·</span>
                    {selectedLaw?.title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedChapter(null)}
                  className="btn btn-quiet btn-icon h-8 w-8 shrink-0"
                  aria-label="关闭章节"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 min-h-0 flex">
                {/* 目录 */}
                {headings.length > 0 && (
                  <nav
                    aria-label="本章目录"
                    className="hidden md:block w-60 shrink-0 border-r border-rule bg-card-2 overflow-y-auto p-3"
                  >
                    <div className="field-label mb-2">目录</div>
                    <ul className="space-y-px">
                      {headings.map((heading) => (
                        <li key={heading.id}>
                          <button
                            type="button"
                            onClick={() => {
                              document
                                .getElementById(heading.id)
                                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              setActiveHeading(heading.id);
                            }}
                            className={`w-full text-left text-[13px] leading-snug py-1.5 pr-2 rounded-[2px] transition-colors ${
                              heading.level === 3 ? 'pl-5 text-ink-3' : 'pl-2 text-ink-2'
                            } ${
                              activeHeading === heading.id
                                ? 'bg-card text-ink font-medium shadow-[inset_2px_0_0_var(--seal)]'
                                : 'hover:bg-card hover:text-ink'
                            }`}
                          >
                            {heading.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}

                {/* 正文 */}
                <div className="flex-1 min-w-0 overflow-y-auto" ref={contentRef}>
                  {isLoadingContent ? (
                    <div className="flex items-center gap-2 px-6 py-10 text-ink-3">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-[13px]">正在调取条文…</span>
                    </div>
                  ) : (
                    <div className="statute px-6 md:px-10 py-6 max-w-[72ch] mx-auto">
                      <div className="md">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h2: ({ children, ...props }) => {
                              const heading = headings.find(
                                (h) => h.text === String(children) && h.level === 2
                              );
                              return (
                                <h2 id={heading?.id} {...props}>
                                  {children}
                                </h2>
                              );
                            },
                            h3: ({ children, ...props }) => {
                              const heading = headings.find(
                                (h) => h.text === String(children) && h.level === 3
                              );
                              return (
                                <h3 id={heading?.id} {...props}>
                                  {children}
                                </h3>
                              );
                            },
                          }}
                        >
                          {chapterContent}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body
        )}
    </>
  );
};

export default LawLibrary;
