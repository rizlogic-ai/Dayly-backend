const env = require('./config/env');
const app = require('./app');

app.listen(env.port, () => {
  console.log(`Dayly backend listening on port ${env.port}`);
});
