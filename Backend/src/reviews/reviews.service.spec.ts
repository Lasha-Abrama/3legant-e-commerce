import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { ProductsService } from '../products/products.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const reviewModel = jest.fn().mockImplementation((data) => ({
    ...data,
    save: jest.fn().mockResolvedValue({ _id: 'review-id', ...data }),
  }));
  const productsService = {
    findOne: jest.fn(),
    recalculateRating: jest.fn(),
  } as unknown as ProductsService;
  const ordersService = {
    hasPurchasedProduct: jest.fn(),
  } as unknown as OrdersService;
  const service = new ReviewsService(
    reviewModel as never,
    productsService,
    ordersService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockReviewQueries(existingReview: unknown = null) {
    (reviewModel as any).findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(existingReview),
    });
    (reviewModel as any).aggregate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue([{ _id: null, avg: 5, count: 1 }]),
    });
  }

  it('creates a review for a customer who purchased the product', async () => {
    productsService.findOne = jest.fn().mockResolvedValue({ _id: 'product-id' });
    ordersService.hasPurchasedProduct = jest.fn().mockResolvedValue(true);
    productsService.recalculateRating = jest.fn().mockResolvedValue(undefined);
    mockReviewQueries();

    await expect(
      service.create('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', 'Sofia', {
        rating: 5,
        text: 'Excellent product',
      }),
    ).resolves.toEqual(expect.objectContaining({
      _id: 'review-id',
      authorName: 'Sofia',
      rating: 5,
    }));
    expect(productsService.recalculateRating).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439011',
      5,
      1,
    );
  });

  it('rejects reviews from users who did not purchase the product', async () => {
    productsService.findOne = jest.fn().mockResolvedValue({ _id: 'product-id' });
    ordersService.hasPurchasedProduct = jest.fn().mockResolvedValue(false);

    await expect(
      service.create('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', 'Sofia', {
        rating: 4,
        text: 'Unverified review',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect((reviewModel as any).findOne).not.toHaveBeenCalled();
  });

  it('rejects a second review from the same customer', async () => {
    productsService.findOne = jest.fn().mockResolvedValue({ _id: 'product-id' });
    ordersService.hasPurchasedProduct = jest.fn().mockResolvedValue(true);
    mockReviewQueries({ _id: 'existing-review-id' });

    await expect(
      service.create('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', 'Sofia', {
        rating: 3,
        text: 'Second review',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not create orphan reviews for missing products', async () => {
    productsService.findOne = jest.fn().mockRejectedValue(
      new NotFoundException('Product not found'),
    );

    await expect(
      service.create('507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', 'Sofia', {
        rating: 5,
        text: 'Missing product',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ordersService.hasPurchasedProduct).not.toHaveBeenCalled();
  });
});
