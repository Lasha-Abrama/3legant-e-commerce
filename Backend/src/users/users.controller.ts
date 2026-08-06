import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AuthenticatedRequest } from '../common/types/authenticated-request';

@Controller('users/me')
@UseGuards(SessionAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch()
  async updateProfile(@Req() request: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(String(request.user._id), dto);
    return this.usersService.toSafeUser(user);
  }

  @Patch('address')
  async updateAddress(@Req() request: AuthenticatedRequest, @Body() dto: UpdateAddressDto) {
    const user = await this.usersService.updateAddress(String(request.user._id), dto);
    return this.usersService.toSafeUser(user);
  }

  @Patch('password')
  changePassword(@Req() request: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(String(request.user._id), dto);
  }

  @Get('wishlist')
  getWishlist(@Req() request: AuthenticatedRequest) {
    return this.usersService.getWishlist(String(request.user._id));
  }

  @Post('wishlist/:productId')
  addToWishlist(
    @Req() request: AuthenticatedRequest,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ) {
    return this.usersService.addToWishlist(String(request.user._id), productId);
  }

  @Delete('wishlist/:productId')
  removeFromWishlist(
    @Req() request: AuthenticatedRequest,
    @Param('productId', ParseObjectIdPipe) productId: string,
  ) {
    return this.usersService.removeFromWishlist(String(request.user._id), productId);
  }
}
