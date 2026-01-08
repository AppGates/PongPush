/**
 * Application Entry Point
 * Initializes the application and wires up dependencies
 */
import { getConfig } from './config/AppConfig';
import { UploadService } from './services';
import { UploadForm } from './ui';
import { createLogger } from './utils/logger';
import './style.css';

const logger = createLogger('App');

/**
 * Initialize application
 */
async function initApp(): Promise<void> {
  logger.info('Starting PongPush application');

  try {
    // Load configuration
    const config = getConfig();
    logger.debug('Configuration loaded', { hasToken: !!config.github.token });

    // Validate GitHub token is available
    if (!config.github.token) {
      logger.error('GitHub token not configured');
      showError('GitHub token nicht konfiguriert. Bitte kontaktieren Sie den Administrator.');
      return;
    }

    // Initialize services (Business Logic)
    const uploadService = new UploadService(config);
    logger.info('Upload service initialized');

    // Perform health check
    const health = await uploadService.healthCheck();
    if (!health.healthy) {
      logger.warn('GitHub API health check failed', { message: health.message });
      // Continue anyway - error will be shown on upload attempt
    } else {
      logger.info('GitHub API health check passed');
    }

    // Initialize UI
    new UploadForm(uploadService);
    logger.info('UI initialized');

    logger.info('PongPush initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize app', { error: error instanceof Error ? error.message : String(error) });
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
