import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { UploadsService } from './uploads.service';

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: { upload: jest.fn(), destroy: jest.fn() },
  },
}));

describe('UploadsService', () => {
  const config = new ConfigService({
    CLOUDINARY_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
  });
  let service: UploadsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UploadsService(config);
  });

  it('uploads a profile image to an isolated folder and returns its identifiers', async () => {
    (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({
      secure_url: 'https://res.cloudinary.com/test/image/upload/avatar.webp',
      public_id: 'loam-co/profile-images/user-user-id-random',
    });
    await expect(service.uploadProfileImage(
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      'image/png',
      'user-id',
    )).resolves.toEqual({
      url: 'https://res.cloudinary.com/test/image/upload/avatar.webp',
      publicId: 'loam-co/profile-images/user-user-id-random',
    });
    expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/png;base64,/),
      expect.objectContaining({
        folder: 'loam-co/profile-images',
        public_id: expect.stringMatching(/^user-user-id-/),
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        overwrite: false,
      }),
    );
  });

  it('deletes only profile-folder assets', async () => {
    (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });
    await expect(service.deleteProfileImage('loam-co/products/product-id')).resolves.toBe(false);
    expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    await expect(service.deleteProfileImage('loam-co/profile-images/avatar-id')).resolves.toBe(true);
    expect(cloudinary.uploader.destroy).toHaveBeenCalledWith(
      'loam-co/profile-images/avatar-id',
      { resource_type: 'image', invalidate: true },
    );
  });

  it('returns a safe error without logging Cloudinary diagnostics', async () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    (cloudinary.uploader.upload as jest.Mock).mockRejectedValue(
      new Error('Cloudinary failure containing test-secret'),
    );
    await expect(service.uploadProfileImage(Buffer.from('image'), 'image/webp', 'user-id'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(logger).toHaveBeenCalledWith('Cloudinary image upload failed.');
    expect(JSON.stringify(logger.mock.calls)).not.toContain('test-secret');
  });
});
