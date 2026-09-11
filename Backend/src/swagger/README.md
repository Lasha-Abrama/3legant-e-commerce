# Swagger documentation

- `openapi.yaml`: hand-maintained OpenAPI 3.0.3 source of truth, including paths, request schemas, and authentication.
- `setup-swagger.ts`: serves Swagger UI at `/api/docs/` and the YAML/JSON downloads. Called by the shared application setup for local and Vercel entry points.
- `swagger.spec.ts`: validates the specification and references, compares documented routes/guards/statuses against controllers, and checks UI/assets over HTTP without MongoDB.

Update the YAML whenever routes, DTOs, authentication requirements, or responses change. Keep paths relative to the `/api` server URL. Reuse schemas under `components.schemas` and provide unique operation IDs. Document admin requirements separately from bearer authentication, because an ordinary JWT does not grant admin access.

Run `npm run test:swagger` and `npm run check` from `Backend/`. Nest's asset configuration copies YAML into `dist/swagger/`; Vercel's `includeFiles` bundles the source YAML and local UI assets. No Swagger generation step or controller annotations are needed.

Swagger UI integration uses [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express); build asset handling follows the [Nest CLI documentation](https://docs.nestjs.com/cli/monorepo#assets).
