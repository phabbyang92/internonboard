import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { RequestWithId } from '../http/request-id.middleware';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<RequestWithId>();
    const safePath = request.path || request.url.split('?')[0];
    const requestId = request.requestId;

    const isHttpException = exception instanceof HttpException;

    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionBody = isHttpException ? exception.getResponse() : null;

    let message: string | string[] = 'Internal server error';
    let code: string | undefined;

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

      if ('code' in exceptionBody && typeof exceptionBody.code === 'string') {
        code = exceptionBody.code;
      }
    }

    if (status >= 500) {
      const errorMessage =
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception);

      this.logger.error(
        `event=http_request_failed method=${request.method} path=${safePath} ` +
          `status=${status} requestId=${requestId ?? 'unavailable'}`,
        errorMessage,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      ...(code ? { code } : {}),
      message,
      // Query parameters may contain storage keys or other private metadata.
      path: safePath,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    });
  }
}
