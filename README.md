# OpenCafe admin frontend

Adapted from Anemonastrum/mailarchive-frontend. Admin only; cashier POS deferred. Template mint palette, cards, controls, responsive shell and themes retained; scrollbar handles hidden without disabling scrolling.

```sh
npm ci
npm run dev
npm test
npm run build
```

Open http://localhost:5173. Backend must use `APP_ORIGIN=http://localhost:5173` for browser authentication. Vite proxies same-origin `/api` to `API_PROXY_TARGET` (default `http://127.0.0.1:3000`). Production needs same-origin HTTPS reverse proxy for `/api`; images use backend's separate image origin/listener. Never expose server secrets as Vite environment variables.

Admin modules: dashboard, sales reports with CSV/XLSX export, categories, products, cafe/tax/receipt settings, cashier lifecycle/password resets, own profile/password, and order/payment/receipt oversight. No admin checkout or order creation.

Browser verification and live-integration limits: [docs/verification.md](docs/verification.md). Tests use isolated fixtures, not real accounts.

Backend contract pinned to `9a0d91d502390c31c2d14854866a15558cc850b3`. No public branding endpoint assumed. Tokens only in memory; refresh cookie HttpOnly. Native Web Locks serialize cookie mutations across tabs on supported secure-context browsers; without Web Locks use one tab to avoid refresh-token rotation races.
