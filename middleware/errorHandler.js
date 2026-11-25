// Custom middleware 4: the ONE error handler.
// Express knows it is an error handler because it has FOUR parameters (err, req, res, next).
// Every error that a controller passes with next(err) ends here, so the server never crashes.
export default function errorHandler(err, req, res, next) {
  // The answer is already partly sent: all we can do is let Express close the connection.
  if (res.headersSent) return next(err);

  // The client sent a body that is not valid JSON: that is the client's mistake, so 400, not 500.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Invalid JSON in the request body' });
  }

  // Anything else is a server problem. The details go to the console, never to the client.
  console.error(`ERROR ${req.method} ${req.originalUrl}:`, err);
  return res.status(500).json({ success: false, error: 'Internal server error' });
}
