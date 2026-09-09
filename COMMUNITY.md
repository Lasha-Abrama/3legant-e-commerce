# Reviews and Product Q&A

The existing plain JavaScript storefront and NestJS/Mongoose architecture are retained. Reviews still require a purchase and remain limited to one review per product/customer. JWT authorization protects every mutation.

## Frontend

- `Frontend/js/product.js`: shared inline review/Q&A interactions; editable text and rating replace the displayed content; named reply composers; replies remain at a fixed indentation; owner actions; reaction counts/active states; request locking and inline errors; accessible tabs, rating inputs, sort menus, emoji insertion and five-item Load more.
- `Frontend/css/design.css`: reference-based 1120px content width, 72px avatars, 40px row gaps, black stars, 28px headings, 256×48px sorting, rounded composer and restrained motion; mobile adaptations.
- `Frontend/css/styles.css`: removes obsolete separate inline-card/form styles.

## Backend and data

- `Backend/src/reviews/`: reply like/edit routes and service operations; reply target validation; review update validation rejects explicit null fields.
- `Backend/src/questions/`: question/answer/reply votes and owner edits, targeted answer replies, atomic pushes and ownership-filtered updates.
- `Backend/src/common/utils/community-reaction.ts`: a single MongoDB aggregation update toggles each user's vote. Set operations prevent duplicate votes; Q&A reactions remove the opposite vote. Nested targets must belong to the same product and thread.
- `Backend/src/community.integration.spec.ts`: optional real MongoDB/HTTP/Chrome integration coverage using isolated fixtures, actual JWT guards and the actual community controllers/services. Product and purchase fixtures are injected; this does not exercise checkout or registration.

Schema additions:

- Review replies: `likedBy` (defaults to an empty array), `replyTo` (optional sibling reply ObjectId).
- Questions and answers: `dislikedBy` (defaults to an empty array).
- Answer replies: `likedBy`, `dislikedBy`, optional `replyTo`.
- Questions: product/date index for listing.

No data migration or seed is required. Missing reaction arrays are treated as empty, including directly within MongoDB updates. Mongoose initializes new fields on new records. Existing replies remain readable. The new question index follows the project's existing Mongoose index creation policy.

No production environment variables or dependencies changed. Deploy the backend and frontend together using the existing deployment process.

## API changes

All paths below start with `/api/products/:productId`.

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/reviews/:reviewId/like` | Existing route, now atomically toggles a like |
| POST | `/reviews/:reviewId/replies` | Existing route accepts optional `replyToId` |
| PATCH | `/reviews/:reviewId/replies/:replyId` | Owner-only reply text update |
| POST | `/reviews/:reviewId/replies/:replyId/like` | Toggle reply like |
| POST | `/questions/:questionId/dislike` | Toggle question downvote |
| PATCH | `/questions/:questionId/answers/:answerId` | Owner-only answer update |
| POST | `/questions/:questionId/answers/:answerId/dislike` | Toggle answer downvote |
| POST | `/questions/:questionId/answers/:answerId/replies` | Existing route accepts optional `replyToId` |
| PATCH | `/questions/:questionId/answers/:answerId/replies/:replyId` | Owner-only reply update |
| POST | `/questions/:questionId/answers/:answerId/replies/:replyId/like` | Toggle reply upvote |
| POST | `/questions/:questionId/answers/:answerId/replies/:replyId/dislike` | Toggle reply downvote |

Existing Q&A like routes now atomically toggle votes and clear the opposite reaction. Vote responses include `liked`, `likesCount`, and for Q&A `disliked`, `dislikesCount`. Text updates accept `{ text }`; review updates also accept `rating`. Replies return the populated parent review/question; browser edits update in place without reloading the page.

## Verification

Completed: all 177 existing tests, all 4 opt-in real MongoDB/HTTP/browser integration tests, TypeScript checking, backend build, JavaScript syntax and whitespace checks. Desktop and 375px mobile screenshots were visually inspected; the browser suite reported no page errors or horizontal overflow.

From `Backend`, run `npm test`, `npm run typecheck`, and `npm run build`. No lint script is configured. JavaScript syntax can be checked with `node --check Frontend/js/product.js` from the repository root.

For the opt-in integration suite, set `COMMUNITY_TEST_MONGO_URL` to a MongoDB test connection and run `npm test -- src/community.integration.spec.ts`. The suite creates a uniquely named `community_it_*` database and deletes its fixture documents at completion. Empty test collections/indexes can remain because it does not require database-drop privileges. Chrome must be installed and process launching allowed. Screenshots are saved under `Backend/test-results/community/`.

The supplied reference is a desktop Reviews design. Q&A, mobile layouts, editing states, rating controls and actual user data are adapted consistently where no reference state was supplied. Avatars, review counts, names and text come from the backend rather than the static Figma examples. New-review rating controls and accessible input hints are included to make the pictured composer functional. Emoji glyph appearance depends on the operating system.
