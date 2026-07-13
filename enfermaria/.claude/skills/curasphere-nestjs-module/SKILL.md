---
name: curasphere-nestjs-module
description: Use when adding a new NestJS module, controller, or service to apps/api in CuraSphere, or when reviewing whether an existing one follows repo convention. Covers the module/controller/service triad, guards, DTO validation, and app.module.ts registration this codebase expects.
---

# CuraSphere — NestJS Module Convention

Reference implementation: `apps/api/src/app/transferencias/` (module + controller + service, three files, no extra layers).

## 1. The triad

```
apps/api/src/app/<dominio>/
  <dominio>.module.ts
  <dominio>.controller.ts
  <dominio>.service.ts
```

No repository layer, no separate DTO folder for simple modules — inline DTO classes at the top of the controller file are the norm (see `webhooks.controller.ts`'s `CriarWebhookDto`). Only break DTOs into a `dto/` folder when a module already has one (e.g. `doentes/dto/`).

**module.ts**:
```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { XController } from './x.controller';
import { XService } from './x.service';

@Module({
  imports: [PrismaModule],
  controllers: [XController],
  providers: [XService],
})
export class XModule {}
```
`PrismaModule` is `@Global()`, so importing it is technically redundant — but do it anyway (see plan item BP-1: two modules shipped without it and it was flagged as a latent footgun for refactoring). Always import it explicitly.

**controller.ts**:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('x')
export class XController {
  constructor(private readonly service: XService) {}

  @Post()
  @Roles('medico', 'chefe_enfermeiros')
  criar(@Body() dto: CriarXDto, @Request() req: any) {
    return this.service.criar(req.user.sub, dto);
  }
}
```
Every mutating endpoint needs `@Roles(...)` — there is no implicit "any authenticated user" mutation path in this codebase. Read `GET` endpoints still need `@UseGuards` at class level (already inherited) but may have a broader role list. If a controller talks to patient data, cross-check `req.user.sub` (or `doenteId`) is actually used to scope the query — see the security checklist skill for the IDOR pattern this repo had to fix twice (escalas, tarefas).

## 2. DTO validation

Always use `class-validator` decorators, never a bare `interface`/`type` for `@Body()` in a new controller (an older module might still use a plain interface — that's legacy, not the pattern to copy). Minimum: `@IsString()`, `@IsUrl()`, `@IsArray() @ArrayMinSize(1)`, `@IsOptional()` for nullable fields. See `webhooks.controller.ts` for the canonical short form.

## 3. Register in app.module.ts

Add the import and list it in `imports: [...]` in `apps/api/src/app/app.module.ts`. Grep the file for the last-added module of the same "family" (clinical vs. operational vs. gestão) to keep the import grouping consistent — some larger domains are pre-grouped into `clinical.module.ts` / `operacional.module.ts` / `gestao.module.ts` barrel modules instead of being registered directly; check whether your new module belongs in one of those barrels before adding it to `app.module.ts` directly.

## 4. Prisma access

Inject `PrismaService` directly in the service constructor — there's no generic repository abstraction. For schema changes, see the `curasphere-prisma-schema` skill.
