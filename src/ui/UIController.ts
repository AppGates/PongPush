/**
 * UI Controller - Presentation Layer
 * Handles DOM manipulation and user interactions
 * This stays in frontend when business logic moves to backend
 */
export class UIController {
  private photoInput: HTMLInputElement;
  private preview: HTMLElement;
  private previewImage: HTMLImageElement;
  private removeBtn: HTMLButtonElement;
  private submitBtn: HTMLButtonElement;
  private messageDiv: HTMLElement;
  private btnText: HTMLElement;
  private btnLoading: HTMLElement;

  constructor() {
    // Get DOM elements
    this.photoInput = document.getElementById('photoInput') as HTMLInputElement;
    this.preview = document.getElementById('preview') as HTMLElement;
    this.previewImage = document.getElementById('previewImage') as HTMLImageElement;
    this.removeBtn = document.getElementById('removeBtn') as HTMLButtonElement;
    this.submitBtn = document.getElementById('submitBtn') as HTMLButtonElement;
    this.messageDiv = document.getElementById('message') as HTMLElement;
    this.btnText = this.submitBtn.querySelector('.btn-text') as HTMLElement;
    this.btnLoading = this.submitBtn.querySelector('.btn-loading') as HTMLElement;

    this.validateElements();
  }

  private validateElements(): void {
    const elements = {
      photoInput: this.photoInput,
      preview: this.preview,
      previewImage: this.previewImage,
      removeBtn: this.removeBtn,
      submitBtn: this.submitBtn,
      messageDiv: this.messageDiv,
      btnText: this.btnText,
      btnLoading: this.btnLoading,
    };

    for (const [name, element] of Object.entries(elements)) {
      if (!element) {
        throw new Error(`Required element not found: ${name}`);
      }
    }
  }

  /**
   * Show file preview
   */
  showPreview(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewImage.src = e.target?.result as string;
      this.preview.classList.remove('hidden');
      this.submitBtn.disabled = false;
    };
    reader.readAsDataURL(file);
    this.hideMessage();
  }

  /**
   * Clear preview and reset form
   */
  clearPreview(): void {
    this.photoInput.value = '';
    this.preview.classList.add('hidden');
    this.previewImage.src = '';
    this.submitBtn.disabled = true;
    this.hideMessage();
  }

  /**
   * Show loading state during upload
   */
  showLoading(): void {
    this.btnText.classList.add('hidden');
    this.btnLoading.classList.remove('hidden');
    this.submitBtn.disabled = true;
  }

  /**
   * Hide loading state after upload
   */
  hideLoading(): void {
    this.btnText.classList.remove('hidden');
    this.btnLoading.classList.add('hidden');
  }

  /**
   * Enable submit button
   */
  enableSubmit(): void {
    this.submitBtn.disabled = false;
  }

  /**
   * Show success message
   */
  showSuccess(message: string, fileName?: string): void {
    let html = `✅ ${message}`;
    if (fileName) {
      html += `<br><small>Datei: ${fileName}</small>`;
    }
    this.showMessage(html, 'success');
  }

  /**
   * Show error message
   */
  showError(message: string): void {
    this.showMessage(`❌ ${message}`, 'error');
  }

  /**
   * Show generic message
   */
  private showMessage(html: string, type: 'success' | 'error'): void {
    this.messageDiv.innerHTML = html;
    this.messageDiv.className = `message ${type}`;
    this.messageDiv.classList.remove('hidden');
  }

  /**
   * Hide message
   */
  hideMessage(): void {
    this.messageDiv.classList.add('hidden');
    this.messageDiv.className = 'message hidden';
  }

  /**
   * Get selected file
   */
  getSelectedFile(): File | null {
    return this.photoInput.files?.[0] || null;
  }

  /**
   * Setup event listeners
   */
  onFileChange(callback: (file: File) => void): void {
    this.photoInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        callback(file);
      }
    });
  }

  onRemoveClick(callback: () => void): void {
    this.removeBtn.addEventListener('click', callback);
  }

  onSubmit(callback: (e: Event) => void): void {
    const form = document.getElementById('uploadForm') as HTMLFormElement;
    form.addEventListener('submit', callback);
  }
}
