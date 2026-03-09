import express from 'express';

const app = express();
const PORT = Number(process.env['PORT'] ?? 3000);

app.get('/', (_req, res) => res.json({ ok: true, port: PORT }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`listening on 0.0.0.0:${PORT}`);
});