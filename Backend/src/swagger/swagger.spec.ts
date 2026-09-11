import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import SwaggerParser from '@apidevtools/swagger-parser';
import request = require('supertest');
import * as ts from 'typescript';
import { parse } from 'yaml';
import { HealthController } from '../health.controller';
import { configureApp } from '../setup';

const specificationPath = join(__dirname, 'openapi.yaml');
const document = parse(readFileSync(specificationPath, 'utf8'));

function controllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? controllerFiles(path)
      : entry.name.endsWith('.controller.ts') ? [path] : [];
  });
}

describe('YAML API documentation', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app, new ConfigService({}));
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('is a valid OpenAPI document with resolvable references', async () => {
    await expect(SwaggerParser.validate(specificationPath)).resolves.toBeDefined();
  });

  it('uses enum values that match their declared schema types', () => {
    const visit = (value: unknown): void => {
      if (!value || typeof value !== 'object') return;
      const node = value as Record<string, unknown>;
      if (Array.isArray(node.enum) && typeof node.type === 'string') {
        for (const entry of node.enum) {
          expect(typeof entry).toBe(node.type === 'integer' ? 'number' : node.type);
        }
      }
      Object.values(node).forEach(visit);
    };
    visit(document);
  });

  it('documents every controller route, status code and guard requirement', () => {
    const expected: string[] = [];
    const decorators = (node: ts.Node) => ts.canHaveDecorators(node)
      ? (ts.getDecorators(node) ?? []).map((d) => d.expression).filter(ts.isCallExpression) : [];
    const named = (node: ts.Node, name: string) => decorators(node).find((d) => d.expression.getText() === name);
    const value = (call?: ts.CallExpression) => {
      const first = call?.arguments[0];
      return first && ts.isStringLiteral(first) ? first.text : '';
    };
    for (const file of controllerFiles(join(__dirname, '..'))) {
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
      for (const controller of source.statements.filter(ts.isClassDeclaration)) {
        const prefix = named(controller, 'Controller');
        if (!prefix) continue;
        for (const method of controller.members.filter(ts.isMethodDeclaration)) {
          const route = decorators(method).find((d) => ['Get', 'Post', 'Patch', 'Delete', 'Put'].includes(d.expression.getText()));
          if (!route) continue;
          const verb = route.expression.getText().toLowerCase();
          const path = `/${value(prefix)}/${value(route)}`.replace(/\/$/, '').replace(/:(\w+)/g, '{$1}');
          expected.push(`${verb} ${path}`);
          const operation = document.paths[path]?.[verb];
          expect(operation).toBeDefined();
          const guarded = named(controller, 'UseGuards') || named(method, 'UseGuards');
          if (guarded) expect(operation.security).toContainEqual({ bearerAuth: [] });
          const status = named(method, 'HttpCode')?.arguments[0].getText()
            ?? (method.getText().includes('response.redirect(') ? '302' : verb === 'post' ? '201' : '200');
          expect(operation.responses[status]).toBeDefined();
        }
      }
    }
    const actual = Object.entries(document.paths).flatMap(([path, methods]) =>
      Object.keys(methods as object).map((verb) => `${verb} ${path}`));
    expect(actual.sort()).toEqual(expected.sort());
  });

  it('serves the UI, YAML, JSON and local assets under the API prefix', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/docs').expect(302).expect('Location', '/api/docs/');
    const html = await request(server).get('/api/docs/').expect(200);
    expect(html.text).toContain('swagger-ui-bundle.js');
    expect(html.headers['content-security-policy']).toContain("script-src 'self'");
    expect(html.headers['cache-control']).toBe('private, no-store');
    const yaml = await request(server).get('/api/docs/openapi.yaml').expect(200);
    expect(parse(yaml.text)).toEqual(document);
    const json = await request(server).get('/api/docs/openapi.json').expect(200);
    expect(json.body).toEqual(document);
    for (const asset of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js', 'swagger-ui-init.js']) {
      await request(server).get(`/api/docs/${asset}`).expect(200);
    }
    await request(server).get('/api/health').expect(200, { status: 'ok' });
  });
});
