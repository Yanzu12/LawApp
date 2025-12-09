import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Search, X, ChevronRight, FileText } from 'lucide-react';
import { lawCategories, type LawCategory, type Law, type LawChapter, searchLaws } from '../lib/lawData';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

    const panelRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭面板
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

    // 加载章节内容
    const loadChapterContent = async (category: LawCategory, law: Law, chapter: LawChapter) => {
        setIsLoadingContent(true);
        setSelectedChapter(chapter);

        try {
            // 构建文件路径 - 创建ID到实际目录名的映射
            const categoryFolder = category.id;

            // ID到目录名的映射表
            const lawDirMap: Record<string, string> = {
                // 民商法
                'company-law': 'company-law',
                'copyright-law': 'copyright-law',
                'consumer-protection': 'protection-of-the-rights-and-interests-of-consumers',
                // 刑法
                'anti-organized-crime': 'anti-organized-crime-law',
                'anti-telecom-fraud': 'combating-telecom-and-online-fraud',
                // 程序法
                'criminal-procedure': 'criminal-procedure',
                'civil-procedure': 'civil-procedure',
                'administrative-procedure': 'administrative-procedure',
                // 行政法
                'administrative-penalty': 'administrative-penalty',
                'public-security-penalty': 'penalties-for-administration-of-public-security',
                'compulsory-education': 'compulsory education-law',
                'environment-protection': 'environment-protection',
                'wildlife-protection': 'protection-of-wildlife',
                'infectious-disease': 'prevention-and-treatment-of-infections-diseases',
                // 经济法
                'individual-income-tax': 'individual-income-tax-law',
                'cybersecurity': 'cybersecurity-law',
                'data-security': 'data-security-law',
                'personal-info-protection': 'personal-information-protection-law',
                'anti-monopoly': 'anti monopoly law',
                'seed-law': 'seed-law',
                // 社会法
                'labor-law': 'labor-law',
                'minors-protection': 'protection-of-minors',
                'juvenile-delinquency': 'prevention-of-juvenile-delinquency',
                'work-safety': 'work-safety-law',
                // 宪法相关法
                'legislation-law': 'legislation-law',
                'national-flag-law': 'national-flag-law',
                'national-emblem-law': 'national-emblem-law',
                'national-anthem-law': 'national-anthem-law'
            };

            const lawDir = lawDirMap[law.id] || law.id;

            // 特殊处理不同的路径结构
            let filePath = '';
            if (categoryFolder === 'constitution' && law.id === 'constitution-main') {
                filePath = `/docs/constitution/${chapter.fileName}`;
            } else if (categoryFolder === 'civil-and-commercial' && law.id === 'civil-code') {
                filePath = `/docs/civil-and-commercial/civil-code/${chapter.fileName}`;
            } else if (categoryFolder === 'criminal-law' && law.id === 'criminal-law-main') {
                filePath = `/docs/criminal-law/criminal-law/${chapter.fileName}`;
            } else {
                // 使用映射表中的目录名
                filePath = `/docs/${categoryFolder}/${lawDir}/${chapter.fileName}`;
            }

            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error('无法加载法律内容');
            }

            const text = await response.text();
            setChapterContent(text);

            // 解析标题
            const headingMatches = text.matchAll(/^(##|###)\s+(.+)$/gm);
            const parsedHeadings: { level: number; text: string; id: string }[] = [];
            for (const match of headingMatches) {
                const level = match[1].length; // ## = 2, ### = 3
                const text = match[2].trim();
                const id = `heading-${parsedHeadings.length}`;
                parsedHeadings.push({ level, text, id });
            }
            setHeadings(parsedHeadings);
        } catch (error) {
            console.error('加载章节内容失败:', error);
            setChapterContent('# 加载失败\n\n无法加载该章节内容，请稍后重试。');
        } finally {
            setIsLoadingContent(false);
        }
    };

    // 搜索章节功能
    const handleSearch = async () => {
        if (!searchKeyword.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        const results: { law: Law; category: LawCategory; headingText: string; headingId: string }[] = [];
        const keyword = searchKeyword.trim().toLowerCase();

        // 路径映射表（与 loadChapterContent 中的一致）
        const lawDirMap: Record<string, string> = {
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
            'national-anthem-law': 'national-anthem-law'
        };

        // 遍历所有法律类别和法律
        for (const category of lawCategories) {
            for (const law of category.laws) {
                // 只处理有章节的法律
                if (law.chapters && law.chapters.length > 0) {
                    try {
                        // 构建正确的文件路径
                        let filePath = '';
                        const categoryFolder = category.id;
                        const lawDir = lawDirMap[law.id] || law.id;

                        if (categoryFolder === 'constitution' && law.id === 'constitution-main') {
                            filePath = `/docs/constitution/${law.chapters[0].fileName}`;
                        } else if (categoryFolder === 'civil-and-commercial' && law.id === 'civil-code') {
                            filePath = `/docs/civil-and-commercial/civil-code/${law.chapters[0].fileName}`;
                        } else if (categoryFolder === 'criminal-law' && law.id === 'criminal-law-main') {
                            filePath = `/docs/criminal-law/criminal-law/${law.chapters[0].fileName}`;
                        } else {
                            filePath = `/docs/${categoryFolder}/${lawDir}/${law.chapters[0].fileName}`;
                        }

                        const response = await fetch(filePath);
                        if (response.ok) {
                            const text = await response.text();
                            const headingMatches = text.matchAll(/^(##|###)\s+(.+)$/gm);

                            for (const match of headingMatches) {
                                const headingText = match[2].trim();
                                // 搜索章节标题或法律名称
                                if (headingText.toLowerCase().includes(keyword) || law.title.toLowerCase().includes(keyword)) {
                                    results.push({
                                        law,
                                        category,
                                        headingText,
                                        headingId: `heading-${results.length}`
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`搜索 ${law.title} 章节失败:`, error);
                    }
                }
            }
        }

        setSearchResults(results);
        setIsSearching(false);
    };

    // 法律列表（不再实时过滤，只通过搜索按钮）
    const filteredLaws = selectedCategory.laws;

    return (
        <>
            {/* 触发按钮 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg border border-blue-200 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-800 dark:border-gray-700 transition-colors"
                title="法律文库"
            >
                <BookOpen className="w-5 h-5" />
            </button>

            {/* 下拉面板 */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={panelRef}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="absolute top-full right-0 mt-2 w-[720px] max-h-[600px] bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-[100]"
                    >
                        <div className="flex h-full">
                            {/* 左侧分类导航 */}
                            <div className="w-48 bg-gradient-to-b from-blue-50 to-blue-100 dark:from-gray-800 dark:to-gray-900 border-r border-blue-200 dark:border-gray-700 overflow-y-auto">
                                <div className="p-3 border-b border-blue-200 dark:border-gray-700">
                                    <h3 className="text-sm font-bold text-blue-900 dark:text-blue-100">法律分类</h3>
                                </div>
                                <div className="p-2">
                                    {lawCategories.map((category) => (
                                        <button
                                            key={category.id}
                                            onClick={() => {
                                                setSelectedCategory(category);
                                                setSelectedLaw(null);
                                                setSearchKeyword('');
                                            }}
                                            className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-all ${selectedCategory.id === category.id
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-blue-200 dark:hover:bg-gray-700'
                                                }`}
                                        >
                                            <span className="mr-2">{category.icon}</span>
                                            <span className="text-sm font-medium">{category.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 右侧内容区 */}
                            <div className="flex-1 flex flex-col">
                                {/* 搜索栏 */}
                                {/* 搜索栏 */}
                                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                                placeholder="搜索法律或章节..."
                                                className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            {searchKeyword && (
                                                <button
                                                    onClick={() => {
                                                        setSearchKeyword('');
                                                        setSearchResults([]);
                                                        setIsSearching(false);
                                                    }}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={handleSearch}
                                            disabled={!searchKeyword.trim() || isSearching}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
                                        >
                                            <Search className="w-4 h-4" />
                                            {isSearching ? '搜索中...' : '搜索'}
                                        </button>
                                    </div>

                                    {/* 搜索结果 */}
                                    {searchResults.length > 0 && (
                                        <div className="mt-3 max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">找到 {searchResults.length} 个结果</div>
                                            {searchResults.map((result, index) => (
                                                <button
                                                    key={index}
                                                    onClick={async () => {
                                                        setSelectedCategory(result.category);
                                                        setSelectedLaw(result.law);
                                                        if (result.law.chapters && result.law.chapters.length > 0) {
                                                            await loadChapterContent(result.category, result.law, result.law.chapters[0]);
                                                            setTimeout(() => {
                                                                const heading = headings.find(h => h.text === result.headingText);
                                                                if (heading) {
                                                                    const element = document.getElementById(heading.id);
                                                                    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                }
                                                            }, 500);
                                                        }
                                                    }}
                                                    className="w-full text-left p-2 hover:bg-white dark:hover:bg-gray-700 rounded transition-colors mb-1"
                                                >
                                                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{result.law.title}</div>
                                                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">→ {result.headingText}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 法律列表 */}
                                <div className="flex-1 overflow-y-auto p-4">
                                    {!selectedLaw ? (
                                        <div className="space-y-2">
                                            {filteredLaws.length > 0 ? (
                                                filteredLaws.map((law) => (
                                                    <button
                                                        key={law.id}
                                                        onClick={() => setSelectedLaw(law)}
                                                        className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 transition-all group"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex-1">
                                                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">
                                                                    {law.title}
                                                                </h4>
                                                                {law.description && (
                                                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{law.description}</p>
                                                                )}
                                                            </div>
                                                            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-center py-12">
                                                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                                    <p className="text-gray-500 text-sm">没有找到相关法律</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            {/* 返回按钮 */}
                                            <button
                                                onClick={() => setSelectedLaw(null)}
                                                className="mb-4 text-blue-600 hover:text-blue-800 flex items-center text-sm font-medium"
                                            >
                                                <ChevronRight className="w-4 h-4 transform rotate-180" />
                                                <span>返回列表</span>
                                            </button>

                                            {/* 法律标题 */}
                                            <h3 className="text-lg font-bold text-gray-900 mb-4">{selectedLaw.title}</h3>

                                            {/* 章节列表 */}
                                            <div className="space-y-2">
                                                {selectedLaw.chapters.map((chapter) => (
                                                    <button
                                                        key={chapter.id}
                                                        onClick={() => loadChapterContent(selectedCategory, selectedLaw, chapter)}
                                                        className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-medium text-gray-700">{chapter.title}</span>
                                                            <ChevronRight className="w-4 h-4 text-gray-400" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 章节内容侧边栏 - 使用 Portal 渲染到 body */}
            {selectedChapter && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 bottom-0 w-[60%] max-w-[900px] bg-white dark:bg-gray-900 shadow-2xl z-[99999] flex flex-col"
                    >
                        {/* 弹窗头部 */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedChapter.title}</h3>
                            <button
                                onClick={() => setSelectedChapter(null)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                            </button>
                        </div>

                        {/* 弹窗布局：左侧目录 + 右侧内容 */}
                        <div className="flex flex-1 overflow-hidden">
                            {/* 左侧目录 */}
                            {headings.length > 0 && (
                                <div className="w-64 border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-800">
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">目录</h4>
                                    <div className="space-y-1">
                                        {headings.map((heading, index) => (
                                            <button
                                                key={index}
                                                onClick={() => {
                                                    const element = document.getElementById(heading.id);
                                                    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }}
                                                className={`w-full text-left text-sm py-1 px-2 rounded hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400 transition-colors ${heading.level === 3 ? 'pl-6 text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-200 font-medium'
                                                    }`}
                                            >
                                                {heading.text}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* 右侧内容 */}
                            <div className="flex-1 overflow-y-auto p-6" ref={contentRef}>
                                {isLoadingContent ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="text-gray-500 dark:text-gray-400">加载中...</div>
                                    </div>
                                ) : (
                                    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-li:text-gray-700 dark:prose-li:text-gray-300 prose-table:border-collapse prose-table:border prose-table:border-gray-300 dark:prose-table:border-gray-600 prose-th:border prose-th:border-gray-300 dark:prose-th:border-gray-600 prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:p-2 prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-600 prose-td:p-2">
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                h2: ({ children, ...props }) => {
                                                    const text = String(children);
                                                    const heading = headings.find(h => h.text === text && h.level === 2);
                                                    return <h2 id={heading?.id} className="text-center font-bold text-2xl" {...props}>{children}</h2>;
                                                },
                                                h3: ({ children, ...props }) => {
                                                    const text = String(children);
                                                    const heading = headings.find(h => h.text === text && h.level === 3);
                                                    return <h3 id={heading?.id} className="text-center font-bold" {...props}>{children}</h3>;
                                                }
                                            }}
                                        >
                                            {chapterContent}
                                        </ReactMarkdown>
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
