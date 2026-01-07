/**
 * Upload Form Controller - Presentation Layer
 * Coordinates UI interactions with business logic
 * When moved to backend, this would call REST API instead of services directly
 */
import { UploadService } from '../services';
import { UploadRequest } from '../models';
import { UIController } from './UIController';

export class UploadForm {
  private ui: UIController;
  private uploadService: UploadService;

  constructor(uploadService: UploadService) {
    this.uploadService = uploadService;
    this.ui = new UIController();
    this.setupEventHandlers();
  }

  /**
   * Initialize event handlers
   */
  private setupEventHandlers(): void {
    // Handle file selection
    this.ui.onFileChange((file) => this.handleFileChange(file));

    // Handle remove button
    this.ui.onRemoveClick(() => this.handleRemove());

    // Handle form submission
    this.ui.onSubmit((e) => this.handleSubmit(e));

    // Prevent accidental page refresh
    this.setupBeforeUnload();
  }

  /**
   * Handle file selection
   */
  private handleFileChange(file: File): void {
    // Basic client-side validation (UI feedback)
    if (!file.type.startsWith('image/')) {
      this.ui.showError('Bitte wählen Sie eine Bilddatei aus.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      this.ui.showError('Die Datei ist zu groß. Maximum 10MB erlaubt.');
      return;
    }

    // Show preview
    this.ui.showPreview(file);
  }

  /**
   * Handle remove button click
   */
  private handleRemove(): void {
    this.ui.clearPreview();
  }

  /**
   * Handle form submission
   * NOTE: When migrating to backend, replace service call with fetch() to REST API
   */
  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();

    const file = this.ui.getSelectedFile();
    if (!file) {
      this.ui.showError('Bitte wählen Sie eine Datei aus.');
      return;
    }

    // Show loading state
    this.ui.showLoading();

    try {
      // Create upload request
      const request: UploadRequest = {
        file,
        metadata: {
          timestamp: new Date(),
        },
      };

      // Call business logic
      // TODO: When migrating to backend, replace this with:
      // const response = await fetch('/api/upload', {
      //   method: 'POST',
      //   body: formData,
      // });
      const response = await this.uploadService.upload(request);

      if (response.success) {
        this.ui.showSuccess(response.message, response.data?.fileName);

        // Reset form after successful upload
        setTimeout(() => {
          this.ui.clearPreview();
        }, 5000);
      } else {
        this.ui.showError(response.error?.details || 'Fehler beim Hochladen');
        this.ui.enableSubmit();
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      this.ui.showError('Netzwerkfehler. Bitte versuchen Sie es erneut.');
      this.ui.enableSubmit();
    } finally {
      this.ui.hideLoading();
    }
  }

  /**
   * Warn user before leaving with unsaved changes
   */
  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', (e) => {
      const file = this.ui.getSelectedFile();
      if (file) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }
}
