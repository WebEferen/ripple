# Ripple SSR Template

An SSR-ready Ripple application template using `@ripple-ts/meta` and the Node adapter.

## Getting Started

1. Install dependencies:

    ```bash
    npm install # or pnpm or yarn
    ```

2. Start the SSR development server:

    ```bash
    npm run dev
    ```

3. Build for production (client + server):

    ```bash
    npm run build
    ```

4. Run the production server:

    ```bash
    npm run serve:ssr
    ```

## Learn More

- Ripple Documentation: https://www.ripple-ts.com/
- Vite Documentation: https://vitejs.dev/

## Hydration Notes

- This template is configured for `mode: 'hybrid'` and always uses `hydrate()` in the client entry.
- In `@ripple-ts/meta`, `mode: 'ssr'` is SSR-only by default (hydration markers removed). Use `disableHydration: false` to opt back into hydration markers when needed.
