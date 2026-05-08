import { createRecommendationService } from '@promptoon/recommendation-core';

import { createApp } from './app/createApp';
import { db } from './db';
import { env } from './lib/env';

const app = createApp(createRecommendationService({
  db,
  tokenSecret: env.recommendationTokenSecret
}));

app.listen(env.port, () => {
  console.log(`Promptoon Recommendation API listening on port ${env.port}`);
});
