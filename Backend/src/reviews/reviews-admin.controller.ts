import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { AdminGuard } from '../common/guards/admin.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';

@Controller('admin/reviews')
@UseGuards(AdminGuard)
export class ReviewsAdminController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  findAll() {
    return this.reviewsService.findAll();
  }

  @Delete(':id')
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.reviewsService.remove(id);
  }
}
