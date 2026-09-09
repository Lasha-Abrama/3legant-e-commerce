import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';

type Target = { field: string; id: string };

// A single MongoDB pipeline toggles the reaction against the current document.
// Concurrent requests cannot add duplicates or overwrite other users' votes.
export async function toggleReaction<T>(model: Model<T>, productId: string, id: string,
  userId: string, targets: Target[] = [], dislike = false, voting = false) {
  const user = new Types.ObjectId(userId);
  const selected = dislike ? 'dislikedBy' : 'likedBy';
  const opposite = dislike ? 'likedBy' : 'dislikedBy';
  function change(ref: string, depth: number): object {
    if (depth < targets.length) {
      const target = targets[depth], variable = `item${depth}`;
      return { [target.field]: { $map: {
        input: { $ifNull: [`${ref}.${target.field}`, []] }, as: variable,
        in: { $cond: [{ $eq: [`$$${variable}._id`, new Types.ObjectId(target.id)] },
          { $mergeObjects: [`$$${variable}`, change(`$$${variable}`, depth + 1)] }, `$$${variable}`] },
      } } };
    }
    const values = { $ifNull: [`${ref}.${selected}`, []] };
    return {
      [selected]: { $cond: [{ $in: [user, values] }, { $setDifference: [values, [user]] }, { $setUnion: [values, [user]] }] },
      ...(voting ? { [opposite]: { $setDifference: [{ $ifNull: [`${ref}.${opposite}`, []] }, [user]] } } : {}),
    };
  }
  let nested: object = {};
  for (let i = targets.length - 1; i >= 0; i--) {
    nested = { [targets[i].field]: { $elemMatch: { _id: new Types.ObjectId(targets[i].id), ...nested } } };
  }
  const document = await model.findOneAndUpdate(
    { _id: new Types.ObjectId(id), product: new Types.ObjectId(productId), ...nested },
    [{ $set: change('$$ROOT', 0) }], { returnDocument: 'after', updatePipeline: true },
  ).lean().exec();
  if (!document) throw new NotFoundException('Review, question or reply not found');
  let item: any = document;
  for (const target of targets) item = item[target.field].find((entry: any) => String(entry._id) === target.id);
  return {
    liked: (item.likedBy || []).some((value: Types.ObjectId) => String(value) === userId),
    likesCount: (item.likedBy || []).length,
    ...(voting ? { disliked: (item.dislikedBy || []).some((value: Types.ObjectId) => String(value) === userId), dislikesCount: (item.dislikedBy || []).length } : {}),
  };
}
