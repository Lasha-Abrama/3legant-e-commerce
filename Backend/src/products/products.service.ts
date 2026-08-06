import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(query: FindProductsQueryDto): Promise<PaginatedResult<Product>> {
    const filter: QueryFilter<ProductDocument> = {};
    if (query.category) filter.category = query.category;
    if (typeof query.newArrival === 'boolean') filter.newArrival = query.newArrival;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {};
      if (query.minPrice !== undefined) filter.price.$gte = query.minPrice;
      if (query.maxPrice !== undefined) filter.price.$lte = query.maxPrice;
    }
    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      newest: { createdAt: -1 },
    };
    const sort = sortMap[query.sort ?? ''] ?? { createdAt: -1 };

    const page = query.page ?? 1;
    const take = query.take ?? 12;
    const skip = (page - 1) * take;

    const [data, total] = await Promise.all([
      this.productModel.find(filter).sort(sort).skip(skip).limit(take).lean().exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return { data, total, page, take };
  }

  async findOne(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('პროდუქტი ვერ მოიძებნა');
    }
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const slug = await this.buildUniqueSlug(dto.name);
    const product = new this.productModel({ ...dto, slug });
    return product.save();
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    Object.assign(product, dto);
    return product.save();
  }

  async remove(id: string): Promise<Product> {
    const product = await this.productModel.findByIdAndDelete(id).exec();
    if (!product) {
      throw new NotFoundException('პროდუქტი ვერ მოიძებნა');
    }
    return product;
  }

  async recalculateRating(productId: string, ratingAvg: number, reviewsCount: number) {
    await this.productModel
      .updateOne({ _id: productId }, { $set: { ratingAvg, reviewsCount } })
      .exec();
  }

  private async buildUniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slug = base;
    let suffix = 1;
    while (await this.productModel.exists({ slug })) {
      suffix += 1;
      slug = `${base}-${suffix}`;
    }
    return slug;
  }
}
