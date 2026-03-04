import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface User {
    id: string;
    name: string;
    password?: string;
    score: number; // MMR / ELO
    wins: number;
    losses: number;
    winStreak: number;
    bestStreak: number;
}

const DB_FILE = path.join(__dirname, '../../db.json');

let users: User[] = [];

export function loadDb() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
               users = parsed;
            } else if (parsed.users) {
               users = parsed.users;
            }
        }
    } catch (e) {
        console.error('Error loading DB:', e);
    }
}

export function saveDb() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify({ users }, null, 2));
    } catch (e) {
        console.error('Error saving DB:', e);
    }
}

export function getUserByName(name: string): User | undefined {
    return users.find(u => u.name === name);
}

export function getUserById(id: string): User | undefined {
    return users.find(u => u.id === id);
}

export function createUser(data: Partial<User>): User {
    const newUser: User = {
        id: uuidv4(),
        name: data.name || 'Unknown',
        password: data.password || '',
        score: data.score ?? 500, // Starting Elo
        wins: data.wins || 0,
        losses: data.losses || 0,
        winStreak: data.winStreak || 0,
        bestStreak: data.bestStreak || 0,
    };
    users.push(newUser);
    saveDb();
    return newUser;
}

export function updateUser(id: string, data: Partial<User>): User | null {
    const user = getUserById(id);
    if (!user) return null;
    
    Object.assign(user, data);
    saveDb();
    return user;
}

export function getLeaderboard(): User[] {
    return [...users].sort((a, b) => b.score - a.score);
}

// Initial load
loadDb();
