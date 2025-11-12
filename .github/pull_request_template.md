# Pull Request Checklist

## Summary

- [ ] Explain the change and why it’s needed.
- [ ] Confirm no auth/data rules changed unintentionally.

## Performance Evidence

- [ ] Desktop Lighthouse – `/dashboard` (Before vs After screenshots)
- [ ] Desktop Lighthouse – `/feature/timer` (Before vs After screenshots)
- [ ] Desktop Lighthouse – `/signin` (Before vs After screenshots)
- [ ] Bundle analyzer screenshot from `pnpm analyze`
- [ ] Verified **no regression** for `/` and `/timer/flip_countdown_new`

## Verification

- [ ] `pnpm test`/`npm test` (if applicable)
- [ ] `pnpm lint`
- [ ] `pnpm analyze`
