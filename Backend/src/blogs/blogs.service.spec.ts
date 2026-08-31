import { BlogsService } from './blogs.service';

describe('BlogsService', () => {
  const exec = jest.fn().mockResolvedValue([]);
  const lean = jest.fn().mockReturnValue({ exec });
  const limit = jest.fn().mockReturnValue({ lean });
  const skip = jest.fn().mockReturnValue({ limit });
  const sort = jest.fn().mockReturnValue({ skip });
  const blogModel = {
    find: jest.fn().mockReturnValue({ sort }),
    countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
  };
  const service = new BlogsService(blogModel as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters featured posts and sorts oldest first', async () => {
    await service.findAll({ featured: true, sort: 'oldest', page: 2, take: 6 });

    expect(blogModel.find).toHaveBeenCalledWith({ featured: true });
    expect(sort).toHaveBeenCalledWith({ createdAt: 1 });
    expect(skip).toHaveBeenCalledWith(6);
    expect(limit).toHaveBeenCalledWith(6);
  });

  it('treats blog search text as literal input', async () => {
    await service.findAll({ search: 'Room (ideas)+' });

    expect(blogModel.find).toHaveBeenCalledWith({
      title: { $regex: 'Room \\(ideas\\)\\+', $options: 'i' },
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });
});
