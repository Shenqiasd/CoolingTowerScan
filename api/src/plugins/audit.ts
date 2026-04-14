import fp from 'fastify-plugin';

export interface AuditContext {
  actorUserId: string | null;
  actorSource: string;
}

const DEFAULT_AUDIT_CONTEXT: AuditContext = {
  actorUserId: null,
  actorSource: 'anonymous',
};

declare module 'fastify' {
  interface FastifyRequest {
    _auditContext?: AuditContext;
    audit: AuditContext;
  }
}

export const auditPlugin = fp(async (app) => {
  app.decorateRequest('_auditContext');
  app.decorateRequest('audit', {
    getter() {
      return this._auditContext ?? DEFAULT_AUDIT_CONTEXT;
    },
    setter(value) {
      this._auditContext = value;
    },
  });

  app.addHook('preHandler', async (request) => {
    request.audit = {
      actorUserId: request.auth.userId,
      actorSource: request.auth.isAuthenticated ? 'api' : 'anonymous',
    };
  });
});
