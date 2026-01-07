/**
 * Application Entry Point
 * Initializes the application and wires up dependencies
 */
import { getConfig } from './config/AppConfig';
import { UploadService } from './services';
import { UploadForm } from './ui';
import './style.css';

/**
 * Initialize application
 */
async function initApp(): Promise<void> {
  try {
    // Load configuration
    const config = getConfig();

    // Validate GitHub token is available
    if (!config.github.token) {
      showError('GitHub token nicht konfiguriert. Bitte kontaktieren Sie den Administrator.');
      return;
    }

    // Initialize services (Business Logic)
    const uploadService = new UploadService(config);

    // Perform health check
    const health = await uploadService.healthCheck();
    if (!health.healthy) {
      console.warn('GitHub API health check failed:', health.message);
      // Continue anyway - error will be shown on upload attempt
    }

    // Initialize UI
    new UploadForm(uploadService);

    console.log('PongPush initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Fehler beim Laden der Anwendung. Bitte laden Sie die Seite neu.');
  }
}

/**
 * Show error message on page
 */
function showError(message: string): void {
  const messageDiv = document.getElementById('message');
  if (messageDiv) {
    messageDiv.innerHTML = `❌ ${message}`;
    messageDiv.className = 'message error';
    messageDiv.classList.remove('hidden');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Export for potential testing
export { initApp };
