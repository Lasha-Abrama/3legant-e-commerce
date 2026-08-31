import { ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { UsersService } from '../users/users.service';

describe('ProductsService', () => {
  const productModel = {
    updateOne: jest.fn(),
  };
  const usersService = {
    removeProductFromWishlists: jest.fn(),
  } as unknown as UsersService;
  const service = new ProductsService(productModel as never, usersService);
  const session = {} as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('atomically decrements aggregated product quantities', async () => {
    productModel.updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    await expect(
      service.decrementStock(
        [
          { productId: 'product-one', qty: 1 },
          { productId: 'product-one', qty: 2 },
          { productId: 'product-two', qty: 1 },
        ],
        session,
      ),
    ).resolves.toBeUndefined();
    expect(productModel.updateOne).toHaveBeenNthCalledWith(
      1,
      { _id: 'product-one', stock: { $gte: 3 } },
      { $inc: { stock: -3 } },
      { session },
    );
    expect(productModel.updateOne).toHaveBeenNthCalledWith(
      2,
      { _id: 'product-two', stock: { $gte: 1 } },
      { $inc: { stock: -1 } },
      { session },
    );
  });

  it('rejects the transaction when stock is insufficient', async () => {
    productModel.updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    });

    await expect(
      service.decrementStock([{ productId: 'product-one', qty: 2 }], session),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('restores aggregated product quantities after a refund', async () => {
    productModel.updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    await expect(
      service.incrementStock(
        [
          { productId: 'product-one', qty: 1 },
          { productId: 'product-one', qty: 2 },
        ],
        session,
      ),
    ).resolves.toBeUndefined();
    expect(productModel.updateOne).toHaveBeenCalledWith(
      { _id: 'product-one' },
      { $inc: { stock: 3 } },
      { session },
    );
  });

  it('rejects stock restoration when a product no longer exists', async () => {
    productModel.updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
    });

    await expect(
      service.incrementStock([{ productId: 'missing-product', qty: 1 }], session),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('removes a deleted product from customer wishlists', async () => {
    const deletedProduct = { _id: 'product-id', name: 'Tray Table' };
    (productModel as any).findByIdAndDelete = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(deletedProduct),
    });
    usersService.removeProductFromWishlists = jest.fn().mockResolvedValue(undefined);

    await expect(service.remove('product-id')).resolves.toBe(deletedProduct);
    expect(usersService.removeProductFromWishlists).toHaveBeenCalledWith('product-id');
  });
});
