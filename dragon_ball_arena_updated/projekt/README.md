# Dragon Ball Arena ⚔️

Dynamiczna gra bitewna 3v3 w uniwersum Dragon Ball, zrealizowana w modelu **Multiplayer Real-time** z autorytatywnym serwerem.

## 🚀 Główne Funkcje

- **Prawdziwy Multiplayer**: Rozgrywka w czasie rzeczywistym oparta na WebSockets (Socket.io).
- **Autorytatywny Backend**: Wszystkie obliczenia (obrażenia, energia, statusy) odbywają się na serwerze, co zapobiega oszustwom.
- **System ELO & Ranking**: Zaawansowany algorytm dobierania przeciwników (MMR) oraz system ligowy (Bronze, Silver, Gold, Diamond).
- **Faza Draftu**: Strategiczny wybór drużyny z limitem punktowym (Tier Points).
- **System Walki**: 
  - Ponad 40 unikalnych postaci z własnymi technikami i pasywkami.
  - Efekty statusu: Poison, Bleed, Stun, Regen, AOE, Heal.
  - Zarządzanie 4 typami energii: Ki, Physical, Special, Universal.
- **Bogate Animacje**: Płynne efekty walki (Framer Motion), potrząsanie ekranem, pływające cyfry obrażeń.
- **System Audio**: Dynamiczna muzyka tła i efekty dźwiękowe (Howler.js).
- **Trwałe Konta Gościa**: Możliwość gry bez rejestracji z zapisem postępu na urządzeniu.

## 🛠 Technologia

### Frontend
- **React 19** + **TypeScript**
- **Vite** (Build tool)
- **Zustand** (State management - Slice pattern)
- **Framer Motion** (Animacje)
- **Socket.io-client** (Komunikacja)
- **Howler.js** (Audio)

### Backend
- **Node.js** + **Express**
- **Socket.io** (WebSocket server)
- **JSON-based Database** (Lokalna baza użytkowników)
- **Jest** (Testy silnika gry)

## 📦 Instalacja i Uruchomienie

### 1. Klonowanie repozytorium
```bash
git clone <url-twojego-repozytorium>
cd projekt
```

### 2. Instalacja zależności (Główny folder + Serwer)
```bash
npm install
cd server
npm install
cd ..
```

### 3. Konfiguracja Audio
Umieść pliki dźwiękowe w katalogu `public/assets/audio/`:
- `menu.mp3`, `battle.mp3`, `attack.wav`, `hit.wav`, `death.wav`, `win.wav`, `ui_hover.wav`

### 4. Uruchomienie deweloperskie
Wymagane dwa terminale:

**Terminal 1 (Serwer):**
```bash
cd server
npm run dev
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

Gra będzie dostępna pod adresem: `http://localhost:5000`

## 🐳 Docker (Backend)
Jeśli chcesz uruchomić serwer w kontenerze:
```bash
cd server
docker build -t dba-server .
docker run -p 3005:3005 dba-server
```

## 🧪 Testy
Uruchomienie testów logicznych systemu ELO i silnika gry:
```bash
cd server
npm test
```

Uruchomienie stresstestu (symulacja 200 graczy):
```bash
cd server
npx ts-node stressTest.ts 200
```

---
*Projekt stworzony w celach edukacyjnych i fanowskich. Dragon Ball jest własnością Akira Toriyama / Bird Studio / Shueisha / Toei Animation.*
