/**
 * Request DTO for photo upload
 * Can be shared between frontend and backend
 */
export interface UploadRequest {
  file: File;
  metadata?: {
    description?: string;
    timestamp?: Date;
  };
}

/**
 * Internal representation after processing
 */
export interface ProcessedUpload {
  fileName: string;
  fileContent: Uint8Array;
  contentType: string;
  size: number;
}
