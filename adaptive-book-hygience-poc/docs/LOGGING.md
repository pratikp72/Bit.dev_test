# Logging System Documentation

## Overview

This application uses a comprehensive logging system that adapts to different environments (development, production) and provides configurable log levels, debugging capabilities, and performance optimizations.

## Features

- **Environment-aware logging** - Automatically adapts behavior based on development/production modes
- **Configurable log levels** - Control verbosity through environment variables
- **Debugger integration** - Enable/disable debugger statements via environment variables
- **Structured logging** - Timestamps, colors, prefixes, and grouping support
- **Production safety** - Logs disabled by default in production for performance
- **Tree-shaking optimization** - Logging code removed in production builds
- **Multiple log levels** - ERROR, WARN, INFO, DEBUG, TRACE

## Environment Variables

### Core Logging Controls

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_LOGGING_ENABLED` | `true` | Master switch for all logging |
| `VITE_LOG_LEVEL` | `DEBUG` (dev), `WARN` (prod) | Minimum log level to output |
| `VITE_ENABLE_DEBUGGER` | `true` (dev), `false` (prod) | Enable debugger statements |
| `VITE_PROD_LOGGING` | `false` | Force enable logging in production |

### Formatting Options

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_LOG_TIMESTAMPS` | `true` | Include timestamps in log messages |
| `VITE_LOG_COLORS` | `true` (dev), `false` (prod) | Enable colored output |
| `VITE_LOG_PREFIX` | `[APP]` | Prefix for all log messages |

## Usage

### Basic Logging

```typescript
import logger from '../lib/logger';

// Different log levels
logger.error('Something went wrong', errorObject);
logger.warn('This is a warning');
logger.info('Informational message');
logger.debug('Debug information', { data: 'value' });
logger.trace('Detailed trace information');
```

### Debugger Integration

```typescript
import logger from '../lib/logger';

// Debugger that only triggers in development
logger.debugBreak('Check this state');

// Debugger with message
logger.debugBreak('User authentication failed - check token');
```

### Grouped Logging

```typescript
import logger from '../lib/logger';

logger.group('OAuth Processing');
logger.debug('Starting OAuth flow');
logger.info('Redirecting to provider');
logger.error('OAuth failed', error);
logger.groupEnd();
```

### Structured Data

```typescript
import logger from '../lib/logger';

// Table output for objects
logger.table({ 
  user: 'john@example.com', 
  status: 'active',
  lastLogin: new Date()
});
```

## Log Levels

### ERROR (0)
- Critical errors that require immediate attention
- Always logged unless logging is completely disabled
- Examples: API failures, authentication errors, data corruption

### WARN (1)
- Warnings about potential issues
- Default minimum level for production
- Examples: Deprecated API usage, missing optional data

### INFO (2)
- General informational messages
- Important application events
- Examples: User login, data fetch completion, state changes

### DEBUG (3)
- Detailed information for debugging
- Default level for development
- Examples: Variable states, function entry/exit, configuration values

### TRACE (4)
- Most verbose logging level
- Very detailed execution information
- Examples: Loop iterations, detailed object inspection

## Environment Configurations

### Development (.env.development)

```bash
# Enable all logging features for development
VITE_LOGGING_ENABLED=true
VITE_LOG_LEVEL=DEBUG
VITE_ENABLE_DEBUGGER=true
VITE_LOG_TIMESTAMPS=true
VITE_LOG_COLORS=true
VITE_LOG_PREFIX=[BOOK-HYGIENE-DEV]
```

### Production (.env.production)

```bash
# Disable logging for production performance
VITE_LOGGING_ENABLED=false
VITE_LOG_LEVEL=ERROR
VITE_ENABLE_DEBUGGER=false
VITE_LOG_TIMESTAMPS=false
VITE_LOG_COLORS=false
VITE_LOG_PREFIX=[BOOK-HYGIENE-PROD]
```

### Debugging Production Issues

```bash
# Temporarily enable logging in production
VITE_LOGGING_ENABLED=true
VITE_PROD_LOGGING=true
VITE_LOG_LEVEL=INFO
```

## Performance Considerations

