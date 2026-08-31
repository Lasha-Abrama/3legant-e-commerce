import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { AllowedImageMimeType } from './image-file';

@Injectable()
export class UploadsService {
  constructor(private readonly configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.getOrThrow<string>('CLOUDINARY_NAME'),
      api_key: this.configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadBuffer(buffer: Buffer, mimetype: AllowedImageMimeType): Promise<{ url: string }> {
    const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'loam-co/products',
      resource_type: 'image',
    });
    return { url: result.secure_url };
  }
}
