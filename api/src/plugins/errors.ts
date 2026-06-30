import fp from 'fastify-plugin';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export const errorsPlugin = fp(async (app) => {
  app.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      });
      return;
    }

    const payload = {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    app.log.error(payload, 'Unhandled API error');
    console.error('Unhandled API error', payload);

    reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error.',
        details: {},
      },
    });
  });
});
