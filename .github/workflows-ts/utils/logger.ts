/**
 * Logging utility for GitHub Actions workflows
 * Provides structured logging with file output and console display
 */

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'success' | 'debug';

export interface LoggerOptions {
  logFile?: string;
  prefix?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
}

export class Logger {
  private logFile?: string;
  private prefix: string;
  private enableConsole: boolean;
  private enableFile: boolean;

  constructor(options: LoggerOptions = {}) {
    this.logFile = options.logFile;
    this.prefix = options.prefix || '';
    this.enableConsole = options.enableConsole !== false;
    this.enableFile = options.enableFile !== false;

    // Ensure log directory exists if logFile is specified
    if (this.logFile && this.enableFile) {
      const dir = dirname(this.logFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      // Initialize with empty file
      writeFileSync(this.logFile, '');
    }
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = level.toUpperCase().padEnd(7);
    const prefixStr = this.prefix ? `[${this.prefix}] ` : '';
    return `${timestamp} ${levelStr} ${prefixStr}${message}`;
  }

  private getIcon(level: LogLevel): string {
    switch (level) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'debug': return '🔍';
      default: return '📝';
    }
  }

  private log(level: LogLevel, message: string): void {
    const formattedMessage = this.formatMessage(level, message);
    const consoleMessage = `${this.getIcon(level)} ${message}`;

    if (this.enableConsole) {
      console.log(consoleMessage);
    }

    if (this.logFile && this.enableFile) {
      appendFileSync(this.logFile, formattedMessage + '\n');
    }
  }

  info(message: string): void {
    this.log('info', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  success(message: string): void {
    this.log('success', message);
  }

  debug(message: string): void {
    this.log('debug', message);
  }

  section(title: string): void {
    const separator = '='.repeat(title.length + 8);
    this.info('');
    this.info(separator);
    this.info(`=== ${title} ===`);
    this.info(separator);
    this.info('');
  }

  subsection(title: string): void {
    this.info('');
    this.info(`--- ${title} ---`);
  }

  /**
   * Log raw text without formatting (useful for command output)
   */
  raw(text: string): void {
    if (this.enableConsole) {
      console.log(text);
    }
    if (this.logFile && this.enableFile) {
      appendFileSync(this.logFile, text + '\n');
    }
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      logFile: this.logFile,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      enableConsole: this.enableConsole,
      enableFile: this.enableFile,
    });
  }

  /**
   * Get the log file path
   */
  getLogFile(): string | undefined {
    return this.logFile;
  }
}
