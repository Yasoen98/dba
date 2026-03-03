# Dragon Ball Arena

Przeglądarkowa gra turowa 3v3 inspirowana uniwersum Dragon Ball. Wybierz drużynę z 44 postaci, rozegraj draft, zarządzaj energią i pokonaj przeciwnika w taktycznej walce.

**Stack:** React 19 · TypeScript · Vite · Zustand · Lucide React
**Persystencja:** localStorage (brak backendu)
**Platforma:** dowolna przeglądarka

---

## Spis treści

1. [Uruchomienie](#uruchomienie)
2. [Przebieg gry](#przebieg-gry)
3. [System draftu](#system-draftu)
4. [System walki](#system-walki)
5. [System energii](#system-energii)
6. [Efekty statusu](#efekty-statusu)
7. [Postacie](#postacie)
8. [Bierne zdolności (pasywne)](#bierne-zdolności-pasywne)
9. [Punktacja i rangi](#punktacja-i-rangi)
10. [Struktura projektu](#struktura-projektu)
11. [Plusy i minusy](#plusy-i-minusy)
12. [Znane braki / TODO](#znane-braki--todo)

---

## Uruchomienie

```bash
git clone https://github.com/twoj-login/dragon-ball-arena.git
cd dragon-ball-arena
npm install
npm run dev
```

Otwórz `http://localhost:5173` w przeglądarce.

```bash
# Build produkcyjny
npm run build
npm run preview
```

Wymagania: **Node.js 18+**, **npm 9+**

---

## Przebieg gry

Gra składa się z 6 kolejnych ekranów (faz):

```
login → menu → matchmaking → draft → battle → gameOver
```

| Faza | Opis |
|------|------|
| **login** | Logowanie, rejestracja lub gra jako gość |
| **menu** | Ekran główny ze statystykami gracza |
| **matchmaking** | 30-sekundowy timer — po upływie przydzielany jest bot |
| **draft** | Naprzemienne wybieranie postaci do drużyny (3v3) |
| **battle** | Turowa walka 3v3 |
| **gameOver** | Wyniki, punkty, aktualizacja rangi |

---

## System draftu

### Zasady budżetu tierowego

Każda drużyna ma **6 punktów tieru** do wydania na 3 postacie:

| Tier | Koszt | Przykładowe postacie |
|------|-------|----------------------|
| 1 | 1 pkt | Krillin, Yamcha, Raditz... |
| 2 | 2 pkt | Piccolo, Gohan, Android 18... |
| 3 | 3 pkt | Goku SS, Frieza, Broly... |

**Ograniczenia:**
- Maks. **1 postać Tier 3** na drużynę
- Budżet 6 pkt → dozwolone kombinacje np.: T3+T2+T1, T2+T2+T2, T3+T1+T1+...

### Kolejność wyboru

Gracz i przeciwnik naprzemiennie wybierają po 1 postaci aż do skompletowania drużyn 3v3.

### AI bota (draft)

Bot stosuje strategię zbalansowanej drużyny:
1. **Pick 1** — postać z najwyższym ATK (dealer obrażeń)
2. **Pick 2** — postać z najwyższym HP+DEF (tank)
3. **Pick 3** — postać ze stunującą techniką (kontrola)

Bot respektuje budżet tierowy i limit postaci Tier 3.

---

## System walki

### Kolejność tur

- Gracz wykonuje akcje swoimi postaciami w dowolnej kolejności
- Każda postać może wykonać **1 akcję na rundę** (technikę lub unik)
- Po zakończeniu akcji wszystkich postaci gracza bot wykonuje swoje ruchy
- Runda kończy się gdy obie strony skończą działania

### Typy akcji

| Akcja | Opis |
|-------|------|
| **Technika** | Atak/efekt z kosztem energii i cooldownem |
| **Unik (dodge)** | Obrona z szansą na uchylenie następnego ataku; też ma cooldown |
| **Pomiń turę** | Kończy akcje wszystkich żywych postaci gracza |
| **Poddaj się** | Natychmiastowa przegrana — naliczane są kary punktowe |

### Obliczanie obrażeń

```
Obrażenia bazowe = (baseDamage × ATK atakującego) / DEF broniącego
Technika pierce   = pełne obrażenia bazowe (ignoruje DEF)
Technika drain    = obrażenia + heal atakującego o 50% zadanych dmg
Technika aoe      = uderza wszystkich żywych przeciwników
```

Modyfikatory nakładają się z pasywów:
- Pasywa ATK: `wolf_spirit`, `saiyan_pride`, `sleeping_warrior` itd.
- Pasywa DEF: `teamwork`, `gravity_mastery`, `perfect_adaptation` itd.
- Pasywa specjalne: `brute_force` (ignoruje 25% DEF), `fusion_power` (+12% wszystkim technikom)

### Cooldowny

Każda technika i unik mają własny cooldown (0–4 tury). Cooldown zmniejsza się co turę — postać nie może użyć zdolności gdy cooldown > 0.

### AI bota (walka)

Bot wybiera akcję w oparciu o priorytety:
1. Użyj stunującego ataku jeśli jest dostępny
2. Użyj piercing/aoe jeśli wróg nie jest stunowany
3. Użyj uniku jeśli HP < 40% i unik dostępny
4. Zaatakuj najsłabszą żywą postać gracza

---

## System energii

### Cztery typy energii

| Typ | Symbol | Opis |
|-----|--------|------|
| `ki` | Niebieski | Energie Ki, kamehameha |
| `physical` | Pomarańczowy | Ataki fizyczne |
| `special` | Fioletowy | Techniki specjalne |
| `universal` | Złoty | Dzikie (zastępuje dowolny typ) |

### Limity

- Maks. **5** jednostek jednego typu energii
- Maks. **10** jednostek łącznie
- Energii nie można mieć ujemnej — jeśli brakuje, technika jest zablokowana

### Przyrost energii

Na początku każdej rundy każda **żywa postać** generuje **1 jednostkę energii** losowego typu:

| Typ | Szansa |
|-----|--------|
| ki | 35% |
| physical | 30% |
| special | 25% |
| universal | 10% |

Dodatkowe źródła:
- `namekian_body` (Piccolo) — +1 special na start walki
- `infinite_energy` (Android 18) — +1 universal każdą rundę
- `android_link` (Android 17) — +1 physical każdą rundę
- Techniki z efektem `energy` — +2 universal natychmiast

---

## Efekty statusu

| Efekt | Czas trwania | Działanie |
|-------|-------------|-----------|
| **poison** | 3 tury | -5% max HP na turę |
| **bleed** | 2 tury | -7% max HP na turę |
| **stun** | 1–2 tury | Postać pomija swoje akcje |
| **weaken** | 2 tury | Obniżona skuteczność ataków |
| **buff / senzu** | 1–2 tury | +15% do zadawanych obrażeń |
| **regen** | 2–3 tury | +6% max HP na turę |
| **dodging** | 1 tura | Przygotowanie do uniku |
| **drain** | natychmiastowy | Obrażenia + leczy atakującego o 50% |
| **clear** | natychmiastowy | Usuwa: weaken, poison, bleed, stun |
| **energy** | natychmiastowy | +2 universal energy |
| **heal** | natychmiastowy | +25% max HP (siebie) |
| **healAll** | natychmiastowy | +20% max HP (całej drużyny) |
| **aoe** | natychmiastowy | Uderza wszystkich żywych wrogów |
| **pierce** | natychmiastowy | Obrażenia ignorują DEF |

---

## Postacie

Łącznie **44 postacie** w trzech tierach.

### Tier 1 — 21 postaci

| Postać | HP | ATK | DEF | Pasyw |
|--------|-----|-----|-----|-------|
| Krillin | 950 | 68 | 74 | teamwork |
| Yamcha | 820 | 80 | 62 | wolf_spirit |
| Videl | 880 | 72 | 70 | city_defender |
| Saibaman | 800 | 84 | 62 | death_grip |
| Raditz | 880 | 84 | 64 | low_class_fury |
| Dodoria | 940 | 76 | 72 | brute_force |
| Guldo | 780 | 65 | 82 | mental_fortress |
| Burter | 820 | 80 | 68 | speed_demon |
| Jeice | 810 | 78 | 65 | elite_soldier |
| Appule | 890 | 74 | 76 | elite_soldier |
| Chiaotzu | 760 | 66 | 78 | low_class_fury |
| Chi-Chi | 860 | 70 | 74 | iron_mother |
| Launch | 840 | 82 | 60 | battle_frenzy |
| General Blue | 850 | 68 | 78 | psychic_dominance |
| Mercenary Tao | 870 | 84 | 62 | first_strike |
| Cui | 840 | 76 | 66 | survivor_instinct |
| Yajirobe | 920 | 72 | 72 | opportunist |
| Nam | 880 | 72 | 76 | water_discipline |
| Spopovich | 980 | 76 | 70 | pain_immunity |
| Pui Pui | 860 | 72 | 80 | gravity_mastery |
| Bacterian | 930 | 74 | 68 | putrid_aura |

### Tier 2 — 12 postaci

| Postać | HP | ATK | DEF | Pasyw |
|--------|-----|-----|-----|-------|
| Piccolo | 1200 | 102 | 108 | namekian_body |
| Android 18 | 1150 | 114 | 96 | infinite_energy |
| Tien | 1100 | 110 | 102 | tri_form |
| Nappa | 1380 | 93 | 122 | saiyan_armor |
| Gohan | 1280 | 116 | 98 | sleeping_warrior |
| Trunks | 1240 | 114 | 104 | future_warrior |
| Android 16 | 1380 | 100 | 120 | iron_will |
| Android 17 | 1160 | 112 | 100 | android_link |
| Zarbon | 1200 | 106 | 108 | monster_transform |
| Recoome | 1360 | 108 | 116 | battle_pose |
| Bardock | 1150 | 118 | 88 | fathers_prophecy |
| Dabra | 1300 | 110 | 106 | demon_curse |

### Tier 3 — 11 postaci

| Postać | HP | ATK | DEF | Pasyw |
|--------|-----|-----|-----|-------|
| Goku SS | 1620 | 158 | 132 | saiyan_instinct |
| Vegeta SS | 1580 | 156 | 128 | saiyan_pride |
| Frieza | 1720 | 142 | 144 | immortal_body |
| Cell | 1820 | 144 | 150 | perfect_adaptation |
| Broly | 1790 | 158 | 140 | legendary_power |
| Cooler | 1720 | 148 | 144 | tyrant_pressure |
| Majin Buu | 1800 | 134 | 152 | rubbery_body |
| Captain Ginyu | 1600 | 144 | 136 | force_captain |
| Gogeta | 1760 | 154 | 142 | fusion_power |
| Vegito | 1750 | 160 | 148 | potara_mastery |
| Gotenks | 1620 | 148 | 130 | ghost_army |

---

## Bierne zdolności (pasywne)

Każda postać posiada unikalny pasyw aktywowany automatycznie.

### Tier 1

| Pasyw | Postać | Efekt |
|-------|--------|-------|
| teamwork | Krillin | DEF +10% za każdego żywego sojusznika |
| wolf_spirit | Yamcha | ATK +20% gdy HP < 50% |
| city_defender | Videl | +15% obrażeń przeciwko osłabionym wrogom |
| death_grip | Saibaman | ATK +30% gdy HP < 30% |
| low_class_fury | Raditz, Chiaotzu | ATK +5% każdą rundą (maks. +25%) |
| brute_force | Dodoria | Ignoruje 25% DEF przeciwnika |
| mental_fortress | Guldo | Odporność na weaken |
| speed_demon | Burter | Szansa uniku +20% |
| elite_soldier | Jeice, Appule | ATK +12% gdy ma żywego sojusznika |
| iron_mother | Chi-Chi | ATK +15% za każdego pokonanego sojusznika (maks. 2×) |
| battle_frenzy | Launch | ATK +8% za każde otrzymane trafienie (maks. 3×) |
| psychic_dominance | General Blue | Stun trwa o 1 turę dłużej |
| first_strike | Mercenary Tao | Pierwsza technika w rundzie +20% obrażeń |
| survivor_instinct | Cui | ATK +25% gdy HP < 40% |
| opportunist | Yajirobe | +15% obrażeń gdy cel ma negatywny status |
| water_discipline | Nam | Odporność na bleed |
| pain_immunity | Spopovich | Otrzymywane obrażenia -15% |
| gravity_mastery | Pui Pui | DEF +20% gdy HP > 60% |
| putrid_aura | Bacterian | Efekt bleed trwa o 1 turę dłużej |

### Tier 2

| Pasyw | Postać | Efekt |
|-------|--------|-------|
| namekian_body | Piccolo | +1 special energy na start walki |
| infinite_energy | Android 18 | +1 universal energy każdą rundą |
| tri_form | Tien | ATK +20% przy pełnym HP |
| saiyan_armor | Nappa | Otrzymywane obrażenia -12% |
| sleeping_warrior | Gohan | ATK +15% za każdego pokonanego sojusznika |
| future_warrior | Trunks | ATK +18% gdy HP < 50% |
| iron_will | Android 16 | Odporność na bleed i poison |
| android_link | Android 17 | +1 physical energy każdą rundą |
| monster_transform | Zarbon | Ataki drain +25% obrażeń |
| battle_pose | Recoome | Po udanym uniku: ATK +20% przez 1 turę |
| fathers_prophecy | Bardock | Pierwsze śmiertelne trafienie pozostawia 1 HP (raz) |
| demon_curse | Dabra | Stun trwa o 1 turę dłużej |

### Tier 3

| Pasyw | Postać | Efekt |
|-------|--------|-------|
| saiyan_instinct | Goku SS | Szansa uniku +20% |
| saiyan_pride | Vegeta SS | ATK +25% gdy HP < 35% |
| immortal_body | Frieza | Odporność na stun |
| perfect_adaptation | Cell | DEF +7% za każde otrzymane trafienie (maks. 3×) |
| legendary_power | Broly | ATK +5% za każde zadane trafienie (maks. 3×) |
| tyrant_pressure | Cooler | +20% obrażeń wobec zatrutych/osłabionych wrogów |
| rubbery_body | Majin Buu | Otrzymywane obrażenia -20% |
| force_captain | Captain Ginyu | ATK +20% gdy ma żywego sojusznika |
| fusion_power | Gogeta | Wszystkie techniki +12% obrażeń |
| potara_mastery | Vegito | Odporność na stun + ATK +10% gdy HP > 70% |
| ghost_army | Gotenks | Ataki aoe +20% obrażeń |

---

## Punktacja i rangi

### Formuła punktów po walce

**Wygrana:**
```
+50 (baza) + 30 × żywi_sojusznicy + 20 × zabici_wrogowie
```
Przykład: wygrana z 2 żywymi, 2 zabici = 50 + 60 + 40 = **+150 pkt**

**Przegrana:**
```
-(40 + 30 × żywi_wrogowie) + 10 × zabici_wrogowie
```
Przykład: przegrana z 1 żywym wrogiem, 1 zabity = -(40 + 30) + 10 = **-60 pkt**

**Poddanie się:**
```
-(40 + 30 × żywi_wrogowie) + 10 × zabici_wrogowie (jak przegrana)
```

### Progi rang

| Wynik | Ranga |
|-------|-------|
| ≥ 1000 | Super Saiyan God |
| ≥ 500 | Super Saiyan |
| ≥ 250 | Elite Warrior |
| ≥ 100 | Raditz |
| ≥ 0 | Saibaman |

### Statystyki gracza

Każde konto przechowuje:
- Łączny wynik punktowy
- Liczba wygranych / przegranych
- Bieżąca seria zwycięstw
- Najlepsza seria zwycięstw

---

## Struktura projektu

```
src/
├── types.ts                  # Wszystkie typy TypeScript
├── App.tsx                   # Router fazowy
├── main.tsx                  # Entry point
├── index.css / App.css       # Style globalne
├── data/
│   └── characters.ts         # Definicje 44 postaci (stats, techniki)
├── stores/
│   ├── rootStore.ts          # Łączy wszystkie slice'y (useGameState)
│   ├── authSlice.ts          # Autentykacja, wyniki, rangi
│   ├── gameSlice.ts          # Zarządzanie fazami gry
│   ├── draftSlice.ts         # Logika wyboru postaci
│   └── battleSlice.ts        # Cały silnik walki + AI bota
├── components/
│   ├── LoginScreen.tsx
│   ├── Matchmaking.tsx
│   ├── DraftScreen.tsx
│   ├── BattleArena.tsx
│   └── GameOverScreen.tsx
└── services/                 # Usługi pomocnicze

public/
└── assets/
    └── characters/           # Portrety postaci (.png / .svg)
```

### Kluczowe stałe (`src/types.ts`)

| Stała | Wartość | Znaczenie |
|-------|---------|-----------|
| `DRAFT_TIER_LIMIT` | 6 | Budżet tierowy drużyny |
| `DRAFT_MAX_LEGENDARY` | 1 | Maks. postaci Tier 3 |
| `ENERGY_TYPE_CAP` | 5 | Maks. energii jednego typu |

---

## Plusy i minusy

### Zalety

- **Bogaty roster** — 44 unikalne postacie z własnymi statystykami i zestawem technik; wierność klimatowi Dragon Ball
- **Taktyczny draft** — system budżetu tierowego zmusza do wyborów i kompromisów, eliminując optymalną "one-size-fits-all" drużynę
- **Głęboki system pasywów** — 35 unikalnych pasywów tworzących synergię i antysynergię między postaciami
- **Złożony system energii** — zarządzanie 4 typami energii z losową generacją dodaje warstwę ekonomiczną do walki
- **Różnorodność efektów statusu** — 14 różnych efektów (bleed, stun, drain, aoe, pierce...) zapewnia dużą różnorodność planów walki
- **Skalowalne AI** — bot stosuje priorytetowe drzewko decyzji zarówno w drafcie jak i walce
- **Bez backendu** — działa w całości w przeglądarce; instalacja to jeden `npm install`
- **Czysty kod** — modularny Zustand (4 slice'y), pełny TypeScript, łatwa rozbudowa
- **Szybki build** — Vite HMR, czas dev-build < 1s

### Wady / ograniczenia

- **Brak trybu multiplayer online** — gra przeciwko botowi; matchmaking symuluje oczekiwanie, ale nie łączy dwóch graczy w sieci
- **AI bota jest przewidywalne** — bot nie blefuje, nie planuje z wyprzedzeniem, wykonuje zawsze te same priorytety; doświadczony gracz szybko je rozgryzie
- **Lokalny storage = brak kont cross-device** — konto istnieje tylko w przeglądarce, na tym urządzeniu
- **Brak systemu porażki ochronnej** — można spaść poniżej 0 pkt i utknąć na randze Saibaman bez mechanizmu powrotu
- **Brakujące assety** — kilka portretów postaci i obrazków technik jeszcze nie istnieje (`saibaman.png`, `videl.png`, `martial_arts.png`)
- **Jedna mapa / brak animacji** — walka odbywa się na statycznym tle; brak animacji ataków
- **Brak dźwięku** — gra jest całkowicie cicha
- **Brak tutoriala** — nowy gracz musi samodzielnie odkryć zasady systemu energii, tierów i cooldownów
- **Balans postaci nie był testowany statystycznie** — niektóre pasywa (np. `fathers_prophecy`, `potara_mastery`) mogą być dominujące

---

## Znane braki / TODO

- [ ] Tryb multiplayer (WebSocket / backend)
- [ ] Brakujące obrazki technik (`martial_arts.png`) i portretów postaci
- [ ] Animacje ataków
- [ ] Efekty dźwiękowe / muzyka
- [ ] Tutorial dla nowych graczy
- [ ] Ranking globalny (wymaga backendu)
- [ ] Ekran historii meczy
- [ ] Balansowanie postaci na podstawie danych

---

## Licencja

Projekt edukacyjny / fanowski. Dragon Ball i wszelkie powiązane znaki towarowe należą do Akiry Toriyamy i Toei Animation. Ten projekt nie jest powiązany z oficjalnymi właścicielami marki.
