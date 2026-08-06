import { Request } from 'express';
import { UserDocument } from '../../users/schemas/user.schema';

export interface AuthenticatedRequest extends Request {
  user: UserDocument;
}
