import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('admin/uploads')
@UseGuards(AdminGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('ფაილი არ არის მიბმული');
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('დაშვებულია მხოლოდ სურათის ატვირთვა');
    }
    return this.uploadsService.uploadBuffer(file.buffer, file.mimetype);
  }
}
