import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { Blog, BlogDocument } from './schemas/blog.schema';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FindBlogsQueryDto } from './dto/find-blogs-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { escapeRegularExpression } from '../common/utils/escape-regular-expression';

@Injectable()
export class BlogsService {
  constructor(
    @InjectModel(Blog.name) private readonly blogModel: Model<BlogDocument>,
  ) {}

  async findAll(query: FindBlogsQueryDto): Promise<PaginatedResult<Blog>> {
    const filter: QueryFilter<BlogDocument> = {};
    if (typeof query.featured === 'boolean') filter.featured = query.featured;
    if (query.search) {
      filter.title = { $regex: escapeRegularExpression(query.search), $options: 'i' };
    }

    const sort: Record<string, 1 | -1> = {
      createdAt: query.sort === 'oldest' ? 1 : -1,
    };

    const page = query.page ?? 1;
    const take = query.take ?? 12;
    const skip = (page - 1) * take;

    const [data, total] = await Promise.all([
      this.blogModel.find(filter).sort(sort).skip(skip).limit(take).lean().exec(),
      this.blogModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, take };
  }

  async findOne(id: string): Promise<BlogDocument> {
    const blog = await this.blogModel.findById(id).exec();
    if (!blog) {
      throw new NotFoundException('ბლოგპოსტი ვერ მოიძებნა');
    }
    return blog;
  }

  async create(dto: CreateBlogDto): Promise<Blog> {
    const slug = await this.buildUniqueSlug(dto.title);
    const blog = new this.blogModel({ ...dto, slug });
    return blog.save();
  }

  async update(id: string, dto: UpdateBlogDto): Promise<Blog> {
    const blog = await this.findOne(id);
    Object.assign(blog, dto);
    return blog.save();
  }

  async remove(id: string): Promise<Blog> {
    const blog = await this.blogModel.findByIdAndDelete(id).exec();
    if (!blog) {
      throw new NotFoundException('ბლოგპოსტი ვერ მოიძებნა');
    }
    return blog;
  }

  private async buildUniqueSlug(title: string): Promise<string> {
    const base = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slug = base;
    let suffix = 1;
    while (await this.blogModel.exists({ slug })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }
}
