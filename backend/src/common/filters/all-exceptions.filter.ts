import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;

    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionBody = isHttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';

    if (typeof exceptionBody === 'string') {
      message = exceptionBody;
    } else if (
      exceptionBody &&
      typeof exceptionBody === 'object' &&
      'message' in exceptionBody
    ) {
      const value = (exceptionBody as { message?: unknown }).message;

      if (typeof value === 'string' || Array.isArray(value)) {
        message = value as string | string[];
      }
    }

    if (status >= 500) {
      const errorMessage =
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception);

      this.logger.error(errorMessage);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
