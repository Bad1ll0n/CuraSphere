import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const SUB_ROLES_KEY = 'subRoles';
export const SubRoles = (...subRoles: string[]) => SetMetadata(SUB_ROLES_KEY, subRoles);
