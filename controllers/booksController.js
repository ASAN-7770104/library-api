// Controller: the logic behind every /api/books route.
// Data is stored in data/books.json and read/written with the native fs/promises module.
// Every handler is async, uses try/catch and passes any error to next(err).
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const DATA_FILE = new URL('../data/books.json', import.meta.url);
const SORT_OPTIONS = ['year', '-year', 'title', '-title'];

// ---------------------------------------------------------------------------
// Reading and writing the JSON file
// ---------------------------------------------------------------------------
async function readBooks() {
  const text = await readFile(DATA_FILE, 'utf-8');
  return JSON.parse(text); // a broken file throws here -> error handler answers 500
}

async function writeBooks(books) {
  await writeFile(DATA_FILE, `${JSON.stringify(books, null, 2)}\n`, 'utf-8');
}

// Requests that CHANGE the file (create, replace, update, delete) must not run at the same time:
// two of them could read the same old data and the second write would erase the first change.
// So they wait in a line: each one starts when the previous one has finished.
let queue = Promise.resolve();

function changeBooks(change) {
  const run = queue.then(async () => {
    const books = await readBooks();
    const result = await change(books);          // change() edits the array and returns the answer (null = book not found)
    if (result !== null) await writeBooks(books); // save only when something really changed
    return result;
  });
  queue = run.catch(() => {}); // a failed request must not block the ones behind it
  return run;
}

// When a book with the given id does not exist we do NOT answer here: we remember the message and call
// next() with no error. Express then falls through to the 404 middleware, which answers in JSON.
function bookNotFound(res, next) {
  res.locals.notFoundMessage = 'Book not found';
  next();
}

// ---------------------------------------------------------------------------
// GET /api/books?genre=&author=&available=&sort=
// ---------------------------------------------------------------------------
function checkQuery({ genre, author, available, sort }) {
  const errors = [];

  // A parameter that is repeated (?genre=a&genre=b) or nested arrives as an array/object: refuse it.
  for (const [name, value] of Object.entries({ genre, author, available, sort })) {
    if (value !== undefined && typeof value !== 'string') errors.push(`${name} must be a single value`);
  }
  if (errors.length > 0) return errors;

  if (available !== undefined && !['true', 'false'].includes(available.toLowerCase())) {
    errors.push('available must be true or false');
  }
  if (sort !== undefined && !SORT_OPTIONS.includes(sort)) {
    errors.push(`sort must be one of: ${SORT_OPTIONS.join(', ')}`);
  }
  return errors;
}

export async function getBooks(req, res, next) {
  try {
    const errors = checkQuery(req.query);
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    const { genre, author, available, sort } = req.query;
    let books = await readBooks();

    if (genre) {
      // exact match, ignoring upper/lower case
      books = books.filter((book) => book.genre.toLowerCase() === genre.trim().toLowerCase());
    }
    if (author) {
      // "contains" match, ignoring upper/lower case
      books = books.filter((book) => book.author.toLowerCase().includes(author.trim().toLowerCase()));
    }
    if (available !== undefined) {
      const wanted = available.toLowerCase() === 'true';
      books = books.filter((book) => book.available === wanted);
    }
    if (sort) {
      const direction = sort.startsWith('-') ? -1 : 1; // a leading "-" means descending
      const field = sort.replace('-', '');
      books.sort((a, b) => (field === 'year'
        ? (a.year - b.year) * direction
        : a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) * direction));
    }

    return res.status(200).json({ success: true, data: books });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// GET /api/books/stats  (bonus)
// ---------------------------------------------------------------------------
export async function getStats(req, res, next) {
  try {
    const books = await readBooks();

    // Count books per genre; "fiction" and "Fiction" count as the same genre (like the genre filter).
    const genres = new Map();
    for (const book of books) {
      const key = book.genre.toLowerCase();
      const entry = genres.get(key) || { name: book.genre, count: 0 };
      entry.count += 1;
      genres.set(key, entry);
    }

    return res.status(200).json({
      success: true,
      data: {
        total: books.length,
        available: books.filter((book) => book.available).length,
        byGenre: Object.fromEntries([...genres.values()].map((entry) => [entry.name, entry.count])),
      },
    });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// GET /api/books/:id
// ---------------------------------------------------------------------------
export async function getBookById(req, res, next) {
  try {
    const books = await readBooks();
    const book = books.find((item) => item.id === req.params.id);
    if (!book) return bookNotFound(res, next);

    return res.status(200).json({ success: true, data: book });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// POST /api/books  (req.body was checked and cleaned by validateBook)
// ---------------------------------------------------------------------------
export async function createBook(req, res, next) {
  try {
    const { title, author, year, genre, available = true } = req.body;

    const book = await changeBooks(async (books) => {
      const newBook = {
        id: randomUUID(),                    // the server creates the id
        title,
        author,
        year,
        genre,
        available,                           // defaults to true
        createdAt: new Date().toISOString(), // the server sets the date
      };
      books.push(newBook);
      return newBook;
    });

    return res.status(201).json({ success: true, data: book });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// PUT /api/books/:id  -> REPLACE the whole book (a field that is not sent goes back to its default)
// ---------------------------------------------------------------------------
export async function replaceBook(req, res, next) {
  try {
    const { title, author, year, genre, available = true } = req.body;

    const book = await changeBooks(async (books) => {
      const index = books.findIndex((item) => item.id === req.params.id);
      if (index === -1) return null;

      // id and createdAt never change
      books[index] = { id: books[index].id, title, author, year, genre, available, createdAt: books[index].createdAt };
      return books[index];
    });

    if (!book) return bookNotFound(res, next);
    return res.status(200).json({ success: true, data: book });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/books/:id  -> change ONLY the fields that were sent
// ---------------------------------------------------------------------------
export async function updateBook(req, res, next) {
  try {
    const book = await changeBooks(async (books) => {
      const index = books.findIndex((item) => item.id === req.params.id);
      if (index === -1) return null;

      // req.body contains only valid, known fields (validateBookPatch removed everything else)
      books[index] = { ...books[index], ...req.body };
      return books[index];
    });

    if (!book) return bookNotFound(res, next);
    return res.status(200).json({ success: true, data: book });
  } catch (error) {
    return next(error);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/books/:id  -> 204 No Content (no body)
// ---------------------------------------------------------------------------
export async function deleteBook(req, res, next) {
  try {
    const deleted = await changeBooks(async (books) => {
      const index = books.findIndex((item) => item.id === req.params.id);
      if (index === -1) return null;

      books.splice(index, 1);
      return true;
    });

    if (!deleted) return bookNotFound(res, next);
    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
}
