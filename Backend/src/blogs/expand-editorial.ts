import 'dotenv/config';
import mongoose from 'mongoose';
import { writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Blog, BlogSchema } from './schemas/blog.schema';
import { EDITORIAL_EXPANSIONS } from './editorial-expansions';

async function expand() {
  const target = process.argv.find(argument => argument.startsWith('--database='))?.slice(11);
  const uri = process.env.MONGO_URL;
  if (!target || !uri || new URL(uri).pathname.slice(1) !== target) {
    throw new Error('Pass --database=<exact database name matching MONGO_URL>. Credentials are never printed.');
  }
  const connection = await mongoose.createConnection(uri).asPromise();
  try {
    const model = connection.model(Blog.name, BlogSchema);
    const posts = await model.find({ title: { $in: Object.keys(EDITORIAL_EXPANSIONS) } }).lean();
    const eligible = posts.filter(post => !post.content.includes(EDITORIAL_EXPANSIONS[post.title].content.split('\n')[0]));
    console.log(eligible.length + ' existing articles eligible for non-destructive expansion.');
    if (!process.argv.includes('--apply')) { console.log('Dry run only. Add --apply to append content.'); return; }
    const backup = join(tmpdir(), '3legant-articles-' + Date.now() + '.json');
    await writeFile(backup, JSON.stringify(eligible, null, 2), { flag: 'wx', mode: 0o600 });
    for (const post of eligible) {
      const entry = EDITORIAL_EXPANSIONS[post.title];
      const result = await model.updateOne({ _id: post._id, content: post.content }, {
        $set: { content: post.content + '\n\n' + entry.content, category: entry.category },
      });
      console.log(post.title + ': ' + (result.modifiedCount ? 'expanded' : 'changed concurrently; skipped'));
    }
    console.log('Backup: ' + backup);
  } finally { await connection.close(); }
}
expand().catch(() => { console.error('Article expansion failed. Check the target database and connectivity. No credentials were logged.'); process.exitCode = 1; });
