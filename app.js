// Entry point: creates the Express app, registers the middleware and the routes.
import express from 'express';

import booksRouter from './routes/books.js';
import logger from './middleware/logger.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// The port comes from the environment (PORT=4000 npm start); 3000 is the default.
const PORT = process.env.PORT || 3000;

// --- Middleware (the order matters: Express runs them from top to bottom) ---
app.use(logger);        // custom: prints "METHOD URL STATUS - N ms" for every request
app.use(express.json()); // built-in: turns a JSON request body into req.body

// --- Routes ---
app.use('/api/books', booksRouter);

// --- After the routes ---
app.use(notFound);      // custom: nothing above answered -> 404 in JSON
app.use(errorHandler);  // custom: any error from any step ends here -> 500 (or 400) in JSON

app.listen(PORT, () => {
  console.log(`Library API is running on http://localhost:${PORT}`);
});
