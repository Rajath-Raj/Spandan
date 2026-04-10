import axios, { AxiosRequestConfig } from 'axios';
import { injectable } from 'inversify';
import { HttpError } from 'routing-controllers';
import { aiConfig } from '#root/config/ai.js';

@injectable()
export class EmbeddingService {
  private readonly llmApiUrl = `http://${aiConfig.serverIP}:${aiConfig.serverPort}/api/embeddings`;
  
  public async embed(text: string, model = 'nomic-embed-text'): Promise<number[]> {
    try {
      console.log(`[EmbeddingService] Getting embeddings from ${this.llmApiUrl} using model ${model}`);
      
      const response = await axios.post(
        this.llmApiUrl,
        {
          model,
          prompt: text
        },
        { timeout: 30000 }
      );

      if (response.data && response.data.embedding) {
        return response.data.embedding;
      } else {
        throw new Error('No embedding returned from Ollama');
      }
    } catch (error: any) {
      console.error(`[EmbeddingService] Error getting embeddings:`, error.message);
      if (axios.isAxiosError(error) && error.code === 'ECONNREFUSED') {
        throw new HttpError(503, `Connection to Ollama server refused. Ensure Ollama is running at ${aiConfig.serverIP}:${aiConfig.serverPort}.`);
      }
      throw new HttpError(500, `Failed to generate embeddings: ${error.message}`);
    }
  }
}
