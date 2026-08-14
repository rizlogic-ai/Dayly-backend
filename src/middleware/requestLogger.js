// One line per request: method, path, status, duration. Deliberately not
// morgan/pino — this is the entire logging need for a service this size,
// and it keeps the dependency count down the same way the rest of this
// backend does.
module.exports = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });
  next();
};
