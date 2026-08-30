import { ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const productModel = {
    updateOne: jest.fn(),
  };
  const service = new ProductsService(productModel as never);
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
});
