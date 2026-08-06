import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersAdminController } from './users-admin.controller';
import { SessionAuthGuard } from '../common/guards/session-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [UsersController, UsersAdminController],
  providers: [UsersService, SessionAuthGuard, AdminGuard],
  exports: [UsersService, SessionAuthGuard, AdminGuard],
})
export class UsersModule {}
