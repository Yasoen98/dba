# Bugfixes — Dragon Ball Arena

## Lista poprawionych problemów

---

### 🔴 #1 — `src/game/useGameState.ts` — Dead code (stary monolityczny store)
**Plik:** `src/game/useGameState.ts`  
**Problem:** Stary store, który nie jest importowany przez żadną część aplikacji. Zawierał inną (gorszą) logikę bota niż obecne slice'y, co mogło prowadzić do pomyłek.  
**Fix:** Plik zastąpiony komentarzem deprecation. Należy usunąć: `git rm src/game/useGameState.ts`

---

### 🔴 #2 — `GameOverScreen.tsx` — `pointsEarned` hardkodowane na 50
**Pliki:** `src/components/GameOverScreen.tsx`, `src/stores/battleSlice.ts`  
**Problem:** Ekran końca gry zawsze pokazywał "+50 punktów", niezależnie od faktycznie zdobytych/straconych punktów. Faktyczna logika punktów (z premią za żyjące postacie, penaltą za przegraną) była w `calculateBattlePoints()` ale jej wynik nie był wyświetlany.  
**Fix:**
- Dodano `lastBattlePoints: number` do stanu battleSlice
- Ustawiane jest przy każdym zakończeniu walki (wygrana gracza, wygrana bota, surrender)
- `GameOverScreen` pobiera `lastBattlePoints` ze store i wyświetla realne wartości (mogą być ujemne przy przegranej)

---

### 🔴 #3 — `gameSlice.ts` — `resetGame()` nie przywracał puli postaci
**Plik:** `src/stores/gameSlice.ts`  
**Problem:** `resetGame()` ustawiał `availableCharacters: []` zamiast pełnej listy. Po powrocie do menu i wejściu w nową grę draft był pusty — brak postaci do wyboru.  
**Fix:** Dodano import `INITIAL_CHARACTERS` i zmieniono na `availableCharacters: [...INITIAL_CHARACTERS]`

---

### 🟡 #4 — `characters.ts.bak` w repo
**Plik:** `.gitignore`  
**Problem:** Plik backup `src/data/characters.ts.bak` był śledzony przez git.  
**Fix:** Dodano `*.bak` do `.gitignore`. Usuń ręcznie: `git rm src/data/characters.ts.bak`

---

### 🟡 #5 — Menu "30 Fighters" — hardkodowana liczba
**Plik:** `src/App.tsx`  
**Problem:** Statystyka w menu zawsze pokazywała "30", niezależnie od rzeczywistej liczby postaci.  
**Fix:** Dodano import `INITIAL_CHARACTERS` i zmieniono na `{INITIAL_CHARACTERS.length}`

---

### 🟡 #6 — Dodge identyfikowany przez `name` zamiast stałego klucza
**Pliki:** `src/stores/battleSlice.ts`, `src/components/BattleArena.tsx`  
**Problem:** W `executePlayerAction` dodge był weryfikowany przez `activeChar.dodge.name !== actionId`. Przekazywano `dodge.name` jako `actionId`. Gdyby dwie postacie miały dodge o tej samej nazwie lub zmieniła się nazwa, logika by się posypała.  
**Fix:**
- W `BattleArena.tsx`: `executePlayerAction('dodge', 'dodge')` — stały klucz
- W `battleSlice.ts`: usunięto fragile check na `dodge.name`, identyfikacja po `actionType === 'dodge'`
- Cooldown zawsze pod kluczem `'dodge'` (było już poprawne)

---

### 🟢 #7 — `passTurn` nieużywane — przycisk "End Round" używał `endTurn`
**Pliki:** `src/components/BattleArena.tsx`, `src/stores/battleSlice.ts`  
**Problem:** Przycisk "End Round" wywoływał wewnętrzną metodę `endTurn()` zamiast `passTurn()`. `passTurn` prawidłowo loguje "passed turn" dla każdej postaci która nie wykonała akcji, a następnie wywołuje `endTurn`.  
**Fix:** Zmieniono destrukturyzację i `onClick` przycisku na `passTurn`

---

## Pliki do zastąpienia w repo

| Plik | Akcja |
|------|-------|
| `src/stores/gameSlice.ts` | Zastąp |
| `src/stores/battleSlice.ts` | Zastąp |
| `src/components/GameOverScreen.tsx` | Zastąp |
| `src/components/BattleArena.tsx` | Zastąp |
| `src/App.tsx` | Zastąp |
| `src/game/useGameState.ts` | Zastąp (lub `git rm`) |
| `.gitignore` | Zastąp |

## Polecenia czyszczące

```bash
# Usuń legacy store
git rm src/game/useGameState.ts

# Usuń plik backup
git rm src/data/characters.ts.bak
```
