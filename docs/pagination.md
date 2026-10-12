# Paginated library API

All routes require the existing authentication middleware and use the signed-in user's database.

- `GET /api/books?page=1&pageSize=50`: up to 50 books. Supports `search`, `year`, `category`, `subcategory`, `status` and `saga_id`.
- `GET /api/sagas?page=1&pageSize=10`: up to 10 saga summaries, including `total` and `finished`, without book arrays.
- `GET /api/books?saga_id=1&page=1&pageSize=50`: volumes of one saga, fetched when its card is expanded.
- `GET /api/books/metadata`: years, categories and category/subcategory counts for filters and category management.
- `GET /api/books/dashboard?year=2026`: yearly statistics, chart aggregates and at most eight recent books.
- `GET /api/sagas/options`: IDs and names for book forms (no books).

Paginated responses have `{ items, total, page, pageSize, totalPages }`. Pages start at 1. Invalid pagination returns 400. Requests beyond the final page are clamped, including after deletion. An empty collection returns page 1, totalPages 1 and an empty items array.

Book order is end/start date descending, then creation date and ID descending to break ties. Saga volumes use volume order, creation date and ID. Search uses case-insensitive literal substrings, including Unicode case conversion; `%` and `_` are ordinary search characters.

For compatibility, `/api/books` and `/api/sagas` without pagination parameters retain the old array responses. The updated web application does not use these full-collection reads. Form options and metadata are lightweight collections, not paginated book payloads.

## Validation and rollout

Run `npm test`. Tests use in-memory SQLite databases and isolated HTTP handlers; they do not access real account data.

Deploy/restart the Node server together with the updated frontend before distributing the new APK. The Capacitor app points to the remote server, which must also provide these routes. Database indexes are created idempotently when a user's database is first opened by the updated server.

Before committing Android changes, run `npm run build:bridge`, `npx cap sync android`, then `android/gradlew.bat assembleRelease` from the Android directory with the configured JDK. Verify the APK signature and packaged web files. Release APKs and signing credentials remain outside Git.
