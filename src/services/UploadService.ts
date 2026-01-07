/**
 * Upload Service - Business Logic Layer
 * Orchestrates the upload process
 * This entire class can be moved to backend without changes
 */
import { UploadRequest, UploadResponse, ProcessedUpload } from '../models';
import { AppConfig } from '../config/AppConfig';
import { ValidationService } from './ValidationService';
import { GitHubApiClient } from './GitHubApiClient';

export class UploadService {
  private validationService: ValidationService;
  private githubClient: GitHubApiClient;

  constructor(private config: AppConfig) {
    this.validationService = new ValidationService(config);
    this.githubClient = new GitHubApiClient(config);
  }

  /**
   * Main upload method
   * Complete business logic that can run on frontend or backend
   */
  async upload(request: UploadRequest): Promise<UploadResponse> {
    try {
      // Step 1: Validate file
      const validationResult = this.validationService.validateFile(request.file);
      if (!validationResult.isValid) {
        return {
          success: false,
          message: 'Validierung fehlgeschlagen',
          error: {
            code: 'VALIDATION_ERROR',
            details: validationResult.errors.map((e) => e.message).join(', '),
          },
        };
      }

      // Step 2: Process file (read content, generate filename)
      const processed = await this.processFile(request.file);

      // Step 3: Generate file path
      const filePath = `${this.config.github.uploadPath}/${processed.fileName}`;

      // Step 4: Convert to base64 for GitHub API
      const base64Content = this.arrayBufferToBase64(processed.fileContent);

      // Step 5: Upload to GitHub
      const result = await this.githubClient.uploadFile({
        filePath,
        content: base64Content,
        message: `Upload: ${processed.fileName}`,
        branch: this.config.github.branch,
      });

      // Step 6: Return success response
      return {
        success: true,
        message: 'Spielbericht erfolgreich hochgeladen!',
        data: {
          fileName: processed.fileName,
          filePath,
          url: result.htmlUrl,
          sha: result.sha,
        },
      };
    } catch (error: any) {
      console.error('Upload error:', error);
      return {
        success: false,
        message: 'Upload fehlgeschlagen',
        error: {
          code: 'UPLOAD_ERROR',
          details: error.message || 'Unbekannter Fehler',
        },
      };
    }
  }

  /**
   * Process file - read content and generate filename
   * Pure business logic
   */
  private async processFile(file: File): Promise<ProcessedUpload> {
    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const fileContent = new Uint8Array(arrayBuffer);

    // Generate unique filename
    const fileName = this.validationService.generateFilename(file.name);

    return {
      fileName,
      fileContent,
      contentType: file.type,
      size: file.size,
    };
  }

  /**
   * Convert ArrayBuffer to base64
   * Utility method that works in both browser and Node.js
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    // In browser
    if (typeof window !== 'undefined' && window.btoa) {
      let binary = '';
      const len = buffer.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(buffer[i]);
      }
      return window.btoa(binary);
    }

    // In Node.js (for backend migration)
    // @ts-ignore - Buffer is available in Node.js
    if (typeof Buffer !== 'undefined') {
      // @ts-ignore
      return Buffer.from(buffer).toString('base64');
    }

    throw new Error('Base64 encoding not supported in this environment');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const result = await this.githubClient.healthCheck();
      return {
        healthy: result.hasAccess,
        message: result.message,
      };
    } catch (error: any) {
      return {
        healthy: false,
        message: error.message,
      };
    }
  }
}
