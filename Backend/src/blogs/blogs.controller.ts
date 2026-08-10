import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FindBlogsQueryDto } from './dto/find-blogs-query.dto';
import { AdminGuard } from '../common/guards/admin.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';

@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Get()
  findAll(@Query() query: FindBlogsQueryDto) {
    return this.blogsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.blogsService.findOne(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  create(@Body() dto: CreateBlogDto) {
    return this.blogsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  update(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: UpdateBlogDto) {
    return this.blogsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  remove(@Param('id', ParseObjectIdPipe) id: string) {
    return this.blogsService.remove(id);
  }
}
