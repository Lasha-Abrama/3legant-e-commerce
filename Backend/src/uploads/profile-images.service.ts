import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { AllowedImageMimeType } from './image-file';
import { UploadsService } from './uploads.service';

@Injectable()
export class ProfileImagesService {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly usersService: UsersService,
  ) {}

  async update(
    userId: string,
    buffer: Buffer,
    mimetype: AllowedImageMimeType,
  ): Promise<{ profileImageUrl: string }> {
    const uploaded = await this.uploadsService.uploadProfileImage(buffer, mimetype, userId);
    let previousPublicId: string;
    try {
      ({ previousPublicId } = await this.usersService.replaceProfileImage(userId, uploaded));
    } catch (error) {
      await this.uploadsService.deleteProfileImage(uploaded.publicId);
      throw error;
    }
    if (previousPublicId && previousPublicId !== uploaded.publicId) {
      await this.uploadsService.deleteProfileImage(previousPublicId);
    }
    return { profileImageUrl: uploaded.url };
  }
}
