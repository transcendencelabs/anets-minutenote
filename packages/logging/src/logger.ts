// ============================================================================
// MeetScribe Structured Logger
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
}

export interface LoggerOptions {
  level: LogLevel;
  context?: Record<string, unknown>;
  correlationId?: string;
  transport?: LogTransport;
}

export interface LogTransport {
  send(entry: LogEntry): void;
}

/** Console-based log transport (default) */
export class ConsoleTransport implements LogTransport {
  public send(entry: LogEntry): void {
    const { level, message, ...rest } = entry;
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    const correlationPrefix = entry.correlationId
      ? ` [${entry.correlationId}]`
      : '';

    const formattedMessage = `${prefix}${correlationPrefix} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, rest.context ?? '');
        break;
      case 'info':
        console.info(formattedMessage, rest.context ?? '');
        break;
      case 'warn':
        console.warn(formattedMessage, rest.context ?? '');
        break;
      case 'error':
        console.error(formattedMessage, rest.context ?? '');
        break;
    }
  }
}

/** Structured logger with correlation IDs and context */
export class Logger {
  private level: LogLevel;
  private context: Record<string, unknown>;
  private correlationId?: string;
  private transport: LogTransport;

  constructor(options: Partial<LoggerOptions> = {}) {
    this.level = options.level ?? 'info';
    this.context = options.context ?? {};
    this.correlationId = options.correlationId;
    this.transport = options.transport ?? new ConsoleTransport();
  }

  /** Create a child logger with additional context */
  public child(context: Record<string, unknown>, correlationId?: string): Logger {
    return new Logger({
      level: this.level,
      context: { ...this.context, ...context },
      correlationId: correlationId ?? this.correlationId,
      transport: this.transport,
    });
  }

  /** Set or update the correlation ID for this logger */
  public setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /** Set the minimum log level */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.level]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      context: { ...this.context, ...context },
    };

    this.transport.send(entry);
  }
}

/** Default singleton logger instance */
export const logger = new Logger();