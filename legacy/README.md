# Legacy files (imported from `verceilbank`)

These files are a direct, unmodified import of the original flat, single-repo
version of the app (from the [`verceilbank`](https://github.com/micheledallida-web/verceilbank)
repository). They are kept here for reference only, so that the split-file
architecture at the root of this repo (`index.html`, `css/`, `js/`, `pages/`)
is not disturbed.

| File | Description |
|---|---|
| `app.js` | Legacy mobile-menu / hero-rotator script from the old marketing `index.html` |
| `index.css` | Legacy marketing site stylesheet (used by the old `index.html`, `signin.html`, `signup.html`) |
| `signin.html` | Legacy standalone sign-in page |
| `signup.html` | Legacy standalone sign-up page |
| `dashboard.html` | Legacy monolithic dashboard (the ~6,800-line single-file version this repo's split architecture replaces — see the root `README.md`) |
| `coffee.jpeg` | Legacy blog promo image referenced by `index.css` / `dashboard.html` |
| `logo.png` | Legacy Verceil Bank logo referenced by `signin.html`, `signup.html`, `dashboard.html` |

Do not wire these into the live split-file app directly. Follow the porting
pattern documented in the root `README.md` ("The pattern — how to port the
remaining screens") to extract each screen from `dashboard.html` into its own
`pages/<name>.html` + `js/pages/<name>.js` pair when ready.
