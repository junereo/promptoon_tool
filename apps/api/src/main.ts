import { createApp } from './app/createApp';
import { env } from './lib/env';

const app = createApp();

app.listen(env.port, () => {
  console.log(`Promptoon API listening on port ${env.port}`);
});

