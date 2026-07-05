import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

interface LoggedRequest extends Request {
  startTime?: number;
  requestId?: string;
}

export const requestLoggingMiddleware = (req: LoggedRequest, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();
  req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Log incoming request
  Logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length'],
    headers: {
      accept: req.headers.accept,
      origin: req.headers.origin,
      referer: req.headers.referer
    }
  });

  // Override res.json to log responses
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    const responseTime = Date.now() - (req.startTime || Date.now());
    
    Logger.info('Response sent', {
      requestId: req.requestId,
      statusCode: res.statusCode,
      responseTime,
      contentType: res.getHeader('content-type'),
      hasBody: !!body,
      bodyType: typeof body,
      bodySize: body ? JSON.stringify(body).length : 0
    });

    return originalJson(body);
  };

  // Override res.end to log SSE responses
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any) {
    if (req.url?.includes('/agent/chat') && req.headers.accept?.includes('text/event-stream')) {
      const responseTime = Date.now() - (req.startTime || Date.now());
      
      Logger.info('SSE response completed', {
        requestId: req.requestId,
        statusCode: res.statusCode,
        responseTime,
        contentType: res.getHeader('content-type')
      });
    }

    return originalEnd(chunk);
  };

  next();
};

export const errorLoggingMiddleware = (err: Error, req: LoggedRequest, res: Response, next: NextFunction): void => {
  const responseTime = Date.now() - (req.startTime || Date.now());
  
  Logger.error('Request error', err, {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  });

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal server error' });
  } else {
    res.status(500).json({ 
      error: err.message,
      stack: err.stack,
      requestId: req.requestId
    });
  }
};

export const performanceLoggingMiddleware = (req: LoggedRequest, res: Response, next: NextFunction): void => {
  const originalSend = res.send.bind(res);
  const originalJson = res.json.bind(res);
  
  const logPerformance = () => {
    const responseTime = Date.now() - (req.startTime || Date.now());
    const memoryUsage = process.memoryUsage();
    
    // Log performance metrics for slow requests (>1000ms)
    if (responseTime > 1000) {
      Logger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.url,
        responseTime,
        memoryUsage: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024)
        }
      });
    }

    // Log detailed performance for chat endpoints
    if (req.url?.includes('/agent/chat')) {
      Logger.logPerformanceMetrics(req.requestId || 'unknown', {
        processingTime: responseTime,
        memoryUsage: memoryUsage.heapUsed / 1024 / 1024
      });
    }
  };

  res.send = function(body: any) {
    logPerformance();
    return originalSend(body);
  };

  res.json = function(body: any) {
    logPerformance();
    return originalJson(body);
  };

  next();
};