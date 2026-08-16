import { Body, Controller, Get, Headers, HttpCode, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    return this.authService.createAuthResponse(String(user._id));
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto);
    return this.authService.createAuthResponse(String(user._id));
  }

  @Post('logout')
  @HttpCode(200)
  logout() {
    return { message: 'წარმატებით გამოხვედით' };
  }

  @Get('me')
  async me(@Headers('authorization') authorization?: string) {
    return { user: await this.authService.getUserFromAuthorization(authorization) };
  }
}
