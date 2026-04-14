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

    reply.status(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error.',
        details: {},
      },
    });
  });
});
