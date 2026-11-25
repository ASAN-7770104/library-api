// All routes start with /api/books (see app.js). A route only decides WHICH function answers;
// the real work is done in controllers/booksController.js.
import { Router } from 'express';

import {
  getBooks,
  getStats,
  getBookById,
  createBook,
  replaceBook,
  updateBook,
  deleteBook,
} from '../controllers/booksController.js';
import { validateBook, validateBookPatch } from '../middleware/validateBook.js';

const router = Router();

router.get('/', getBooks);                        // list, with filtering and sorting
router.get('/stats', getStats);                   // bonus: MUST stay above '/:id', otherwise "stats" would be read as an id
router.get('/:id', getBookById);                  // one book
router.post('/', validateBook, createBook);       // create (body is validated first)
router.put('/:id', validateBook, replaceBook);    // replace ALL fields (body is validated first)
router.patch('/:id', validateBookPatch, updateBook); // change only the fields that were sent
router.delete('/:id', deleteBook);                // delete

export default router;
