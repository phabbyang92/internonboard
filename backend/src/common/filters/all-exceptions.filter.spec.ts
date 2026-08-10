import {
  BadRequestException,
  type ArgumentsHost,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const createHost = (url: string) => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request = {
      method: 'GET',
      path: '/api/hr/students/student-id/attachments/download',
      url,
    } as Request;
    const response = { status } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    return { host, json, status };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not expose query parameters in HTTP error responses', () => {
    const { host, json, status } = createHost(
      '/api/hr/students/student-id/attachments/download?storageKey=private-key',
    );

    new AllExceptionsFilter().catch(
      new BadRequestException('invalid request'),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/api/hr/students/student-id/attachments/download',
      }),
    );
    expect(JSON.stringify(json.mock.calls)).not.toContain('private-key');
  });

  it('logs only the safe path for unexpected errors', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { host, json, status } = createHost(
      '/api/hr/students/student-id/attachments/download?storageKey=private-key',
    );

    new AllExceptionsFilter().catch(new Error('storage failed'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal server error',
        path: '/api/hr/students/student-id/attachments/download',
      }),
    );
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining(
        'event=http_request_failed method=GET path=/api/hr/students/student-id/attachments/download status=500',
      ),
      expect.stringContaining('storage failed'),
    );
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private-key');
  });
});