### Development
- All logging features enabled for best developer experience
- Performance impact is acceptable for development

### Production
- Logging disabled by default for optimal performance
- Tree-shaking removes logging code from production bundles
- No runtime overhead when logging is disabled

### Bundle Optimization

The Vite configuration includes tree-shaking optimizations:

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      treeshake: {
        preset: "recommended",
        manualPureFunctions: ["console.log", "console.debug", "console.trace"],
      },
    },
  },
});
```

## Examples

### Component Logging

```typescript
import React, { useEffect } from 'react';
import logger from '../lib/logger';

const MyComponent: React.FC = () => {
  useEffect(() => {
    logger.group('MyComponent Initialization');
    logger.info('Component mounted');
    
    try {
      // Some operation
      logger.debug('Processing data');
    } catch (error) {
      logger.error('Component initialization failed', error);
      logger.debugBreak('Check component state');
    } finally {
      logger.groupEnd();
    }
  }, []);

  return <div>My Component</div>;
};
```

### Service Logging

```typescript
import logger from '../lib/logger';

class APIService {
  async fetchData() {
    logger.info('Starting data fetch');
    
    try {
      const response = await fetch('/api/data');
      logger.debug('Response received', { status: response.status });
      
      const data = await response.json();
      logger.info('Data fetch completed successfully');
      
      return data;
    } catch (error) {
      logger.error('Data fetch failed', error);
      throw error;
    }
  }
}
```

### Error Handling

```typescript
import logger from '../lib/logger';

const handleError = (error: Error) => {
  logger.group('Error Handler');
  logger.error('Unhandled error occurred', {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  
  if (process.env.NODE_ENV === 'development') {
    logger.debugBreak('Error details above');
  }
  
  logger.groupEnd();
};
```

## Best Practices

### 1. Use Appropriate Log Levels
- Use `error` for actual errors that need attention
- Use `warn` for potential issues
- Use `info` for important events
- Use `debug` for development information
- Use `trace` for very detailed debugging

### 2. Include Context
```typescript
// Good
logger.error('User authentication failed', { 
  userId: user.id, 
  attemptedAction: 'login',
  timestamp: Date.now()
});

// Avoid
logger.error('Authentication failed');
```

### 3. Use Grouping for Related Operations
```typescript
logger.group('File Upload Process');
logger.info('Starting upload');
logger.debug('File size', fileSize);
logger.info('Upload completed');
logger.groupEnd();
```

### 4. Leverage Debugger Integration
```typescript
// Instead of manual debugger statements
if (someCondition) {
  logger.debugBreak('Check someCondition state');
}
```

### 5. Performance-Conscious Logging
```typescript
// Expensive operations should be conditional
if (logger.shouldLog(LogLevel.DEBUG)) {
  logger.debug('Complex data', expensiveOperation());
}
```

## Troubleshooting

### Logs Not Appearing
1. Check `VITE_LOGGING_ENABLED` is set to `true`
2. Verify log level allows your messages (`VITE_LOG_LEVEL`)
3. Ensure you're not in production mode with logging disabled

### Debugger Not Working
1. Check `VITE_ENABLE_DEBUGGER` is set to `true`
2. Verify browser developer tools are open
3. Ensure you're in development mode

### Performance Issues
1. Disable logging in production (`VITE_LOGGING_ENABLED=false`)
2. Use higher log levels in production (`VITE_LOG_LEVEL=ERROR`)
3. Avoid expensive operations in log statements

## Migration from Console Statements

### Before
```typescript
console.log('User logged in');
console.error('API failed:', error);
debugger; // Manual debugger
```

### After
```typescript
logger.info('User logged in');
logger.error('API failed:', error);
logger.debugBreak('Check API response'); // Conditional debugger
```

## Integration with Other Tools

### Error Monitoring (Sentry, etc.)
```typescript
logger.error('Critical error', error);
// Sentry will automatically capture console.error calls
```

### Analytics
```typescript
logger.info('User action completed', {
  action: 'purchase',
  value: amount,
  userId: user.id
});
```

This logging system provides a robust foundation for debugging, monitoring, and maintaining your application across different environments while maintaining optimal performance.