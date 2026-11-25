// Custom middleware 1: logger.
// Prints the method, URL, status code and response time for every request, e.g.
//   GET /api/books 200 - 4 ms
export default function logger(req, res, next) {
  const start = process.hrtime.bigint(); // a very precise clock

  // The status code is only known when the response has been sent, so we wait for the "finish" event.
  res.on('finish', () => {
    const milliseconds = Math.round(Number(process.hrtime.bigint() - start) / 1e6);
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${milliseconds} ms`);
  });

  next(); // hand the request to the next middleware
}
