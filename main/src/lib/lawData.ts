// 法律文库数据 - 基于 just-laws 项目结构

export interface LawChapter {
    id: string;
    title: string;
    fileName: string;
}

export interface Law {
    id: string;
    title: string;
    description?: string;
    chapters: LawChapter[];
}

export interface LawCategory {
    id: string;
    name: string;
    icon: string;
    laws: Law[];
}

// 法律分类数据
export const lawCategories: LawCategory[] = [
    {
        id: 'constitution',
        name: '宪法',
        icon: '📜',
        laws: [
            {
                id: 'constitution-main',
                title: '中华人民共和国宪法',
                description: '1982年12月4日第五届全国人民代表大会第五次会议通过',
                chapters: [
                    { id: 'constitution-preface', title: '序言', fileName: '序言.md' },
                    { id: 'constitution-ch1', title: '第一章 总纲', fileName: '第一章 总纲.md' },
                    { id: 'constitution-ch2', title: '第二章 公民的基本权利和义务', fileName: '第二章 公民的基本权利和义务.md' },
                    { id: 'constitution-ch3', title: '第三章 国家机构', fileName: '第三章 国家机构.md' },
                    { id: 'constitution-ch4', title: '第四章 国旗、国歌、国徽、首都', fileName: '第四章 国旗、国歌、国徽、首都.md' },
                ]
            }
        ]
    },
    {
        id: 'constitutional-relevance',
        name: '宪法相关法',
        icon: '⚖️',
        laws: [
            {
                id: 'legislation-law',
                title: '中华人民共和国立法法',
                chapters: [{ id: 'legislation-law-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'national-flag-law',
                title: '中华人民共和国国旗法',
                chapters: [{ id: 'national-flag-law-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'national-emblem-law',
                title: '中华人民共和国国徽法',
                chapters: [{ id: 'national-emblem-law-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'national-anthem-law',
                title: '中华人民共和国国歌法',
                chapters: [{ id: 'national-anthem-law-main', title: '全文', fileName: 'README.md' }]
            }
        ]
    },
    {
        id: 'civil-and-commercial',
        name: '民商法',
        icon: '📋',
        laws: [
            {
                id: 'civil-code',
                title: '中华人民共和国民法典',
                description: '2020年5月28日第十三届全国人民代表大会第三次会议通过',
                chapters: [
                    { id: 'civil-code-1', title: '第一编 总则', fileName: '第一编 总则.md' },
                    { id: 'civil-code-2', title: '第二编 物权', fileName: '第二编 物权.md' },
                    { id: 'civil-code-3', title: '第三编 合同', fileName: '第三编 合同.md' },
                    { id: 'civil-code-4', title: '第四编 人格权', fileName: '第四编 人格权.md' },
                    { id: 'civil-code-5', title: '第五编 婚姻家庭', fileName: '第五编 婚姻家庭.md' },
                    { id: 'civil-code-6', title: '第六编 继承', fileName: '第六编 继承.md' },
                    { id: 'civil-code-7', title: '第七编 侵权责任', fileName: '第七编 侵权责任.md' },
                    { id: 'civil-code-appendix', title: '附则', fileName: '附则.md' },
                ]
            },
            {
                id: 'company-law',
                title: '中华人民共和国公司法',
                chapters: [{ id: 'company-law-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'copyright-law',
                title: '中华人民共和国著作权法',
                chapters: [{ id: 'copyright-law-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'consumer-protection',
                title: '中华人民共和国消费者权益保护法',
                chapters: [{ id: 'consumer-protection-main', title: '全文', fileName: 'README.md' }]
            }
        ]
    },
    {
        id: 'criminal-law',
        name: '刑法',
        icon: '⚔️',
        laws: [
            {
                id: 'criminal-law-main',
                title: '中华人民共和国刑法',
                description: '1979年7月1日第五届全国人民代表大会第二次会议通过',
                chapters: [
                    { id: 'criminal-law-1', title: '第一编 总则', fileName: 'README.md' },
                ]
            },
            {
                id: 'anti-organized-crime',
                title: '中华人民共和国反有组织犯罪法',
                chapters: [{ id: 'anti-organized-crime-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'anti-telecom-fraud',
                title: '中华人民共和国反电信网络诈骗法',
                chapters: [{ id: 'anti-telecom-fraud-main', title: '全文', fileName: 'README.md' }]
            }
        ]
    },
    {
        id: 'procedural',
        name: '程序法',
        icon: '📑',
        laws: [
            {
                id: 'criminal-procedure',
                title: '中华人民共和国刑事诉讼法',
                chapters: [{ id: 'criminal-procedure-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'civil-procedure',
                title: '中华人民共和国民事诉讼法',
                chapters: [{ id: 'civil-procedure-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'administrative-procedure',
                title: '中华人民共和国行政诉讼法',
                chapters: [{ id: 'administrative-procedure-main', title: '全文', fileName: 'README.md' }]
            }
        ]
    },
    {
        id: 'administrative',
        name: '行政法',
        icon: '🏛️',
        laws: [
            {
                id: 'administrative-penalty',
                title: '中华人民共和国行政处罚法',
                chapters: [{ id: 'administrative-penalty-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'public-security-penalty',
                title: '中华人民共和国治安管理处罚法',
                chapters: [{ id: 'public-security-penalty-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'compulsory-education',
                title: '中华人民共和国义务教育法',
                chapters: [{ id: 'compulsory-education-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'environment-protection',
                title: '中华人民共和国环境保护法',
                chapters: [{ id: 'environment-protection-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'wildlife-protection',
                title: '中华人民共和国野生动物保护法',
                chapters: [{ id: 'wildlife-protection-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'infectious-disease',
                title: '中华人民共和国传染病防治法',
                chapters: [{ id: 'infectious-disease-main', title: '全文', fileName: 'README.md' }]
            }
        ]
    },
    {
        id: 'economic',
        name: '经济法',
        icon: '💰',
        laws: [
            {
                id: 'individual-income-tax',
                title: '中华人民共和国个人所得税法',
                chapters: [{ id: 'individual-income-tax-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'cybersecurity',
                title: '中华人民共和国网络安全法',
                chapters: [{ id: 'cybersecurity-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'data-security',
                title: '中华人民共和国数据安全法',
                chapters: [{ id: 'data-security-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'personal-info-protection',
                title: '中华人民共和国个人信息保护法',
                chapters: [{ id: 'personal-info-protection-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'anti-monopoly',
                title: '中华人民共和国反垄断法',
                chapters: [{ id: 'anti-monopoly-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'seed-law',
                title: '中华人民共和国种子法',
                chapters: [{ id: 'seed-law-main', title: '全文', fileName: 'README.md' }]
            }
        ]
    },
    {
        id: 'social',
        name: '社会法',
        icon: '👨‍👩‍👧‍👦',
        laws: [
            {
                id: 'labor-law',
                title: '中华人民共和国劳动法',
                chapters: [{ id: 'labor-law-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'minors-protection',
                title: '中华人民共和国未成年人保护法',
                chapters: [{ id: 'minors-protection-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'juvenile-delinquency',
                title: '中华人民共和国预防未成年人犯罪法',
                chapters: [{ id: 'juvenile-delinquency-main', title: '全文', fileName: 'README.md' }]
            },
            {
                id: 'work-safety',
                title: '中华人民共和国安全生产法',
                chapters: [{ id: 'work-safety-main', title: '全文', fileName: 'README.md' }]
            }
        ]
    }
];

// 获取所有法律列表（用于搜索）
export const getAllLaws = (): { category: LawCategory; law: Law }[] => {
    const result: { category: LawCategory; law: Law }[] = [];
    lawCategories.forEach(category => {
        category.laws.forEach(law => {
            result.push({ category, law });
        });
    });
    return result;
};

// 搜索法律
export const searchLaws = (keyword: string): { category: LawCategory; law: Law }[] => {
    const lowerKeyword = keyword.toLowerCase();
    return getAllLaws().filter(({ law }) =>
        law.title.toLowerCase().includes(lowerKeyword) ||
        (law.description && law.description.toLowerCase().includes(lowerKeyword))
    );
};
