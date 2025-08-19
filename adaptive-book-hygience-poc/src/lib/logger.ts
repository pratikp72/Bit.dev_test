/**
 * Comprehensive logging utility that respects environment variables
 * and provides different log levels for development and production
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  enableDebugger: boolean;
  enableTimestamps: boolean;
  enableColors: boolean;
  prefix?: string;
}

class Logger {
  private config: LoggerConfig;

  constructor() {
    this.config = this.initializeConfig();
  }

  private initializeConfig(): LoggerConfig {
    // Get environment variables with fallbacks
    const isDevelopment = import.meta.env.MODE === 'development';
    const isProduction = import.meta.env.MODE === 'production';

    // Environment variable controls
    const logEnabled = import.meta.env.VITE_LOGGING_ENABLED !== 'false'; // Default to true
    const logLevel = this.parseLogLevel(import.meta.env.VITE_LOG_LEVEL);
    const debuggerEnabled = import.meta.env.VITE_ENABLE_DEBUGGER === 'true' || isDevelopment;
    const timestampsEnabled = import.meta.env.VITE_LOG_TIMESTAMPS !== 'false'; // Default to true
    const colorsEnabled = import.meta.env.VITE_LOG_COLORS !== 'false' && !isProduction; // Default to true in dev
    const logPrefix = import.meta.env.VITE_LOG_PREFIX || '[APP]';

    return {
      enabled: logEnabled && (isDevelopment || import.meta.env.VITE_PROD_LOGGING === 'true'),
      level: logLevel,
      enableDebugger: debuggerEnabled,
      enableTimestamps: timestampsEnabled,
      enableColors: colorsEnabled,
      prefix: logPrefix
    };
  }

  private parseLogLevel(levelStr?: string): LogLevel {
    if (!levelStr) {
      return import.meta.env.MODE === 'development' ? LogLevel.DEBUG : LogLevel.WARN;
    }

    switch (levelStr.toUpperCase()) {
      case 'ERROR': return LogLevel.ERROR;
      case 'WARN': return LogLevel.WARN;
      case 'INFO': return LogLevel.INFO;
      case 'DEBUG': return LogLevel.DEBUG;
      case 'TRACE': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.config.enabled && level <= this.config.level;
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): [string, ...any[]] {
    const parts: string[] = [];

    if (this.config.enableTimestamps) {
      parts.push(new Date().toISOString());
    }

    if (this.config.prefix) {
      parts.push(this.config.prefix);
    }

    const levelName = LogLevel[level];
    if (this.config.enableColors) {
      const coloredLevel = this.colorizeLevel(levelName, level);
      parts.push(`[${coloredLevel}]`);
    } else {
      parts.push(`[${levelName}]`);
    }

    const prefix = parts.join(' ');
    return [`${prefix} ${message}`, ...args];
  }

  private colorizeLevel(levelName: string, level: LogLevel): string {
    const colors = {
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.INFO]: '\x1b[36m',  // Cyan
      [LogLevel.DEBUG]: '\x1b[35m', // Magenta
      [LogLevel.TRACE]: '\x1b[37m'  // White
    };
    const reset = '\x1b[0m';
    return `${colors[level]}${levelName}${reset}`;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.ERROR, message, ...args);
      console.error(formattedMsg, ...formattedArgs);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.WARN, message, ...args);
      console.warn(formattedMsg, ...formattedArgs);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.INFO, message, ...args);
      console.log(formattedMsg, ...formattedArgs);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.DEBUG, message, ...args);
      console.log(formattedMsg, ...formattedArgs);
    }
  }

  trace(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      const [formattedMsg, ...formattedArgs] = this.formatMessage(LogLevel.TRACE, message, ...args);
      console.log(formattedMsg, ...formattedArgs);
    }
  }

  /**
   * Debugger breakpoint that only triggers in development when enabled
   */
  debugBreak(message?: string): void {
    if (this.config.enableDebugger) {
      if (message) {
        this.debug(`DEBUGGER: ${message}`);
      }
      // eslint-disable-next-line no-debugger
      debugger;
    }
  }

  /**
   * Group logging for better organization
   */
  group(label: string): void {
    if (this.config.enabled) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (this.config.enabled) {
      console.groupEnd();
    }
  }

  /**
   * Table logging for structured data
   */
  table(data: any): void {
    if (this.config.enabled && this.shouldLog(LogLevel.DEBUG)) {
      console.table(data);
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Export both the instance and the class for flexibility
export { logger, Logger };
export default logger;
