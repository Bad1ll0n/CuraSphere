import { Controller, Post, Get, Body, Patch, UseGuards, Request } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AlterarPasswordDto } from './dto/alterar-password.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.numeroFuncionario, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('alterar-password')
  alterarPassword(@Request() req: any, @Body() dto: AlterarPasswordDto) {
    return this.authService.alterarPassword(req.user.sub, dto.passwordAtual, dto.novaPassword);
  }
}
