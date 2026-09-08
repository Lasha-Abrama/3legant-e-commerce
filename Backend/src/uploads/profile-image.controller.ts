import {
  BadRequestException,
  Controller,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthenticatedRequest } from '../common/types/authenticated-request';
import { detectImageMimeType } from './image-file';
import { ProfileImagesService } from './profile-images.service';

const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('users/me/profile-image')
@UseGuards(JwtAuthGuard)
export class ProfileImageController {
  constructor(private readonly profileImagesService: ProfileImagesService) {}

  @Patch()
  @Throttle({ default: { limit: 5, ttl: 15 * 60 * 1000 } })
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
    fileFilter: (_request, file, callback) => {
      if (!PROFILE_IMAGE_TYPES.includes(file.mimetype)) {
        callback(new BadRequestException('Only JPEG, PNG, or WebP profile images are allowed.'), false);
        return;
      }
      callback(null, true);
    },
  }))
  async update(
    @Req() request: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('A profile image is required.');
    }
    const detectedMimeType = detectImageMimeType(file.buffer);
    if (!detectedMimeType || !PROFILE_IMAGE_TYPES.includes(detectedMimeType)) {
      throw new BadRequestException('Only valid JPEG, PNG, or WebP profile images are allowed.');
    }
    return this.profileImagesService.update(
      String(request.user._id),
      file.buffer,
      detectedMimeType,
    );
  }
}
