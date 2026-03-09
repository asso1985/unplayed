console.log('SERVER STARTING', new Date().toISOString(), 'PORT:', process.env['PORT']);

import express from 'express';
import path from 'path';
import { initPush } from './push';
import { router as api } from './routes/api';

const app  = express();
const PORT = Number(process.env['PORT'] ?? 3000);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'static')));
app.use('/api', api);
app.get('*', (_req, res) =>
  res.sendFile(path.join(__dirname, '..', 'static', 'index.html'))
);

initPush();
app.listen(PORT, '0.0.0.0', () => console.log(`🎵 Unplayed on http://0.0.0.0:${PORT}`));