import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// 配置 PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * 读取 PDF 文件内容
 */
export async function readPDFFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const textPromises: Promise<string>[] = [];
    
    // 读取所有页面
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      textPromises.push(readPDFPage(pdf, pageNum));
    }
    
    const pageTexts = await Promise.all(textPromises);
    return pageTexts.join('\n\n');
  } catch (error) {
    console.error('PDF 读取失败:', error);
    throw new Error('PDF 文件读取失败，请确保文件未损坏');
  }
}

/**
 * 读取 PDF 单页内容
 */
async function readPDFPage(pdf: any, pageNum: number): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const textContent = await page.getTextContent();
  const pageText = textContent.items
    .map((item: any) => item.str)
    .join(' ');
  return pageText.replace(/\s+/g, ' ').trim();
}

/**
 * 读取 Word (DOCX) 文件内容
 */
export async function readWordFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (result.messages && result.messages.length > 0) {
      console.warn('Word 文档解析警告:', result.messages);
    }
    
    return result.value.trim();
  } catch (error) {
    console.error('Word 读取失败:', error);
    throw new Error('Word 文件读取失败，请确保文件格式正确');
  }
}

/**
 * 根据文件类型读取文档内容
 */
export async function readDocumentFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    return readPDFFile(file);
  } else if (
    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileName.endsWith('.docx')
  ) {
    return readWordFile(file);
  } else {
    throw new Error('不支持的文件格式，仅支持 PDF 和 DOCX 文件');
  }
}

/**
 * 验证文件类型
 */
export function validateDocumentFile(file: File): boolean {
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  const allowedExtensions = ['.pdf', '.docx'];
  
  const fileName = file.name.toLowerCase();
  const hasValidType = allowedTypes.includes(file.type);
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
  
  return hasValidType || hasValidExtension;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
