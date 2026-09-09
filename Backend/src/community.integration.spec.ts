import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createConnection, Connection, Schema, Types } from 'mongoose';
import { chromium, Browser } from '@playwright/test';
import request = require('supertest');
import { join } from 'path';
import { mkdirSync } from 'fs';
import { ReviewsController } from './reviews/reviews.controller';
import { ReviewsService } from './reviews/reviews.service';
import { ReviewSchema } from './reviews/schemas/review.schema';
import { QuestionsController } from './questions/questions.controller';
import { QuestionsService } from './questions/questions.service';
import { QuestionSchema } from './questions/schemas/question.schema';
import { ProductsService } from './products/products.service';
import { OrdersService } from './orders/orders.service';
import { UsersService } from './users/users.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { configureApp } from './setup';

// Always uses a new, isolated database. Never reads or changes store data.
jest.setTimeout(45000);

const integration = process.env.COMMUNITY_TEST_MONGO_URL ? describe : describe.skip;
integration('Community with real MongoDB, HTTP authorization and browser', () => {
  let connection: Connection, app: NestExpressApplication, browser: Browser;
  const productId = new Types.ObjectId().toString(), otherProduct = new Types.ObjectId().toString();
  const users = ['Sofia Harvetz', 'Nicolas Jensen'].map((displayName) => ({ _id: new Types.ObjectId(), displayName, firstName: displayName.split(' ')[0], lastName: displayName.split(' ')[1], tokenVersion: 0 }));
  const jwt = new JwtService({ secret: 'isolated-community-integration-secret' });
  const tokens = users.map(user => jwt.sign({ sub: String(user._id), tokenVersion: 0 }));
  const product = { _id: productId, name: 'Tray Table', category: 'Living Room', sku: 'TEST', price: 199, stock: 10, images: ['/images/products/tray-table.jpg'], colors: [], description: 'A versatile table.', ratingAvg: 5, reviewsCount: 0 };
  let reviewId: string, replyId: string, questionId: string, answerId: string, answerReplyId: string;
  const reviewsUrl = `/api/products/${productId}/reviews`, questionsUrl = `/api/products/${productId}/questions`;
  function api(method: 'get' | 'post' | 'patch', url: string, user = 0, data?: object) {
    const call = request(app.getHttpServer())[method](url);
    if (user >= 0) call.set('Authorization', `Bearer ${tokens[user]}`);
    return data ? call.send(data) : call;
  }

  beforeAll(async () => {
    connection = await createConnection(process.env.COMMUNITY_TEST_MONGO_URL!, {
      dbName: `community_it_${new Types.ObjectId()}`, serverSelectionTimeoutMS: 15000,
    }).asPromise();
    const userModel = connection.model('User', new Schema({ displayName: String, firstName: String, lastName: String, tokenVersion: Number }));
    await userModel.insertMany(users);
    const reviewModel = connection.model('Review', ReviewSchema), questionModel = connection.model('Question', QuestionSchema);
    await reviewModel.init(); await questionModel.init();
    const module = await Test.createTestingModule({
      controllers: [ReviewsController, QuestionsController],
      providers: [ReviewsService, QuestionsService, JwtAuthGuard,
        { provide: getModelToken('Review'), useValue: reviewModel },
        { provide: getModelToken('Question'), useValue: questionModel },
        { provide: JwtService, useValue: jwt },
        { provide: UsersService, useValue: { findById: (id: string) => userModel.findById(id).exec() } },
        { provide: ProductsService, useValue: { findOne: async () => product, recalculateRating: async (_id: string, avg: number, count: number) => { product.ratingAvg = avg; product.reviewsCount = count; } } },
        { provide: OrdersService, useValue: { hasPurchasedProduct: async (id: string) => id === String(users[0]._id) } },
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app, new ConfigService());
    app.useStaticAssets(join(__dirname, '../../Frontend'));
    const server = app.getHttpAdapter();
    server.get('/api/products/' + productId, (_req: any, res: any) => res.json(product));
    server.get('/api/products', (_req: any, res: any) => res.json({ data: [] }));
    server.get('/api/users/me/wishlist', (_req: any, res: any) => res.json([]));
    server.get('/api/auth/me', (req: any, res: any) => {
      try { const payload = jwt.verify(req.headers.authorization?.slice(7)); res.json({ user: users.find(user => String(user._id) === payload.sub) }); }
      catch { res.status(401).json({ message: 'Sign in' }); }
    });
    await app.listen(0, '127.0.0.1');
  }, 30000);

  afterAll(async () => {
    await browser?.close(); await app?.close();
    // Remove only fixtures in this run's isolated database; no dropDatabase privilege needed.
    try { if (connection?.readyState === 1 && connection.name.startsWith('community_it_')) { for (const model of Object.values(connection.models)) await model.deleteMany({}); } }
    finally { await connection?.close(); }
  });

  it('enforces purchase eligibility, authentication, validation and unique reviews', async () => {
    await api('post', reviewsUrl, -1, { rating: 5, text: 'Great' }).expect(401);
    await api('post', reviewsUrl, 1, { rating: 5, text: 'Great' }).expect(403);
    await api('post', reviewsUrl, 0, { rating: 6, text: ' ' }).expect(400);
    const response = await api('post', reviewsUrl, 0, { rating: 5, text: 'I bought it 3 weeks ago and came back to say: awesome product. A useful addition to our living room.' }).expect(201);
    reviewId = response.body._id;
    await api('post', reviewsUrl, 0, { rating: 5, text: 'Duplicate' }).expect(409);
  });

  it('persists review likes, concurrent votes, inline edit data and flat replies', async () => {
    const url = `${reviewsUrl}/${reviewId}`;
    expect((await api('post', url + '/like')).body).toMatchObject({ liked: true, likesCount: 1 });
    expect((await api('post', url + '/like')).body).toMatchObject({ liked: false, likesCount: 0 });
    await Promise.all([api('post', url + '/like', 0), api('post', url + '/like', 1)]);
    expect((await api('get', reviewsUrl)).body[0].likedBy).toHaveLength(2);
    await Promise.all([api('post', url + '/like', 0), api('post', url + '/like', 0)]);
    expect((await api('get', reviewsUrl)).body[0].likedBy).toHaveLength(2);
    await api('patch', url, 1, { rating: 1, text: 'Not mine' }).expect(403);
    await api('patch', url, 0, { rating: null }).expect(400);
    await api('patch', url, 0, { rating: 4, text: 'Updated review' }).expect(200);
    expect(product.ratingAvg).toBe(4);
    const response = await api('post', url + '/replies', 1, { text: 'Thanks for sharing!' }).expect(201);
    replyId = response.body.replies[0]._id;
    await api('post', url + '/replies', 0, { text: 'You are welcome', replyToId: replyId }).expect(201);
    await api('post', url + '/replies', 0, { text: 'Bad target', replyToId: new Types.ObjectId().toString() }).expect(404);
    await api('patch', url + '/replies/' + replyId, 0, { text: 'Not mine' }).expect(403);
    await api('patch', url + '/replies/' + replyId, 1, { text: 'Updated reply' }).expect(200);
    expect((await api('post', url + '/replies/' + replyId + '/like', 1)).body.likesCount).toBe(1);
    expect((await api('post', url + '/replies/' + replyId + '/like', 1)).body.likesCount).toBe(0);
    const saved = (await api('get', reviewsUrl)).body[0];
    expect(saved).toMatchObject({ text: 'Updated review', rating: 4 });
    expect(saved.replies[1].replyTo).toBe(replyId);
    await api('patch', `/api/products/${otherProduct}/reviews/${reviewId}/replies/${replyId}`, 1, { text: 'Wrong product' }).expect(403);
  });

  it('persists Q&A votes, answers, reply targeting and owner-only edits at every level', async () => {
    await api('post', questionsUrl, -1, { text: 'Question' }).expect(401);
    await api('post', questionsUrl, 0, { text: ' ', extra: 'invalid' }).expect(400);
    questionId = (await api('post', questionsUrl, 0, { text: 'Does it need assembly?' }).expect(201)).body._id;
    const url = `${questionsUrl}/${questionId}`;
    await api('patch', url, 1, { text: 'Not mine' }).expect(403);
    await api('patch', url, 0, { text: 'Is assembly required?' }).expect(200);
    const answer = await api('post', url + '/answers', 1, { text: 'No tools are needed.' }).expect(201);
    answerId = answer.body.answers[0]._id;
    const reply = await api('post', `${url}/answers/${answerId}/replies`, 0, { text: 'Thank you.' }).expect(201);
    answerReplyId = reply.body.answers[0].replies[0]._id;
    await api('post', `${url}/answers/${answerId}/replies`, 1, { text: 'Happy to help.', replyToId: answerReplyId }).expect(201);
    for (const [path, owner] of [[url, 0], [`${url}/answers/${answerId}`, 1], [`${url}/answers/${answerId}/replies/${answerReplyId}`, 0]] as const) {
      await api('patch', path, 1 - owner, { text: 'Not mine' }).expect(403);
      await api('patch', path, owner, { text: 'Owner edited this' }).expect(200);
      expect((await api('post', path + '/like', owner)).body).toMatchObject({ liked: true, likesCount: 1, disliked: false, dislikesCount: 0 });
      expect((await api('post', path + '/dislike', owner)).body).toMatchObject({ liked: false, likesCount: 0, disliked: true, dislikesCount: 1 });
      expect((await api('post', path + '/dislike', owner)).body).toMatchObject({ disliked: false, dislikesCount: 0 });
      await api('post', path + '/like', -1).expect(401);
    }
    const saved = (await api('get', questionsUrl)).body[0];
    expect(saved.answers[0].replies[1].replyTo).toBe(answerReplyId);
    expect(saved.answers[0].replies[0].text).toBe('Owner edited this');
    await api('post', `${url}/answers/${new Types.ObjectId()}/like`).expect(404);
  });

  it('runs inline browser flows against the real API and checks desktop/mobile layouts', async () => {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(token => sessionStorage.setItem('threelegant_access_token', token), tokens[0]);
    await page.goto((await app.getUrl()) + '/product.html?id=' + productId);
    const root = page.locator(`[data-path="reviews/${reviewId}"]`);
    await root.locator('> .review-row__body > .review-actions [data-action="edit"]').click();
    await root.locator('> .review-row__body > .community-content textarea').fill('A lovely tray table, with a useful removable tray.');
    await root.getByRole('radio', { name: '3 stars', exact: true }).check();
    await root.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForSelector('.community-edit', { state: 'detached' });
    expect(await root.locator('> .review-row__body > .community-content').textContent()).toContain('A lovely tray table');
    await root.locator('> .review-row__body > .review-actions [data-action="reply"]').click();
    await root.getByRole('textbox', { name: 'Reply to Sofia Harvetz', exact: true }).fill('An additional detail from the owner.');
    await root.getByRole('button', { name: 'Send reply' }).click();
    await page.waitForSelector('.community-reply-form', { state: 'detached' });
    const replyRow = page.locator(`[data-path="reviews/${reviewId}/replies/${replyId}"]`);
    expect(await replyRow.locator('[data-action="edit"]').count()).toBe(0);
    await replyRow.locator('[data-action="reply"]').click();
    await replyRow.getByRole('textbox').fill('Replying directly to Nicolas.');
    await replyRow.getByRole('button', { name: 'Send reply' }).click();
    await page.waitForSelector('.community-reply-form', { state: 'detached' });
    await page.reload();
    await page.waitForSelector(`[data-path="reviews/${reviewId}"]`);
    expect(await root.textContent()).toContain('Replying directly to Nicolas.');
    await page.locator('#community-sort').selectOption('lowest');
    await page.getByRole('tab', { name: 'Questions', exact: true }).click();
    await page.getByRole('textbox', { name: 'Ask a product question' }).fill('Can the tray be removed?');
    await page.getByRole('button', { name: 'Ask question', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.review-list-head h3')?.textContent === '2 Questions');
    const question = page.locator(`[data-path="questions/${questionId}"]`);
    await question.locator('> .review-row__body > .review-actions [data-action="edit"]').click();
    await question.locator('> .review-row__body > .community-content textarea').fill('Does this table arrive assembled?');
    await question.getByRole('button', { name: 'Save', exact: true }).click();
    await page.waitForSelector('.community-edit', { state: 'detached' });
    await question.locator('> .review-row__body > .review-actions [data-action="dislike"]').click();
    await page.waitForFunction(id => document.querySelector(`[data-path="questions/${id}"] > .review-row__body > .review-actions [data-action="dislike"]`)?.getAttribute('aria-pressed') === 'true', questionId);
    await page.getByRole('tab', { name: 'Reviews', exact: true }).click();
    mkdirSync(join(__dirname, '../test-results/community'), { recursive: true });
    await page.locator('#tab-row').scrollIntoViewIfNeeded();
    await page.locator('#tab-body').screenshot({ path: join(__dirname, '../test-results/community/desktop.png') });
    await page.setViewportSize({ width: 375, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#tab-body').screenshot({ path: join(__dirname, '../test-results/community/mobile.png') });
    expect(errors).toEqual([]);
    await page.close();
  }, 90000);
});
