import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, QueryFilter, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { PaginatedResult } from '../common/interfaces/paginated-result.interface';
import { UsersService } from '../users/users.service';
import { escapeRegularExpression } from '../common/utils/escape-regular-expression';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly usersService: UsersService,
  ) {}

  async findAll(query: FindProductsQueryDto): Promise<PaginatedResult<Product>> {
    await this.expireOffers(query.ids);
    const filter: QueryFilter<ProductDocument> = {};
    if (query.ids?.length) filter._id = { $in: query.ids };
    if (query.category) filter.category = query.category;
    if (typeof query.newArrival === 'boolean') filter.newArrival = query.newArrival;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.price = {};
      if (query.minPrice !== undefined) filter.price.$gte = query.minPrice;
      if (query.maxPrice !== undefined) filter.price.$lte = query.maxPrice;
    }
    if (query.search) {
      filter.name = { $regex: escapeRegularExpression(query.search), $options: 'i' };
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      price_asc: { price: 1, _id: 1 },
      price_desc: { price: -1, _id: 1 },
      newest: { createdAt: -1, _id: -1 },
      oldest: { createdAt: 1, _id: 1 },
    };
    const sort = sortMap[query.sort ?? 'newest'] ?? sortMap.newest;

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
    await this.expireOffers(id);
    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException('პროდუქტი ვერ მოიძებნა');
    }
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const slug = await this.buildUniqueSlug(dto.name);
    const { offerDurationDays, ...fields } = dto;
    const product = new this.productModel({ ...fields, slug, offerExpiresAt: this.offerExpiration(fields, offerDurationDays) });
    return product.save();
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findOne(id);
    const { offerDurationDays, ...fields } = dto;
    Object.assign(product, fields);
    product.offerExpiresAt = this.offerExpiration(product, offerDurationDays, product.offerExpiresAt);
    return product.save();
  }

  private offerExpiration(product: { price: number; originalPrice?: number | null; discountLabel?: string | null },
    days?: number | null, existing?: Date | null): Date | null {
    const hasOffer = (product.originalPrice != null && product.originalPrice > product.price) || Boolean(product.discountLabel?.trim());
    if (!hasOffer) {
      if (days != null) throw new BadRequestException('Offer duration requires a discounted product or discount label');
      return null;
    }
    if (days === null) return null;
    if (days === undefined) return existing ?? null;
    if (!Number.isInteger(days) || days < 1 || days > 365) throw new BadRequestException('Offer duration must be between 1 and 365 days');
    return new Date(Date.now() + days * 86400000);
  }

  // Materialize expired prices before filtering/sorting and before order quotes.
  // MongoDB evaluates the condition atomically, so a renewed offer is not expired.
  private async expireOffers(ids?: string | string[]) {
    await this.productModel.updateMany({
      ...(typeof ids === 'string' ? { _id: ids } : ids?.length ? { _id: { $in: ids } } : {}),
      offerExpiresAt: { $ne: null, $lte: new Date() },
      $or: [{ originalPrice: { $ne: null } }, { discountLabel: { $nin: [null, ''] } }],
    }, [{ $set: {
      price: { $cond: [{ $gt: ['$originalPrice', '$price'] }, '$originalPrice', '$price'] },
      originalPrice: null, discountLabel: null,
    } }], { updatePipeline: true }).exec();
  }

  async remove(id: string): Promise<Product> {
    const product = await this.productModel.findByIdAndDelete(id).exec();
    if (!product) {
      throw new NotFoundException('პროდუქტი ვერ მოიძებნა');
    }
    await this.usersService.removeProductFromWishlists(id);
    return product;
  }

  async recalculateRating(productId: string, ratingAvg: number, reviewsCount: number) {
    await this.productModel
      .updateOne({ _id: productId }, { $set: { ratingAvg, reviewsCount } })
      .exec();
  }

  async decrementStock(
    items: Array<{ productId: Types.ObjectId | string; qty: number }>,
    session: ClientSession,
  ) {
    const quantities = new Map<string, number>();
    items.forEach((item) => {
      const productId = String(item.productId);
      quantities.set(productId, (quantities.get(productId) ?? 0) + item.qty);
    });

    for (const [productId, quantity] of quantities) {
      const result = await this.productModel
        .updateOne(
          { _id: productId, stock: { $gte: quantity } },
          { $inc: { stock: -quantity } },
          { session },
        )
        .exec();
      if (result.modifiedCount !== 1) {
        throw new ConflictException('პროდუქტის მარაგი აღარ არის საკმარისი');
      }
    }
  }

  async incrementStock(
    items: Array<{ productId: Types.ObjectId | string; qty: number }>,
    session: ClientSession,
  ) {
    const quantities = new Map<string, number>();
    items.forEach((item) => {
      const productId = String(item.productId);
      quantities.set(productId, (quantities.get(productId) ?? 0) + item.qty);
    });

    for (const [productId, quantity] of quantities) {
      const result = await this.productModel
        .updateOne(
          { _id: productId },
          { $inc: { stock: quantity } },
          { session },
        )
        .exec();
      if (result.modifiedCount !== 1) {
        throw new ConflictException('პროდუქტის მარაგის აღდგენა ვერ მოხერხდა');
      }
    }
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
