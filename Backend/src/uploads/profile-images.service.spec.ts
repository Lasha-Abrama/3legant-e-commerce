import { UsersService } from '../users/users.service';
import { ProfileImagesService } from './profile-images.service';
import { UploadsService } from './uploads.service';

describe('ProfileImagesService', () => {
  const uploadsService = {
    uploadProfileImage: jest.fn(),
    deleteProfileImage: jest.fn(),
  } as unknown as UploadsService;
  const usersService = {
    replaceProfileImage: jest.fn(),
  } as unknown as UsersService;
  const service = new ProfileImagesService(uploadsService, usersService);

  beforeEach(() => {
    jest.clearAllMocks();
    (uploadsService.uploadProfileImage as jest.Mock).mockResolvedValue({
      url: 'https://res.cloudinary.com/test/avatar.png',
      publicId: 'loam-co/profile-images/new-avatar',
    });
    (uploadsService.deleteProfileImage as jest.Mock).mockResolvedValue(true);
  });

  it('stores the new image and removes the replaced Cloudinary asset', async () => {
    (usersService.replaceProfileImage as jest.Mock).mockResolvedValue({
      user: {},
      previousPublicId: 'loam-co/profile-images/old-avatar',
    });
    await expect(service.update('user-id', Buffer.from('image'), 'image/png')).resolves.toEqual({
      profileImageUrl: 'https://res.cloudinary.com/test/avatar.png',
    });
    expect(uploadsService.uploadProfileImage).toHaveBeenCalledWith(
      expect.any(Buffer),
      'image/png',
      'user-id',
    );
    expect(uploadsService.deleteProfileImage).toHaveBeenCalledWith(
      'loam-co/profile-images/old-avatar',
    );
  });

  it('removes the newly uploaded asset if the database update fails', async () => {
    (usersService.replaceProfileImage as jest.Mock).mockRejectedValue(new Error('database failed'));
    await expect(service.update('user-id', Buffer.from('image'), 'image/png'))
      .rejects.toThrow('database failed');
    expect(uploadsService.deleteProfileImage).toHaveBeenCalledWith(
      'loam-co/profile-images/new-avatar',
    );
  });
});
