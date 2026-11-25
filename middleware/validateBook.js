// Custom middleware 2: validation of the request body.
//   validateBook      -> POST and PUT  (every required field must be present and valid)
//   validateBookPatch -> PATCH         (only the fields that are sent are checked, but at least one is needed)
// If something is wrong the request stops here with 400 and a list of errors.
// If everything is fine, req.body is replaced by a CLEAN copy (known fields only, text trimmed).

const FIELDS = ['title', 'author', 'year', 'genre', 'available'];
const MIN_YEAR = 1450;

// Checks a text field. Adds an error to `errors` or the cleaned value to `clean`.
function checkText(body, name, { min, max }, requireAll, errors, clean) {
  const value = body[name];

  if (value === undefined) {
    if (requireAll) errors.push(`${name} is required`);
    return;
  }
  if (typeof value !== 'string') {
    errors.push(`${name} must be a string`);
    return;
  }

  const text = value.trim();
  if (text.length < min || text.length > max) {
    errors.push(max === Infinity
      ? `${name} must not be empty`
      : `${name} must be between ${min} and ${max} characters`);
    return;
  }
  clean[name] = text;
}

function checkBook(body, requireAll) {
  const errors = [];
  const clean = {};

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['request body must be a JSON object'], clean };
  }

  checkText(body, 'title', { min: 2, max: 100 }, requireAll, errors, clean);
  checkText(body, 'author', { min: 2, max: 60 }, requireAll, errors, clean);
  checkText(body, 'genre', { min: 1, max: Infinity }, requireAll, errors, clean);

  // year: a whole number between 1450 and the current year
  const currentYear = new Date().getFullYear();
  if (body.year === undefined) {
    if (requireAll) errors.push('year is required');
  } else if (typeof body.year !== 'number') {
    errors.push('year must be a number');
  } else if (!Number.isInteger(body.year)) {
    errors.push('year must be a whole number');
  } else if (body.year < MIN_YEAR || body.year > currentYear) {
    errors.push(`year must be between ${MIN_YEAR} and ${currentYear}`);
  } else {
    clean.year = body.year;
  }

  // available: optional, but if it is sent it must be true or false
  if (body.available !== undefined) {
    if (typeof body.available === 'boolean') clean.available = body.available;
    else errors.push('available must be true or false');
  }

  // PATCH with nothing to change makes no sense
  if (!requireAll && FIELDS.every((field) => body[field] === undefined)) {
    errors.push(`send at least one of: ${FIELDS.join(', ')}`);
  }

  return { errors, clean };
}

function runValidation(requireAll) {
  return function validate(req, res, next) {
    const { errors, clean } = checkBook(req.body, requireAll);
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }
    req.body = clean;
    return next();
  };
}

export const validateBook = runValidation(true);
export const validateBookPatch = runValidation(false);
