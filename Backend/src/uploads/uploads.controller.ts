import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UploadsService } from './uploads.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { detectImageMimeType } from './image-file';

@Controller('admin/uploads')
@UseGuards(AdminGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @Throttle({ default: { limit: 10, ttl: 15 * 60 * 1000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('ფაილი არ არის მიბმული');
    }
    const detectedMimeType = detectImageMimeType(file.buffer);
    if (!detectedMimeType) {
      throw new BadRequestException('დაშვებულია მხოლოდ JPEG, PNG, GIF ან WebP სურათი');
    }
    return this.uploadsService.uploadBuffer(file.buffer, detectedMimeType);
  }
}
