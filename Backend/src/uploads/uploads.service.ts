import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'crypto';
import { AllowedImageMimeType } from './image-file';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>('CLOUDINARY_NAME'),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadBuffer(buffer: Buffer, mimetype: AllowedImageMimeType): Promise<{ url: string }> {
    const result = await this.uploadImage(buffer, mimetype, {
      folder: 'loam-co/products',
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    });
    return { url: result.url };
  }

  uploadProfileImage(
    buffer: Buffer,
    mimetype: AllowedImageMimeType,
    userId: string,
  ): Promise<{ url: string; publicId: string }> {
    return this.uploadImage(buffer, mimetype, {
      folder: 'loam-co/profile-images',
      publicId: `user-${userId}-${randomUUID()}`,
      allowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
    });
  }

  async deleteProfileImage(publicId: string): Promise<boolean> {
    if (!publicId.startsWith('loam-co/profile-images/')) return false;
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });
      return result.result === 'ok' || result.result === 'not found';
    } catch {
      this.logger.error('Cloudinary profile image cleanup failed.');
      return false;
    }
  }

  private async uploadImage(
    buffer: Buffer,
    mimetype: AllowedImageMimeType,
    options: { folder: string; publicId?: string; allowedFormats: string[] },
  ): Promise<{ url: string; publicId: string }> {
    const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
    try {
      const result = await cloudinary.uploader.upload(dataUri, {
        folder: options.folder,
        ...(options.publicId ? {
          public_id: options.publicId,
          overwrite: false,
          unique_filename: false,
        } : {}),
        resource_type: 'image',
        allowed_formats: options.allowedFormats,
      });
      return { url: result.secure_url, publicId: result.public_id };
    } catch {
      this.logger.error('Cloudinary image upload failed.');
      throw new ServiceUnavailableException('Image upload is temporarily unavailable.');
    }
  }
}
