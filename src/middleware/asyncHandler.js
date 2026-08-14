// Wraps an async Express handler so a rejected promise reaches the error
// middleware instead of becoming an unhandled rejection. Express itself
// only auto-catches synchronous throws.
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
