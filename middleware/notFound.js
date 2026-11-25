// Custom middleware 3: 404 handler.
// It runs in two situations:
//   1. No route matched the URL (app.js puts it after all the routes).
//   2. A route matched, but the book with that id does not exist: the controller sets
//      res.locals.notFoundMessage = 'Book not found' and calls next(), and Express arrives here.
export default function notFound(req, res) {
  const message = res.locals.notFoundMessage || `Route not found: ${req.method} ${req.originalUrl}`;
  res.status(404).json({ success: false, error: message });
}
