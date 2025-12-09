import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip, Packer } from 'docx';
import { saveAs } from 'file-saver';

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

export async function exportCaseToWord(caseData: CaseData) {
  try {
    const sections: Paragraph[] = [];

    // 标题
    sections.push(
      new Paragraph({
        text: caseData.title,
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    // 基本信息标题
    sections.push(
      new Paragraph({
        text: '案件基本信息',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 }
      })
    );

    // 基本信息内容
    const basicInfo = [
      `案号：${caseData.caseNumber}`,
      `法院：${caseData.court}`,
      `案件类型：${caseData.caseType || '民事案件'}`,
      `案由：${caseData.causeName || caseData.cause || '-'}`,
      `文书类型：${caseData.judgementType}`,
      `判决日期：${caseData.judgementDate}`,
      `审理程序：${caseData.levelOfTrial}`
    ];

    basicInfo.forEach(info => {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: info,
              size: 24
            })
          ],
          spacing: { after: 100 }
        })
      );
    });

    // 案情详情
    sections.push(
      new Paragraph({
        text: '案情详情',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 }
      })
    );

    // 处理详细内容
    if (caseData.detail?.data?.docResult) {
      const docResult = caseData.detail.data.docResult;
      for (const section of docResult) {
        if (section.label && section.text) {
          // 章节标题
          sections.push(
            new Paragraph({
              text: section.label,
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 }
            })
          );

          // 清理HTML标签
          const cleanText = section.text
            .replace(/<em>/g, '')
            .replace(/<\/em>/g, '')
            .replace(/<strong>/g, '')
            .replace(/<\/strong>/g, '')
            .replace(/<[^>]+>/g, '')
            .trim();

          // 按段落分割
          const paragraphs = cleanText.split('\n').filter(p => p.trim());
          paragraphs.forEach(para => {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: para.trim(),
                    size: 22
                  })
                ],
                spacing: { after: 150 }
              })
            );
          });
        }
      }
    } else if (caseData.content) {
      // 如果没有详细内容，使用简要内容
      const cleanContent = caseData.content
        .replace(/<em>/g, '')
        .replace(/<\/em>/g, '')
        .replace(/<strong>/g, '')
        .replace(/<\/strong>/g, '')
        .replace(/<[^>]+>/g, '')
        .trim();

      const paragraphs = cleanContent.split('\n').filter(p => p.trim());
      paragraphs.forEach(para => {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: para.trim(),
                size: 22
              })
            ],
            spacing: { after: 150 }
          })
        );
      });
    }

    // 时间轴
    if (caseData.detail?.data?.timelineNodes && caseData.detail.data.timelineNodes.length > 0) {
      sections.push(
        new Paragraph({
          text: '审理时间轴',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 400, after: 200 }
        })
      );

      caseData.detail.data.timelineNodes.slice(0, 5).forEach((node: any) => {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${node.date || node.time}：${node.event || node.description}`,
                size: 22
              })
            ],
            spacing: { after: 100 }
          })
        );
      });
    }

    // 免责声明
    sections.push(
      new Paragraph({
        text: '',
        spacing: { before: 400 }
      })
    );
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: '法律提示：',
            bold: true,
            size: 22
          }),
          new TextRun({
            text: '本案例由法律案例库提供，仅供学习参考。每个案件具有特殊性，具体法律问题请咨询专业律师或法律机构，以获得针对性的法律意见。',
            size: 22,
            italics: true
          })
        ],
        spacing: { before: 200 }
      })
    );

    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1)
              }
            }
          },
          children: sections
        }
      ]
    });

    // 生成并下载文件
    const blob = await Packer.toBlob(doc);
    const fileName = `${caseData.caseNumber.replace(/[\/\\:*?"<>|]/g, '-')}.docx`;
    saveAs(blob, fileName);

    return true;
  } catch (error) {
    console.error('导出Word文档失败:', error);
    throw error;
  }
}

