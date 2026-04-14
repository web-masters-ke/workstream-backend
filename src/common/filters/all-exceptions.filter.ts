import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errResp =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const message =
      typeof errResp === 'string'
        ? errResp
        : (errResp as any).message || 'Error';

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${status}: ${JSON.stringify(errResp)}`,
        (exception as Error)?.stack,
      );
    }

    res.status(status).json({
      success: false,
      error: {
        code: status,
        message,
        details: typeof errResp === 'object' ? errResp : undefined,
      },
      timestamp: new Date().toISOString(),
      path: req.url,
    });
  }
}
