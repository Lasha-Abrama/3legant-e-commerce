import { Module } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { UploadsController } from './uploads.controller';
import { UsersModule } from '../users/users.module';
import { ProfileImageController } from './profile-image.controller';
import { ProfileImagesService } from './profile-images.service';

@Module({
  imports: [UsersModule],
  controllers: [UploadsController, ProfileImageController],
  providers: [UploadsService, ProfileImagesService],
})
export class UploadsModule {}
