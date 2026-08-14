// Last-resort error middleware. Anything reaching here is unexpected —
// routes/repositories return their own 400s for bad input — so this
// always logs the real error server-side but never leaks internals to
// the client.
module.exports = (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.expose ? err.message : 'Internal server error.',
  });
};
