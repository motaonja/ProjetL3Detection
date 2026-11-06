# Backend — Détection de doublons (Stage "Onja" / ConnectiQ)

API du moteur de détection de doublons et de rapprochement d'enregistrements
sans identifiant commun, conçue pour être consommée telle quelle par le
frontend React existant (`projetL3Stagedection`).

## Stack

- **Python / FastAPI** — API REST
- **pandas** — lecture et normalisation des fichiers CSV / XLSX / XLS
- **textdistance** — Levenshtein, Jaro-Winkler
- **Soundex** (implémentation maison) — codage phonétique des noms
- **PostgreSQL** — persistance des fichiers, enregistrements, résultats
- **Docker** — conteneur PostgreSQL (+ pgAdmin optionnel)

## Démarrage rapide

```bash
# 1. Démarrer PostgreSQL
docker compose up -d postgres

# 2. Installer les dépendances Python
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Configurer l'environnement
cp .env.example .env
# adapter DATABASE_URL / CORS_ORIGINS si besoin

# 4. Lancer l'API (les tables sont créées automatiquement au démarrage)
uvicorn app.main:app --reload --port 8000
```

L'API est alors disponible sur `http://localhost:8000`, avec une
documentation interactive Swagger sur `http://localhost:8000/docs`.

Le frontend (`npm run dev`, port 3000) peut y accéder directement — CORS
est déjà configuré pour `http://localhost:3000`.

## Architecture

```
app/
├── main.py              # Point d'entrée FastAPI, montage des routers, CORS
├── core/
│   ├── config.py        # Configuration (variables d'environnement)
│   └── utils.py         # Formatage (dates, tailles de fichiers)
├── db/
│   └── database.py       # Engine SQLAlchemy, session
├── models/
│   └── models.py         # Modèles SQLAlchemy (miroir de src/types.ts)
├── schemas/
│   └── schemas.py         # Schémas Pydantic (contrat API = src/types.ts)
├── services/
│   ├── file_parser.py     # Lecture CSV/XLSX avec pandas + mapping de colonnes
│   └── matching.py        # Moteur de rapprochement (cœur du sujet de stage)
└── api/
    ├── files.py            # Import / liste / suppression de fichiers
    ├── records.py          # CRUD enregistrements
    ├── analysis.py         # Lancement de l'analyse, résultats
    ├── arbitration.py      # Arbitrage humain des cas incertains
    ├── history.py          # Historique des analyses
    └── stats.py             # Statistiques / dashboard
```

## Le moteur de rapprochement (`services/matching.py`)

Pour chaque paire d'enregistrements candidate :

1. **Normalisation** : suppression des accents, mise en minuscule,
   nettoyage des espaces ; les numéros de téléphone sont réduits à leurs
   seuls chiffres (indicatif +261 / 0 retiré) pour comparer
   `034 12 345 67`, `0341234567` et `+261 34 12 345 67` équitablement.
2. **Similarité par champ** :
   - `nom` : combinaison de Levenshtein + Jaro-Winkler, en testant aussi
     les mots du nom réordonnés (`Jean Rakoto` ≈ `Rakoto Jean`), et
     boostée si le **codage phonétique (Soundex)** des deux noms
     concorde (ex: fautes de frappe qui se prononcent pareil).
   - `email`, `adresse`, `ville` : Levenshtein + Jaro-Winkler.
   - `telephone` : comparaison sur les chiffres normalisés.
3. **Score global** : moyenne pondérée (nom 35 %, email 25 %,
   téléphone 20 %, adresse 12 %, ville 8 %), sur 100.
4. **Classification** selon deux seuils configurables
   (`SEUIL_DOUBLON` = 85 par défaut, `SEUIL_INCERTAIN` = 60) :
   - `score ≥ SEUIL_DOUBLON` → `duplicate` ("Doublon probable")
   - `SEUIL_INCERTAIN ≤ score < SEUIL_DOUBLON` → `uncertain` ("Cas incertain")
   - en dessous → `different` (non remonté par défaut, sauf paires déjà
     proches du seuil)

Pour limiter le nombre de comparaisons sur de gros volumes, un
**blocage** est appliqué (Soundex du premier mot du nom) ; en dessous de
400 enregistrements, toutes les paires sont comparées par sécurité.

## Principaux endpoints

| Méthode | Route                              | Description                                      |
|---------|-------------------------------------|---------------------------------------------------|
| POST    | `/api/files/upload`                | Importe un ou plusieurs fichiers CSV/XLSX/XLS      |
| GET     | `/api/files`                       | Liste les fichiers importés                        |
| DELETE  | `/api/files/{file_id}`             | Supprime un fichier et ses enregistrements          |
| GET     | `/api/records`                     | Liste les enregistrements                           |
| POST    | `/api/analysis/run`                | Lance le moteur de rapprochement                    |
| GET     | `/api/analysis/results`            | Résultats de la dernière analyse                    |
| GET     | `/api/analysis/results/{match_id}` | Détail d'une correspondance                         |
| POST    | `/api/arbitration/{match_id}`      | Confirme/rejette un cas incertain                    |
| POST    | `/api/arbitration/reset`           | Réinitialise l'arbitrage des cas incertains          |
| GET     | `/api/history`                     | Historique des analyses lancées                      |
| GET     | `/api/stats/dashboard`             | Statistiques agrégées (tableau de bord)               |

Tous les schémas de réponse correspondent exactement aux interfaces
TypeScript de `src/types.ts` (`DataRecord`, `UploadedFile`, `MatchPair`,
`FieldComparison`, `AnalysisHistoryItem`), pour un branchement direct côté
frontend (remplacer `mockData.ts` par des appels `fetch`/`axios` vers ces
routes).


## Connexion et protection des donnees

L'application demande un compte avant d'acceder aux routes de donnees. Le premier compte cree rattache les anciennes donnees sans proprietaire; les comptes suivants ne voient que leurs propres fichiers et analyses. En developpement, `AUTH_COOKIE_SECURE=false` permet les cookies sur HTTP local. En production, servir l'interface et `/api` sur la meme origine via HTTPS et definir `AUTH_COOKIE_SECURE=true`.

Pour la confirmation d'adresse e-mail, renseigner `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` et `FRONTEND_BASE_URL` dans `backend/.env`. Le lien de confirmation expire apres 30 minutes.
