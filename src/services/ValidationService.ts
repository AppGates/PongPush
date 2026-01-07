/**
 * Validation Service - Business Logic Layer
 * This can be moved to backend without changes
 */
import { ValidationResult, ValidationError } from '../models';
import { AppConfig } from '../config/AppConfig';

export class ValidationService {
  constructor(private config: AppConfig) {}

  /**
   * Validate upload file
   * Business logic that can run on frontend or backend
   */
  validateFile(file: File): ValidationResult {
    const errors: ValidationError[] = [];

    // Validate file exists
    if (!file) {
      errors.push({
        field: 'file',
        message: 'Keine Datei ausgewählt',
        code: 'FILE_REQUIRED',
      });
      return { isValid: false, errors };
    }

    // Validate file size
    if (file.size > this.config.upload.maxSizeBytes) {
      const maxSizeMB = this.config.upload.maxSizeBytes / (1024 * 1024);
      errors.push({
        field: 'file',
        message: `Datei ist zu groß (Maximum ${maxSizeMB}MB)`,
        code: 'FILE_TOO_LARGE',
      });
    }

    // Validate file type by extension
    const extension = this.getFileExtension(file.name);
    if (!this.config.upload.allowedExtensions.includes(extension)) {
      errors.push({
        field: 'file',
        message: `Dateiformat nicht erlaubt. Erlaubt: ${this.config.upload.allowedExtensions.join(', ')}`,
        code: 'INVALID_FILE_TYPE',
      });
    }

    // Validate MIME type
    if (!this.config.upload.allowedMimeTypes.includes(file.type)) {
      errors.push({
        field: 'file',
        message: 'Nur Bilddateien sind erlaubt',
        code: 'INVALID_MIME_TYPE',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitize filename for safe storage
   */
  sanitizeFilename(filename: string): string {
    return filename
      .replace(/\s+/g, '_')
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/Ä/g, 'Ae')
      .replace(/Ö/g, 'Oe')
      .replace(/Ü/g, 'Ue')
      .replace(/[^a-zA-Z0-9._-]/g, '');
  }

  /**
   * Generate unique filename with timestamp
   */
  generateFilename(originalFilename: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' +
                      new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('-')[0];
    const extension = this.getFileExtension(originalFilename);
    const nameWithoutExt = originalFilename.substring(0, originalFilename.lastIndexOf('.')) || originalFilename;
    const sanitized = this.sanitizeFilename(nameWithoutExt);

    return `spielbericht_${timestamp}_${sanitized}${extension}`;
  }

  private getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.substring(lastDot).toLowerCase() : '';
  }
}
