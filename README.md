# robertchitic.com

Personal portfolio of Robert Chitic. Plain HTML, CSS and JavaScript, no build step.

- `public/` is everything that gets served (`index.html`, `404.html`, `favicon.svg`, `og.png`, `cv/`).
- `wrangler.jsonc` tells Cloudflare to serve `public/` as static assets.

## Preview locally

```sh
python3 -m http.server -d public 8000
```

Then open http://localhost:8000.

## Deploy

The repo is connected to Cloudflare (Workers & Pages → Connect GitHub). Every push to `main` deploys automatically.
Build command: none. Deploy command: `npx wrangler deploy`.

## Updating the CV

Replace `public/cv/Robert-Chitic-CV.pdf` and push.
