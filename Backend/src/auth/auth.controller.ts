import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Req() request: Request, @Body() dto: RegisterDto) {
    const user = await this.authService.register(dto);
    request.session.userId = String(user._id);
    return { user: this.usersService.toSafeUser(user) };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Req() request: Request, @Body() dto: LoginDto) {
    const user = await this.authService.validateUser(dto);
    request.session.userId = String(user._id);
    return { user: this.usersService.toSafeUser(user) };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Req() request: Request) {
    return new Promise((resolve) => {
      request.session.destroy(() => {
        resolve({ message: 'წარმატებით გამოხვედით' });
      });
    });
  }

  @Get('me')
  async me(@Req() request: Request) {
    const userId = request.session?.userId;
    if (!userId) {
      return { user: null };
    }
    const user = await this.usersService.findById(userId).catch(() => null);
    if (!user) {
      return { user: null };
    }
    return { user: this.usersService.toSafeUser(user) };
  }
}
