# Dragon Ball Arena - Multiplayer Backend

Backend zrealizowany w Node.js, Express oraz Socket.IO, odpowiedzialny za zarządzanie rozgrywką multiplayer (autorytatywny serwer).

## Uruchamianie lokalne (Development)
1. Przejdź do katalogu serwera: `cd server`
2. Zainstaluj zależności: `npm install`
3. Uruchom serwer w trybie dev: `npm run dev` (używa nodemon + ts-node)

## Uruchamianie produkcyjne (Docker)
1. Zbuduj obraz: `docker build -t dba-server .`
2. Uruchom kontener: `docker run -p 3005:3005 dba-server`

## Architektura i funkcje
- **Socket.io Events:** `findMatch`, `matchFound`, `selectCharacter`, `draftUpdate`, `selectAction`, `battleUpdate`, `surrender`, `gameOver`
- **Autorytatywna walka:** Cała logika walki (obrażenia, efekty, energie) znajduje się po stronie serwera w pliku `src/gameEngine.ts`.
- **Matchmaking:** Zaimplementowany w `src/matchmaking.ts` oparty o kolejkę FIFO.
- **Odłączenia:** Obejmuje obsługę utraty połączenia i natychmiastowe poddanie walki (`handleDisconnect`).
