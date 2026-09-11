import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import * as swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';

/** The checked-in YAML is the source of truth; no controller decorators are required. */
export function setupSwagger(app: NestExpressApplication): void {
  const yaml = readFileSync(join(__dirname, 'openapi.yaml'), 'utf8');
  const document = parse(yaml);
  const server = app.getHttpAdapter().getInstance();

  server.get('/api/docs/openapi.yaml', (_request: Request, response: Response) => {
    response.type('application/yaml').send(yaml);
  });
  server.get('/api/docs/openapi.json', (_request: Request, response: Response) => {
    response.json(document);
  });
  // A trailing slash keeps Swagger's relative stylesheet/script URLs under /api/docs/.
  server.get('/api/docs', (request: Request, response: Response, next: () => void) => {
    if (request.path.endsWith('/')) return next();
    response.redirect(302, '/api/docs/');
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(undefined, {
    customSiteTitle: '3legant API documentation',
    swaggerOptions: {
      url: '/api/docs/openapi.yaml',
      validatorUrl: null,
      persistAuthorization: false,
      withCredentials: true,
      displayRequestDuration: true,
    },
  }));
}
