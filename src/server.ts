import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import cron from 'node-cron';
import { initPush } from './push';
import { sessionMiddleware } from './middleware/session';
import { router as api } from './routes/api';

const app  = express();
const PORT = Number(process.env['PORT'] ?? 3000);

app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, '..', 'static')));
app.use('/api', api);
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'static', 'index.html'))
);

initPush();

// Run sync + reminders every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('Running scheduled sync...');
  const { main } = await import('./scripts/sync-and-remind');
  await main();
});

app.listen(PORT, '0.0.0.0', () => console.log(`🎵 Unplayed on http://0.0.0.0:${PORT}`));
