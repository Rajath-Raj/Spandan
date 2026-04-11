import { injectable } from 'inversify';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { HttpError } from 'routing-controllers';

@injectable()
export class DocumentParserService {
  /**
   * Parse a document buffer (PDF or DOCX) into text.
   */
  public async parseDocument(buffer: Buffer, mimeType: string, originalName: string): Promise<string> {
    const isPdf = mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf');
    const isDocx =
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalName.toLowerCase().endsWith('.docx');

    // Guard unsupported types BEFORE the try/catch so the 400 isn't swallowed as 500
    if (!isPdf && !isDocx) {
      throw new HttpError(400, `Unsupported file type: ${mimeType || originalName}`);
    }

    try {
      if (isPdf) {
        const parser = new PDFParse({ data: new Uint8Array(buffer), verbosity: 0 });
        const result = await parser.getText();
        return result.text;
      } else {
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
      }
    } catch (error: any) {
      console.error(`[DocumentParserService] Error parsing document ${originalName}:`, error);
      throw new HttpError(500, `Failed to parse document: ${error.message}`);
    }
  }

  /**
   * Simple recursive character text splitter.
   * Splits by double newline, then newline, then space to keep chunks near target size.
   */
  public chunkText(text: string, maxTokens = 500, overlapTokens = 100): string[] {
    // Rough approximation: 1 token ~= 4 characters
    const chunkSize = maxTokens * 4;
    const overlapSize = overlapTokens * 4;
    
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let i = 0;
    
    while (i < text.length) {
      let end = i + chunkSize;
      
      // If we're not at the end of the text, try to find a nice breaking point
      if (end < text.length) {
        // Try to break at a paragraph
        let breakPoint = text.lastIndexOf('\n\n', end);
        if (breakPoint === -1 || breakPoint <= i) {
          // Fall back to sentence/newline
          breakPoint = text.lastIndexOf('\n', end);
        }
        if (breakPoint === -1 || breakPoint <= i) {
          // Fall back to space
          breakPoint = text.lastIndexOf(' ', end);
        }
        
        // If we found a valid break point, use it
        if (breakPoint !== -1 && breakPoint > i) {
          end = breakPoint;
        }
      }
      
      const chunk = text.substring(i, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }
      
      const previousI = i;
      i = end - overlapSize;
      
      // Ensure we always move forward
      if (i <= previousI) {
        i = previousI + 1;
      }
    }
    
    return chunks;
  }
}
