/**
 * Response DTO for upload operation
 * Can be shared between frontend and backend
 */
export interface UploadResponse {
  success: boolean;
  message: string;
  data?: {
    fileName: string;
    filePath: string;
    url: string;
    sha?: string;
  };
  error?: {
    code: string;
    details: string;
  };
}
