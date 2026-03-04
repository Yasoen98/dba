import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initSocket } from './socket';
import { clearQueue, getQueueState } from './matchmaking';
import { getUserByName, createUser, updateUser, getLeaderboard } from './db';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Dragon Ball Arena Backend is running!');
});

// User Auth API
app.get('/api/users', (req, res) => {
  const name = req.query.name as string;
  if (!name) return res.json([]);
  const user = getUserByName(name);
  res.json(user ? [user] : []);
});

app.post('/api/users', (req, res) => {
  const newUser = createUser(req.body);
  res.json(newUser);
});

app.patch('/api/users/:id', (req, res) => {
  const updated = updateUser(req.params.id, req.body);
  if (updated) res.json(updated);
  else res.status(404).json({ error: 'User not found' });
});

// Leaderboard API
app.get('/api/leaderboard', (req, res) => {
  res.json(getLeaderboard());
});

// Admin – kolejka
app.get('/api/admin/queue', (_req, res) => {
  res.json(getQueueState());
});

app.delete('/api/admin/queue', (_req, res) => {
  const result = clearQueue();
  res.json(result);
});

app.post('/api/season/reset', (req, res) => {
  const users = getLeaderboard();
  for (const u of users) {
      updateUser(u.id, {
          score: 1000,
          wins: 0,
          losses: 0,
          winStreak: 0
      });
  }
  res.json({ message: 'Season reset successfully' });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Pass io to socket logic
initSocket(io);

const PORT = process.env.PORT || 3005;

httpServer.listen(PORT, () => {
  console.log(`Dragon Ball Arena Backend running on port ${PORT}`);
});
