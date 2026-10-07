This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## E2E tests (Playwright)

1. Install browsers (once): `npx playwright install chromium`
2. Start the app (e.g. `npm run dev` or `npm run build && npm run start`) and ensure the backend is reachable.
3. Run tests: `npm run test:e2e`

Tests 1–4 run without auth. Test 5 (like persists after refresh) requires env vars: `E2E_TEST_LOGIN` and `E2E_TEST_PASSWORD` (set in `.env.local` or shell); if unset, test 5 is skipped.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to load its fonts.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy to VPS

GitHub Actions builds the standalone frontend and deploys it to the VPS:

- Production: `.github/workflows/deploy-frontend-production.yml`, site `https://www.tapir.su`.
- Staging: `.github/workflows/deploy-frontend-staging.yml`, site `https://staging.tapir.su`.

Both workflows set `NEXT_PUBLIC_SITE_URL` at build time. This is the base URL
for Open Graph and Twitter metadata, including the image routes in `src/app`.
Local builds default to `https://www.tapir.su`; set `NEXT_PUBLIC_SITE_URL` to
build for another origin. Changing the variable requires rebuilding the frontend.

The preview images are `src/app/opengraph-image.png` and
`src/app/twitter-image.png` (1734 × 907 PNG). Next.js derives image URLs,
types and dimensions from these files; accompanying `.alt.txt` files supply
the descriptions. Keep image metadata in these files rather than duplicating
it in `layout.tsx`. Verify the generated HTML and the image URLs
after deployment, then check a real link preview in Telegram.
