import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StewardshipService } from './stewardship.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stewardship')
export class StewardshipController {
  constructor(private readonly service: StewardshipService) {}

  @Roles('medico', 'enfermeiro', 'chefe_enfermeiros', 'chefe_medicos', 'farmaceutico')
  @Get(':doenteId')
  listar(@Param('doenteId') doenteId: string) {
    return this.service.listar(doenteId);
  }

  @Roles('medico', 'chefe_medicos', 'farmaceutico')
  @Patch(':id/aprovar')
  aprovar(@Param('id') id: string, @Request() req: any) {
    return this.service.aprovar(id, req.user.sub);
  }
}
