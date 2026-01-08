/**
 * Common logging framework for PongPush
 *
 * Provides structured logging that can be captured in CI environments.
 * All logs are written to console and can be redirected to files in CI.
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
}

class Logger {
  private component: string;
  private isCI: boolean;

  constructor(component: string) {
    this.component = component;
    this.isCI = typeof process !== 'undefined' && process.env?.CI === 'true';
  }

  /**
   * Format log entry for output
   */
  private formatLog(level: LogLevel, message: string, data?: unknown): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      data,
    };

    // In CI, use structured JSON format for easier parsing
    if (this.isCI) {
      return JSON.stringify(entry);
    }

    // In browser/dev, use human-readable format
    let output = `[${entry.timestamp}] [${level}] [${this.component}] ${message}`;
    if (data !== undefined) {
      output += ` ${JSON.stringify(data)}`;
    }
    return output;
  }

  debug(message: string, data?: unknown): void {
    const formatted = this.formatLog(LogLevel.DEBUG, message, data);
    console.debug(formatted);
  }

  info(message: string, data?: unknown): void {
    const formatted = this.formatLog(LogLevel.INFO, message, data);
    console.log(formatted);
  }

  warn(message: string, data?: unknown): void {
    const formatted = this.formatLog(LogLevel.WARN, message, data);
    console.warn(formatted);
  }

  error(message: string, data?: unknown): void {
    const formatted = this.formatLog(LogLevel.ERROR, message, data);
    console.error(formatted);
  }

  /**
   * Log an operation with timing
   */
  async timed<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    this.info(`Starting: ${operation}`);

    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.info(`Completed: ${operation}`, { durationMs: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`Failed: ${operation}`, {
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

/**
 * Create a logger for a specific component
 */
export function createLogger(component: string): Logger {
  return new Logger(component);
}

/**
 * Global logger for general use
 */
export const logger = createLogger('PongPush');
