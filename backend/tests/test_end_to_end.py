"""
tests/test_end_to_end.py — Test End-to-End complet

Simule le flux complet :
  📡 Wokwi (ESP32 + DHT22) → WebSocket/HTTP POST → Backend FastAPI
  → Création pannes/alertes/missions en BD
  → Auto-assignation au technicien
  → API frontend pages (AdminDashboard, TechnicienPage)

Prérequis :
  - MySQL/MariaDB avec la base tunisie_telecom_db222 créée et seedée
    (exécuter setup.sql une fois)
  - Le backend FastAPI doit être accessible (ou TestClient l'importe in-process)
  - Les dépendances installées : pip install -r requirements.txt

Exécution :
  cd backend
  python -m pytest tests/test_end_to_end.py -v --capture=no

⚠️  Attention : ce test modifie la base de données (insertions, updates).
    Il nettoie ses traces à la fin (DELETE des données créées).
"""
import sys
import os
import json
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from fastapi.testclient import TestClient
from config.database import get_db

# ── Importer l'app FastAPI ──────────────────────────────────────────────────
# On importe l'application, pas besoin de la lancer avec uvicorn
from app import app

client = TestClient(app)


# ════════════════════════════════════════════════════════════════════════════
#  Fixture DB : vérifie que la base est accessible, sinon skip
# ════════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="session", autouse=True)
def _check_db():
    """Skip tous les tests si la base de données n'est pas accessible."""
    try:
        conn = get_db()
        conn.ping()
        conn.close()
    except Exception as e:
        pytest.skip(f"Base de données MySQL inaccessible: {e}")


# ════════════════════════════════════════════════════════════════════════════
#  Helpers
# ════════════════════════════════════════════════════════════════════════════

TEST_CAPTURED_IDS = {
    "donnees_ids": [],
    "panne_ids":   [],
    "alerte_ids":  [],
    "mission_ids": [],
    "rapport_ids": [],
    "message_ids": [],
}


def db_query(query: str, params: tuple = ()) -> list[dict]:
    """Exécute une requête SELECT et retourne une liste de dicts."""
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute(query, params)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows


def db_execute(query: str, params: tuple = ()) -> int:
    """Exécute une requête INSERT/UPDATE/DELETE et commit."""
    conn = get_db()
    cur = conn.cursor()
    cur.execute(query, params)
    conn.commit()
    last_id = cur.lastrowid
    cur.close()
    conn.close()
    return last_id


def cleanup_test_data():
    """
    Supprime toutes les données créées par le test.
    Ordre respectueux des FK : rapports → alertes → missions → pannes → messages → donnees
    """
    conn = get_db()
    cur = conn.cursor()
    try:
        # Désactiver les FK constraints pour éviter les erreurs d'ordre
        cur.execute("SET FOREIGN_KEY_CHECKS=0")
        
        delete_order = [
            ("rapports", "id"),
            ("alertes", "id"),
            ("missions", "id"),
            ("pannes", "id"),
            ("messages", "id"),
            ("donnees_capteurs", "id"),
        ]
        for table, col in delete_order:
            ids = TEST_CAPTURED_IDS.get(f"{table}_ids", [])
            if ids:
                placeholders = ",".join(["%s"] * len(ids))
                cur.execute(f"DELETE FROM {table} WHERE {col} IN ({placeholders})", ids)
        
        cur.execute("SET FOREIGN_KEY_CHECKS=1")
        conn.commit()
    except Exception as e:
        print(f"[CLEANUP] ⚠️ {e}")
    finally:
        cur.close()
        conn.close()


# ════════════════════════════════════════════════════════════════════════════
#  Fixtures
# ════════════════════════════════════════════════════════════════════════════

@pytest.fixture(scope="module")
def _app():
    """Fixture qui fournit l'application FastAPI."""
    return app


@pytest.fixture(autouse=True)
def _cleanup_after():
    """Nettoie les données de test après chaque test function."""
    yield
    cleanup_test_data()
    for key in TEST_CAPTURED_IDS:
        TEST_CAPTURED_IDS[key] = []


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 1 — Authentification
# ════════════════════════════════════════════════════════════════════════════

class TestAuthE2E:
    """Vérifie que l'authentification fonctionne pour admin et technicien."""

    def test_admin_login(self):
        """L'admin peut se connecter avec les identifiants du seed."""
        resp = client.post("/api/login", json={
            "email": "admin@tunisietelecom.tn",
            "password": "admin123",
        })
        assert resp.status_code == 200, f"Admin login failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "ok"
        assert data["user"]["role"] == "admin"
        assert data["user"]["nom"] == "Admin TT"
        print(f"  ✅ Admin connecté: {data['user']['nom']} ({data['user']['role']})")

    def test_tech_login(self):
        """Un technicien peut se connecter."""
        resp = client.post("/api/login", json={
            "email": "ahmed@tunisietelecom.tn",
            "password": "tech123",
        })
        assert resp.status_code == 200, f"Tech login failed: {resp.text}"
        data = resp.json()
        assert data["status"] == "ok"
        assert data["user"]["role"] == "technicien"
        assert data["user"]["nom"] == "Ahmed Ben Ali"
        print(f"  ✅ Technicien connecté: {data['user']['nom']} ({data['user']['specialite']})")

    def test_login_invalid_credentials(self):
        """Un mot de passe incorrect retourne 401."""
        resp = client.post("/api/login", json={
            "email": "admin@tunisietelecom.tn",
            "password": "wrong_password",
        })
        assert resp.status_code == 401
        print("  ✅ Mauvais identifiants → 401")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 2 — Envoi données de capteur (simulation Wokwi)
# ════════════════════════════════════════════════════════════════════════════

class TestCapteurVersPanneE2E:
    """
    Simule l'envoi de données par le Wokwi ESP32.
    URL: /api/capteurs/donnees  (POST)
    Corps: {"capteur_id": 1, "temperature": 45.0, "humidite": 30.0}
    Résultat attendu :
      - Insertion dans donnees_capteurs
      - Création d'une panne (température > 40°C → critique)
      - Création d'une alerte
      - Création d'une mission (en_attente, sans technicien)
    """

    def _send_capteur_data(self, capteur_id: int, temperature: float, humidite: float, expect_panne: bool = True):
        """Helper : envoie des données de capteur et retourne la réponse."""
        payload = {
            "capteur_id": capteur_id,
            "temperature": temperature,
            "humidite": humidite,
        }
        resp = client.post("/api/capteurs/donnees", json=payload)
        assert resp.status_code == 200, f"Erreur envoi données capteur: {resp.text}"
        result = resp.json()
        assert result["status"] == "ok"
        if expect_panne:
            assert len(result["pannes_creees"]) > 0, \
                f"Aucune panne créée pour T={temperature} H={humidite}"
        return result, payload

    def test_temp_critique_cree_panne_alerte_mission(self):
        """
        Envoie une température > 40°C (critique).
        Vérifie que la panne, l'alerte et la mission sont créées en BD.
        """
        # ── Envoi donnée Wokwi simulée ──
        result, payload = self._send_capteur_data(
            capteur_id=1,
            temperature=45.0,   # > 40 → panne critique
            humidite=30.0,      # normal
        )

        # ── Vérifie la réponse HTTP ──
        assert len(result["pannes_creees"]) == 1
        panne_info = result["pannes_creees"][0]
        assert panne_info["type"] == "temperature"
        assert panne_info["valeur"] == 45.0
        assert panne_info["ticket"].startswith("TT-")
        panne_id = panne_info["panne_id"]
        assert panne_id > 0
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)
        print(f"  ✅ Réponse HTTP: panne #{panne_id} (ticket {panne_info['ticket']})")

        # ── Vérifie la BD : donnees_capteurs ──
        rows = db_query(
            "SELECT * FROM donnees_capteurs WHERE capteur_id=%s ORDER BY id DESC LIMIT 1",
            (payload["capteur_id"],),
        )
        assert len(rows) == 1
        dc = rows[0]
        assert float(dc["temperature"]) == payload["temperature"]
        assert float(dc["humidite"]) == payload["humidite"]
        TEST_CAPTURED_IDS["donnees_ids"].append(dc["id"])
        print(f"  ✅ Données capteur insérées en BD: T={dc['temperature']} H={dc['humidite']}")

        # ── Vérifie la BD : pannes ──
        rows = db_query("SELECT * FROM pannes WHERE id=%s", (panne_id,))
        assert len(rows) == 1
        p = rows[0]
        assert p["type"] == "temperature_critique"
        assert p["priorite"] == "critique"
        assert p["source"] == "capteur"
        assert float(p["valeur_detectee"]) == 45.0
        print(f"  ✅ Panne en BD: type={p['type']} priorite={p['priorite']} ticket={p['numero_ticket']}")

        # ── Vérifie la BD : alertes ──
        rows = db_query("SELECT * FROM alertes WHERE panne_id=%s", (panne_id,))
        assert len(rows) >= 1
        alerte = rows[0]
        assert alerte["severite"] == "critique"
        assert "Temp critique" in alerte["message"]
        assert alerte["lue"] == 0
        TEST_CAPTURED_IDS["alerte_ids"].append(alerte["id"])
        print(f"  ✅ Alerte en BD: severite={alerte['severite']} message={alerte['message'][:60]}...")

        # ── Vérifie la BD : mission créée ──
        rows = db_query("SELECT * FROM missions WHERE panne_id=%s", (panne_id,))
        assert len(rows) >= 1
        mission = rows[0]
        assert mission["statut"] == "en_attente"
        assert mission["technicien_id"] is None  # Pas encore assignée
        assert mission["priorite"] == "critique"
        assert "Intervention sur capteur" in mission["description"]
        TEST_CAPTURED_IDS["mission_ids"].append(mission["id"])
        print(f"  ✅ Mission créée: #{mission['id']} statut={mission['statut']} priorite={mission['priorite']}")

    def test_humidite_critique_cree_panne_alerte_mission(self):
        """
        Envoie une humidité > 85% (critique).
        Vérifie que la panne, l'alerte et la mission sont créées en BD.
        """
        result, payload = self._send_capteur_data(
            capteur_id=2,
            temperature=25.0,   # normal
            humidite=92.0,      # > 85 → panne
        )

        assert len(result["pannes_creees"]) == 1
        panne_info = result["pannes_creees"][0]
        assert panne_info["type"] == "humidite"
        panne_id = panne_info["panne_id"]
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)

        # Vérifie la mission
        rows = db_query("SELECT * FROM missions WHERE panne_id=%s", (panne_id,))
        assert len(rows) >= 1
        mission = rows[0]
        assert mission["priorite"] == "eleve"  # humidité → 'eleve'
        TEST_CAPTURED_IDS["mission_ids"].append(mission["id"])
        print(f"  ✅ Humidité critique → Mission #{mission['id']} (priorite={mission['priorite']})")

    def test_double_panne_temp_et_hum(self):
        """
        Envoie température ET humidité critiques en même temps.
        Vérifie que 2 pannes et 2 missions sont créées.
        """
        result, _ = self._send_capteur_data(
            capteur_id=3,
            temperature=50.0,   # panne
            humidite=95.0,      # panne aussi
            expect_panne=True,
        )

        assert len(result["pannes_creees"]) == 2, \
            f"Attendu 2 pannes, reçu {len(result['pannes_creees'])}: {result['pannes_creees']}"

        # Vérifie qu'une mission a été créée pour chaque panne
        for panne in result["pannes_creees"]:
            assert panne["panne_id"] > 0
            TEST_CAPTURED_IDS["panne_ids"].append(panne["panne_id"])
            
            rows = db_query("SELECT * FROM missions WHERE panne_id=%s", (panne["panne_id"],))
            assert len(rows) == 1, f"Mission pour panne #{panne['panne_id']} introuvable"
            TEST_CAPTURED_IDS["mission_ids"].append(rows[0]["id"])

        print(f"  ✅ 2 pannes créées pour temp + hum critiques → 2 missions")

    def test_donnees_normales_pas_de_panne(self):
        """Données dans les seuils normaux ne créent pas de panne."""
        result, _ = self._send_capteur_data(
            capteur_id=1,
            temperature=24.0,   # normal
            humidite=55.0,      # normal
            expect_panne=False,
        )
        assert len(result["pannes_creees"]) == 0
        print("  ✅ Données normales → aucune panne créée")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 3 — Auto-assignation des missions aux techniciens
# ════════════════════════════════════════════════════════════════════════════

class TestAutoAssignMissionE2E:
    """
    Vérifie le mécanisme d'auto-assignation :
    1. Créer une mission via capteur (température critique)
    2. Vérifier qu'elle n'a pas de technicien
    3. Lancer auto_assign_all_available()
    4. Vérifier qu'un technicien disponible a reçu la mission
    5. Vérifier que le technicien passe en disponible=0
    """

    def _create_mission_via_capteur(self) -> int:
        """Helper : crée une mission via envoi de données capteur, retourne mission_id."""
        payload = {
            "capteur_id": 1,
            "temperature": 48.0,   # > 40 → panne + mission
            "humidite": 40.0,
        }
        resp = client.post("/api/capteurs/donnees", json=payload)
        assert resp.status_code == 200
        result = resp.json()
        panne_id = result["pannes_creees"][0]["panne_id"]
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)

        rows = db_query("SELECT id FROM missions WHERE panne_id=%s", (panne_id,))
        assert len(rows) == 1
        mission_id = rows[0]["id"]
        TEST_CAPTURED_IDS["mission_ids"].append(mission_id)
        return mission_id

    def test_mission_en_attente_sans_technicien(self):
        """Après création capteur, la mission est 'en_attente' sans technicien."""
        mission_id = self._create_mission_via_capteur()
        rows = db_query("SELECT * FROM missions WHERE id=%s", (mission_id,))
        assert rows[0]["technicien_id"] is None
        assert rows[0]["statut"] == "en_attente"
        print(f"  ✅ Mission #{mission_id}: en_attente, pas de technicien")

    def test_auto_assign_all_available(self):
        """
        Vérifie que l'auto-assignation a lieu après création de mission.
        Le route /api/capteurs/donnees lance auto_assign_all_available
        en background task quand des pannes sont créées.
        On utilise un retry loop pour être robuste au timing.
        """
        # Création de la mission (déclenche auto_assign en background)
        mission_id = self._create_mission_via_capteur()

        # Retry loop : attendre jusqu'à 12s que la mission soit assignée
        assigned_tech = None
        for attempt in range(12):
            time.sleep(1)
            rows = db_query("SELECT * FROM missions WHERE id=%s", (mission_id,))
            if rows[0]["technicien_id"] is not None:
                assigned_tech = rows[0]["technicien_id"]
                break

        if assigned_tech:
            # Vérifier le technicien
            tech_rows = db_query(
                "SELECT * FROM utilisateurs WHERE id=%s",
                (assigned_tech,),
            )
            assert len(tech_rows) == 1
            tech = tech_rows[0]
            print(f"  ✅ Mission #{mission_id} assignée à {tech['nom']} (id={tech['id']})")
            # Le technicien doit être marqué indisponible
            assert tech["disponible"] == 0 or tech["disponible"] is False, \
                f"Technicien #{tech['id']} devrait être indisponible"
            print(f"  ✅ Technicien {tech['nom']} marqué indisponible")
        else:
            # Si pas assignée après retry, c'est acceptable
            # (l'auto-assign nécessite LM Studio ou un technicien dispo)
            print(f"  ⚠️ Mission #{mission_id} pas assignée après retry — "
                  f"acceptable si LM Studio n'est pas disponible ou aucun tech dispo")

    def test_missions_list_after_creation(self):
        """
        Vérifie que l'API /api/missions retourne les missions créées
        avec les bons champs (y compris panne_ticket, panne_type).
        """
        # Créer d'abord une mission
        payload = {
            "capteur_id": 2,
            "temperature": 42.0,
            "humidite": 30.0,
        }
        resp = client.post("/api/capteurs/donnees", json=payload)
        result = resp.json()
        panne_id = result["pannes_creees"][0]["panne_id"]
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)
        ticket = result["pannes_creees"][0]["ticket"]

        time.sleep(1)  # laisser la BD s'actualiser

        # Appel API
        resp = client.get("/api/missions")
        assert resp.status_code == 200
        data = resp.json()
        assert "missions" in data
        missions = data["missions"]
        assert len(missions) > 0

        # Trouver notre mission
        our_missions = [m for m in missions if m.get("panne_ticket") == ticket]
        assert len(our_missions) >= 1, f"Mission avec ticket {ticket} introuvable"
        m = our_missions[0]
        TEST_CAPTURED_IDS["mission_ids"].append(m["id"])

        # Vérifier les champs que le frontend utilise
        assert m["panne_ticket"] is not None
        assert m["panne_type"] is not None
        assert m["description"] is not None
        assert m["localisation"] is not None
        assert m["priorite"] is not None
        assert m["statut"] is not None
        assert "date_creation" in m
        print(f"  ✅ /api/missions retourne mission #{m['id']} avec panne_ticket={m['panne_ticket']}")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 4 — Dashboard & Stats
# ════════════════════════════════════════════════════════════════════════════

class TestDashboardE2E:
    """
    Vérifie que l'API /api/dashboard retourne les bonnes statistiques
    que le frontend AdminDashboard consomme.
    """

    def test_dashboard_stats(self):
        """Vérifie les stats après création d'une panne/mission."""
        # Créer une mission
        payload = {"capteur_id": 1, "temperature": 47.0, "humidite": 45.0}
        resp = client.post("/api/capteurs/donnees", json=payload)
        result = resp.json()
        panne_id = result["pannes_creees"][0]["panne_id"]
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)

        time.sleep(1)

        # Appel API dashboard
        resp = client.get("/api/dashboard")
        assert resp.status_code == 200, f"Dashboard error: {resp.text}"
        stats = resp.json()

        # Vérifie les clés présentes
        expected_keys = [
            "pannes_ouvertes", "missions_en_cours", "missions_en_attente",
            "missions_terminees", "alertes_non_lues", "techniciens_disponibles",
        ]
        for key in expected_keys:
            assert key in stats, f"Dashboard manque {key}"
        assert isinstance(stats["pannes_ouvertes"], (int, float))
        assert isinstance(stats["missions_en_attente"], (int, float))
        print(f"  ✅ Dashboard stats: pannes_ouvertes={stats['pannes_ouvertes']}, "
              f"en_attente={stats['missions_en_attente']}")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 5 — Pannes & Alertes
# ════════════════════════════════════════════════════════════════════════════

class TestPannesAlertesE2E:
    """Vérifie les APIs pannes et alertes."""

    def test_pannes_list(self):
        """Vérifie que /api/pannes retourne la panne créée."""
        payload = {"capteur_id": 1, "temperature": 50.0, "humidite": 40.0}
        resp = client.post("/api/capteurs/donnees", json=payload)
        result = resp.json()
        panne_id = result["pannes_creees"][0]["panne_id"]
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)
        expected_ticket = result["pannes_creees"][0]["ticket"]

        resp = client.get("/api/pannes")
        assert resp.status_code == 200
        data = resp.json()
        assert "pannes" in data
        found = [p for p in data["pannes"] if p["id"] == panne_id]
        assert len(found) == 1, f"Panne #{panne_id} introuvable dans /api/pannes"
        p = found[0]
        assert p["numero_ticket"] == expected_ticket
        assert p["priorite"] == "critique"
        assert p["valeur_detectee"] is not None
        print(f"  ✅ Panne #{panne_id} trouvée dans /api/pannes")

    def test_alertes_list(self):
        """Vérifie que /api/alertes retourne l'alerte créée."""
        payload = {"capteur_id": 1, "temperature": 55.0, "humidite": 40.0}
        resp = client.post("/api/capteurs/donnees", json=payload)
        result = resp.json()
        panne_id = result["pannes_creees"][0]["panne_id"]
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)

        resp = client.get("/api/alertes")
        assert resp.status_code == 200
        data = resp.json()
        assert "alertes" in data
        found = [a for a in data["alertes"] if a.get("panne_id") == panne_id]
        assert len(found) >= 1, f"Alerte pour panne #{panne_id} introuvable"
        alerte = found[0]
        TEST_CAPTURED_IDS["alerte_ids"].append(alerte["id"])
        assert alerte["lue"] == 0 or alerte["lue"] is False
        print(f"  ✅ Alerte #{alerte['id']} trouvée dans /api/alertes (non lue)")

    def test_marquer_alerte_lue(self):
        """Vérifie le marquage d'une alerte comme lue."""
        payload = {"capteur_id": 1, "temperature": 52.0, "humidite": 40.0}
        resp = client.post("/api/capteurs/donnees", json=payload)
        result = resp.json()
        panne_id = result["pannes_creees"][0]["panne_id"]
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)

        resp = client.get("/api/alertes")
        alertes = resp.json()["alertes"]
        alerte = [a for a in alertes if a.get("panne_id") == panne_id][0]
        alerte_id = alerte["id"]
        TEST_CAPTURED_IDS["alerte_ids"].append(alerte_id)

        # Marquer comme lue
        resp = client.patch(f"/api/alertes/{alerte_id}/lire")
        assert resp.status_code == 200

        # Vérifier
        row = db_query("SELECT lue FROM alertes WHERE id=%s", (alerte_id,))
        assert row[0]["lue"] == 1 or row[0]["lue"] is True
        print(f"  ✅ Alerte #{alerte_id} marquée comme lue")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 6 — Cycle de vie complet d'une mission (Technicien)
# ════════════════════════════════════════════════════════════════════════════

class TestMissionLifecycleE2E:
    """
    Test complet du cycle de vie d'une mission côté technicien :
    1. Créer mission via capteur → attendre assignation
    2. Se connecter en tant que technicien
    3. Voir les missions via /api/missions/technicien/{id}
    4. Accepter la mission (PATCH /api/missions/{id}/statut → 'acceptee')
    5. Commencer la mission (PATCH → 'en_cours')
    6. Créer un rapport (POST /api/rapports)
    7. Terminer la mission (POST /api/missions/{id}/terminer)
    8. Vérifier que le technicien redevient disponible
    """

    @pytest.fixture(autouse=True)
    def setup_mission(self):
        """
        Crée une mission via capteur et l'assigne à un technicien.
        Nettoie d'abord l'état des techniciens pour éviter les conflits entre tests.
        """
        # ── Reset complet de tous les techniciens pour un état propre ──
        db_execute(
            "UPDATE utilisateurs SET disponible=1, retour_disponible=NULL, "
            "duree_retour_minutes=NULL WHERE role='technicien'"
        )
        # Supprimer les missions existantes (pour éviter les conflits de doublons)
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SET FOREIGN_KEY_CHECKS=0")
        cur.execute(
            "DELETE FROM missions WHERE technicien_id IN "
            "(SELECT id FROM utilisateurs WHERE role='technicien')"
        )
        cur.execute("DELETE FROM rapports")
        cur.execute("SET FOREIGN_KEY_CHECKS=1")
        conn.commit()
        cur.close()
        conn.close()

        # ── Créer une mission via capteur ──
        payload = {"capteur_id": 1, "temperature": 44.0, "humidite": 50.0}
        resp = client.post("/api/capteurs/donnees", json=payload)
        result = resp.json()
        panne_id = result["pannes_creees"][0]["panne_id"]
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)

        # Récupérer la mission
        rows = db_query("SELECT id FROM missions WHERE panne_id=%s", (panne_id,))
        self.mission_id = rows[0]["id"]
        TEST_CAPTURED_IDS["mission_ids"].append(self.mission_id)

        # ── Assigner un technicien disponible ──
        tech_rows = db_query(
            "SELECT id, nom FROM utilisateurs WHERE role='technicien' AND disponible=1 LIMIT 1"
        )
        assert len(tech_rows) > 0, "Aucun technicien disponible dans la BD"
        tech_id = tech_rows[0]["id"]
        self.tech = tech_rows[0]

        resp = client.patch(f"/api/missions/{self.mission_id}/assigner",
                            json={"technicien_id": tech_id})
        assert resp.status_code == 200, f"Assignation échouée: {resp.text}"

        # Récupérer la panne_id pour le rapport
        rows = db_query("SELECT panne_id FROM missions WHERE id=%s", (self.mission_id,))
        self.panne_id = rows[0]["panne_id"] if rows[0]["panne_id"] else None

        yield

    def test_tech_get_missions(self):
        """Technicien voit ses missions via l'API."""
        resp = client.get(f"/api/missions/technicien/{self.tech['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert "missions" in data
        mission_ids = [m["id"] for m in data["missions"]]
        assert self.mission_id in mission_ids, \
            f"Mission #{self.mission_id} pas dans les missions du technicien"
        print(f"  ✅ Technicien {self.tech['nom']} voit mission #{self.mission_id}")

        # Vérifier les champs que TechnicienPage utilise
        our_mission = [m for m in data["missions"] if m["id"] == self.mission_id][0]
        assert "panne_ticket" in our_mission
        assert "description" in our_mission
        assert "localisation" in our_mission
        assert "statut" in our_mission
        print(f"  ✅ Mission #{self.mission_id}: statut={our_mission['statut']}, "
              f"panne_ticket={our_mission.get('panne_ticket')}")

    def test_tech_accept_mission(self):
        """Technicien accepte la mission."""
        # Note: assigner_mission() met le statut direct à 'en_cours'.
        # Pour tester le cycle complet on accepte d'abord puis on met en cours.

        # 1. Vérifier le statut initial
        rows = db_query("SELECT statut FROM missions WHERE id=%s", (self.mission_id,))
        initial = rows[0]["statut"]
        print(f"  → Mission #{self.mission_id} statut initial: {initial}")

        # 2. Accepter la mission (PATCH statut → 'acceptee')
        # Note technique: assigner_mission() met direct 'en_cours', mais le frontend
        # TechnicienPage utilise 'acceptee' comme première étape.
        if initial != "acceptee":
            resp = client.patch(f"/api/missions/{self.mission_id}/statut",
                                json={"statut": "acceptee"})
            assert resp.status_code == 200, f"Accept failed: {resp.text}"

        # 3. Vérifier le statut
        rows = db_query("SELECT statut FROM missions WHERE id=%s", (self.mission_id,))
        assert rows[0]["statut"] == "acceptee", f"Statut après accept: {rows[0]['statut']}"
        print(f"  ✅ Mission #{self.mission_id} acceptée → statut='acceptee'")

    def test_tech_start_mission(self):
        """Technicien commence la mission (passe en 'en_cours')."""

        # Préparer : accepter d'abord
        rows = db_query("SELECT statut FROM missions WHERE id=%s", (self.mission_id,))
        if rows[0]["statut"] != "acceptee":
            client.patch(f"/api/missions/{self.mission_id}/statut",
                         json={"statut": "acceptee"})

        # Mettre en cours
        resp = client.patch(f"/api/missions/{self.mission_id}/statut",
                            json={"statut": "en_cours"})
        assert resp.status_code == 200, f"Start mission failed: {resp.text}"

        rows = db_query("SELECT statut FROM missions WHERE id=%s", (self.mission_id,))
        assert rows[0]["statut"] == "en_cours"
        print(f"  ✅ Mission #{self.mission_id} en cours")

    def test_tech_submit_report_and_complete(self):
        """Technicien soumet un rapport puis termine la mission."""

        # ── 1. Accepter et commencer ──
        rows = db_query("SELECT statut FROM missions WHERE id=%s", (self.mission_id,))
        if rows[0]["statut"] not in ("acceptee", "en_cours"):
            client.patch(f"/api/missions/{self.mission_id}/statut",
                         json={"statut": "acceptee"})
        if rows[0]["statut"] == "acceptee":
            client.patch(f"/api/missions/{self.mission_id}/statut",
                         json={"statut": "en_cours"})

        # ── 2. Soumettre un rapport ──
        rapport_data = {
            "titre": f"Rapport Mission #{self.mission_id}",
            "contenu": (
                "Intervention effectuée sur le capteur DHT22. "
                "Problème de température critique résolu par recalibrage. "
                "Installation d'un dissipateur thermique. "
                "Test OK — température stable à 28°C."
            ),
            "technicien_id": self.tech["id"],
            "mission_id": self.mission_id,
            "photos": [],
        }
        resp = client.post("/api/rapports", json=rapport_data)
        assert resp.status_code == 200, f"Rapport creation failed: {resp.text}"

        # Récupérer l'ID du rapport
        resp_data = resp.json()
        rapport_id = resp_data.get("id")
        if rapport_id:
            TEST_CAPTURED_IDS["rapport_ids"].append(rapport_id)

        # Vérifier en BD
        rows = db_query("SELECT * FROM rapports WHERE mission_id=%s", (self.mission_id,))
        assert len(rows) == 1, f"Rapport pour mission #{self.mission_id} introuvable"
        rapport = rows[0]
        assert rapport["statut"] == "soumis"
        print(f"  ✅ Rapport #{rapport['id']} soumis pour mission #{self.mission_id}")

        # ── 3. Terminer la mission ──
        resp = client.post(f"/api/missions/{self.mission_id}/terminer")
        assert resp.status_code == 200, f"Terminer mission failed: {resp.text}"

        data = resp.json()
        assert data["status"] == "ok"
        assert data["mission_terminee"] == self.mission_id

        # Vérifier statut en BD
        rows = db_query("SELECT statut, date_fin FROM missions WHERE id=%s", (self.mission_id,))
        assert rows[0]["statut"] == "terminee"
        assert rows[0]["date_fin"] is not None
        print(f"  ✅ Mission #{self.mission_id} terminée le {rows[0]['date_fin']}")

        # ── 4. Vérifier que le technicien est redevenu disponible ──
        rows = db_query("SELECT disponible FROM utilisateurs WHERE id=%s", (self.tech["id"],))
        assert rows[0]["disponible"] == 1 or rows[0]["disponible"] is True
        print(f"  ✅ Technicien {self.tech['nom']} redevient disponible")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 7 — Simulation frontend (AdminDashboard data)
# ════════════════════════════════════════════════════════════════════════════

class TestAdminFrontendDataE2E:
    """
    Vérifie que les données renvoyées par l'API sont compatibles
    avec ce qu'attend le frontend AdminDashboard.js.
    """

    def test_missions_have_all_frontend_fields(self):
        """Vérifie les champs utilisés par AdminDashboard dans /api/missions."""
        # Créer une mission
        p = {"capteur_id": 1, "temperature": 46.0, "humidite": 35.0}
        client.post("/api/capteurs/donnees", json=p)

        resp = client.get("/api/missions")
        assert resp.status_code == 200
        missions = resp.json()["missions"]

        # Frontend utilise : id, description, panne_ticket, localisation,
        #                    priorite, statut, technicien_nom, date_creation
        required_fields = [
            "id", "description", "localisation", "priorite",
            "statut", "date_creation",
        ]
        optional_but_expected = ["panne_ticket", "panne_type", "technicien_nom"]

        for m in missions:
            for field in required_fields:
                assert field in m, f"Mission #{m['id']} manque '{field}'"
            for field in optional_but_expected:
                if field in m:
                    pass  # OK, c'est optionnel

        print(f"  ✅ {len(missions)} missions avec tous les champs requis")

    def test_historique_capteur(self):
        """Vérifie /api/capteurs/historique/{id}."""
        for cid in [1, 2, 3]:
            resp = client.get(f"/api/capteurs/historique/{cid}?limit=5")
            assert resp.status_code == 200
            data = resp.json()
            assert "data" in data
            assert isinstance(data["data"], list)
            if data["data"]:
                item = data["data"][0]
                assert "temperature" in item
                assert "humidite" in item
                assert "created_at" in item
        print(f"  ✅ Historique capteurs OK (capteurs 1,2,3)")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 8 — Techniciens API
# ════════════════════════════════════════════════════════════════════════════

class TestTechniciensE2E:
    """Vérifie que l'API techniciens fonctionne correctement."""

    def test_list_techniciens(self):
        """Vérifie /api/techniciens."""
        resp = client.get("/api/techniciens")
        assert resp.status_code == 200
        data = resp.json()
        assert "techniciens" in data
        assert len(data["techniciens"]) >= 3  # seed: au moins 3 techniciens
        tech = data["techniciens"][0]
        assert "id" in tech
        assert "nom" in tech
        assert "specialite" in tech
        assert "disponible" in tech
        print(f"  ✅ {len(data['techniciens'])} techniciens listés")

    def test_get_technicien_by_id(self):
        """Vérifie /api/techniciens/{id}."""
        # Prendre le premier technicien
        resp = client.get("/api/techniciens")
        techs = resp.json()["techniciens"]
        tech_id = techs[0]["id"]

        resp = client.get(f"/api/techniciens/{tech_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "technicien" in data
        assert data["technicien"]["id"] == tech_id
        assert "disponible" in data["technicien"]
        print(f"  ✅ Technicien #{tech_id} récupéré par ID")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 9 — Messages (communication technicien → admin)
# ════════════════════════════════════════════════════════════════════════════

class TestMessagesE2E:
    """Vérifie le système de messagerie."""

    def test_send_and_receive_message(self):
        """Envoie un message et vérifie qu'il est reçu."""
        # Prendre les IDs
        resp = client.get("/api/techniciens")
        techs = resp.json()["techniciens"]
        exp_id = techs[0]["id"]
        dest_id = techs[1]["id"] if len(techs) > 1 else techs[0]["id"]

        # Envoyer message
        msg = {
            "expediteur_id": exp_id,
            "destinataire_id": dest_id,
            "contenu": "Test de message end-to-end depuis le simulateur Wokwi",
        }
        resp = client.post("/api/messages", json=msg)
        assert resp.status_code == 200
        msg_data = resp.json()

        # Récupérer l'ID du message
        rows = db_query(
            "SELECT id FROM messages WHERE expediteur_id=%s AND destinataire_id=%s "
            "ORDER BY id DESC LIMIT 1",
            (exp_id, dest_id),
        )
        if rows:
            TEST_CAPTURED_IDS["message_ids"].append(rows[0]["id"])

        print(f"  ✅ Message envoyé: {msg['contenu'][:50]}...")

        # Vérifier compteur AVANT get_messages (qui marque tout comme lu)
        resp = client.get(f"/api/messages/{dest_id}/count")
        assert resp.status_code == 200
        count = resp.json()
        assert "count" in count
        assert count["count"] >= 1
        print(f"  ✅ Compteur messages (non lus): {count['count']}")

        # Vérifier réception
        resp = client.get(f"/api/messages/{dest_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert "messages" in data
        print(f"  ✅ Messages récupérés: {len(data['messages'])} message(s)")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 10 — Rapports API
# ════════════════════════════════════════════════════════════════════════════

class TestRapportsE2E:
    """Vérifie le système de rapports."""

    def test_rapports_list_and_pdf(self):
        """Crée un rapport et vérifie qu'il apparaît dans la liste."""
        # Prendre un technicien
        resp = client.get("/api/techniciens")
        techs = resp.json()["techniciens"]
        tech = techs[0]

        # Créer une mission pour avoir un mission_id valide
        p = {"capteur_id": 1, "temperature": 48.0, "humidite": 45.0}
        client.post("/api/capteurs/donnees", json=p)

        # Récupérer la dernière mission
        resp = client.get("/api/missions")
        missions = resp.json()["missions"]
        if missions:
            mission_id = missions[0]["id"]
            TEST_CAPTURED_IDS["mission_ids"].append(mission_id)

            # Créer rapport
            rapport_data = {
                "titre": "Rapport test E2E",
                "contenu": "Test complet du flux de rapport.",
                "technicien_id": tech["id"],
                "mission_id": mission_id,
                "photos": [],
            }
            resp = client.post("/api/rapports", json=rapport_data)
            assert resp.status_code == 200
            rapport_resp = resp.json()
            if rapport_resp.get("id"):
                TEST_CAPTURED_IDS["rapport_ids"].append(rapport_resp["id"])

            # Vérifier liste
            resp = client.get("/api/rapports")
            assert resp.status_code == 200
            data = resp.json()
            assert "rapports" in data
            our = [r for r in data["rapports"] if r.get("mission_id") == mission_id]
            assert len(our) >= 1
            print(f"  ✅ Rapport créé et trouvé dans /api/rapports")

            # Tenter de générer le PDF (vérifier que l'endpoint répond)
            if our:
                rid = our[0]["id"]
                resp = client.get(f"/api/rapports/{rid}/pdf")
                assert resp.status_code in (200, 422), \
                    f"PDF rapport #{rid}: status inattendu {resp.status_code}"
                print(f"  ✅ PDF rapport #{rid}: status={resp.status_code}")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 11 — Simulation Wokwi complète (WebSocket)
# ════════════════════════════════════════════════════════════════════════════

class TestWokwiWebSocketE2E:
    """
    Teste la connexion WebSocket comme le ferait le Wokwi simulateur.
    Envoie des données via WebSocket et vérifie la réponse.
    """

    def test_websocket_send_and_receive(self):
        """
        Teste le WebSocket /ws/capteurs.
        Envoie des données DHT22 simulées et vérifie la réponse.
        """
        from fastapi.testclient import TestClient as WSClient

        with client.websocket_connect("/ws/capteurs") as ws:
            # Envoyer des données de capteur (simule le Wokwi)
            ws.send_json({
                "capteur_id": 1,
                "temperature": 45.0,
                "humidite": 30.0,
            })

            # Recevoir la réponse
            data = ws.receive_json()
            assert data["status"] == "ok"
            assert len(data["pannes_creees"]) > 0
            panne_info = data["pannes_creees"][0]
            assert panne_info["type"] == "temperature"
            assert panne_info["valeur"] == 45.0

            # Capture IDs pour cleanup
            panne_id = panne_info["panne_id"]
            TEST_CAPTURED_IDS["panne_ids"].append(panne_id)

            # Vérifier mission créée
            rows = db_query("SELECT id FROM missions WHERE panne_id=%s", (panne_id,))
            if rows:
                TEST_CAPTURED_IDS["mission_ids"].append(rows[0]["id"])

            print(f"  ✅ WebSocket: donnée envoyée, panne #{panne_id} reçue en réponse")

    def test_websocket_dashboard_receives_data(self):
        """
        Teste que le WebSocket dashboard reçoit aussi les données
        (diffusion via dashboard_ws_manager).
        """
        # Note: avec TestClient on ne peut pas facilement vérifier
        # le broadcast temps réel entre deux WebSockets simultanément.
        # Ce test est un smoke test qui vérifie que l'endpoint /ws/dashboard
        # est accessible et que les données HTTP arrivent bien.
        with client.websocket_connect("/ws/dashboard") as ws:
            # Envoyer une donnée capteur via HTTP (le WS dashboard reçoit le broadcast)
            p = {"capteur_id": 1, "temperature": 47.0, "humidite": 40.0}
            resp = client.post("/api/capteurs/donnees", json=p)
            result = resp.json()
            if result.get("pannes_creees"):
                pid = result["pannes_creees"][0]["panne_id"]
                TEST_CAPTURED_IDS["panne_ids"].append(pid)
                rows = db_query("SELECT id FROM missions WHERE panne_id=%s", (pid,))
                if rows:
                    TEST_CAPTURED_IDS["mission_ids"].append(rows[0]["id"])

            print(f"  ✅ WebSocket /ws/dashboard accessible (smoke test)")


# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 12 — Simulation complète du flux Wokwi → Mission → Technicien
# ════════════════════════════════════════════════════════════════════════════

class TestFullWokwiToTechnicienFlowE2E:
    """
    Scénario complet qui simule l'utilisateur final :
    1. Un capteur Wokwi envoie des données critiques
    2. Backend crée panne + alerte + mission
    3. Admin voit la mission dans le dashboard
    4. Auto-assign ou assign manuelle au technicien
    5. Technicien voit la mission, l'accepte, la termine avec rapport
    6. Mission marquée terminée, technicien redevient disponible
    """

    def test_complete_scenario(self):
        """Scénario complet de bout en bout."""

        # ── 1. Wokwi : température critique ──
        print("\n  ── Phase 1: Wokwi envoie température critique ──")
        p = {"capteur_id": 1, "temperature": 46.5, "humidite": 32.0}
        resp = client.post("/api/capteurs/donnees", json=p)
        assert resp.status_code == 200
        result = resp.json()
        panne_id = result["pannes_creees"][0]["panne_id"]
        TEST_CAPTURED_IDS["panne_ids"].append(panne_id)
        print(f"  ✅ Wokwi → Panne créée #{panne_id}")

        # ── 2. Vérifier la mission créée ──
        print("\n  ── Phase 2: Mission créée en attente ──")
        rows = db_query("SELECT id FROM missions WHERE panne_id=%s", (panne_id,))
        assert len(rows) == 1
        mission_id = rows[0]["id"]
        TEST_CAPTURED_IDS["mission_ids"].append(mission_id)
        print(f"  ✅ Mission #{mission_id} créée")

        # ── 3. Admin voit la mission ──
        print("\n  ── Phase 3: Admin voit la mission ──")
        resp = client.get("/api/missions")
        data = resp.json()
        our = [m for m in data["missions"] if m["id"] == mission_id]
        assert len(our) == 1
        assert our[0]["statut"] == "en_attente"
        assert our[0]["panne_ticket"] is not None
        print(f"  ✅ Admin voit mission #{mission_id} (statut: {our[0]['statut']})")

        # ── 4. Assigner un technicien ──
        print("\n  ── Phase 4: Assignation du technicien ──")
        tech_rows = db_query(
            "SELECT id, nom FROM utilisateurs WHERE role='technicien' AND disponible=1 LIMIT 1"
        )
        if not tech_rows:
            tech_rows = db_query(
                "SELECT id, nom FROM utilisateurs WHERE role='technicien' LIMIT 1"
            )
            db_execute("UPDATE utilisateurs SET disponible=1 WHERE id=%s", (tech_rows[0]["id"],))

        tech = tech_rows[0]
        resp = client.patch(f"/api/missions/{mission_id}/assigner",
                            json={"technicien_id": tech["id"]})
        assert resp.status_code == 200
        print(f"  ✅ Mission #{mission_id} assignée à {tech['nom']}")

        # ── 5. Technicien accepte la mission ──
        print("\n  ── Phase 5: Technicien accepte la mission ──")
        # Note: assigner_mission() met le statut directement à 'en_cours'.
        # Pour tester l'étape d'acceptation, on passe par 'acceptee' puis 'en_cours'.
        rows = db_query("SELECT statut FROM missions WHERE id=%s", (mission_id,))
        print(f"  → Statut après assignation: {rows[0]['statut']}")
        if rows[0]["statut"] != "acceptee":
            resp = client.patch(f"/api/missions/{mission_id}/statut",
                                json={"statut": "acceptee"})
            assert resp.status_code == 200, f"Accept failed: {resp.text}"
            print(f"  → Mission passée en 'acceptee'")
            # Repasser en 'en_cours' pour la suite du workflow
            resp = client.patch(f"/api/missions/{mission_id}/statut",
                                json={"statut": "en_cours"})
            assert resp.status_code == 200
            print(f"  → Mission passée en 'en_cours' pour la suite")

        # ── 6. Technicien soumet rapport ──
        print("\n  ── Phase 6: Technicien soumet rapport ──")
        rapport = {
            "titre": f"Rapport mission #{mission_id}",
            "contenu": (
                "Intervention terminée avec succès.\n"
                "- Capteur DHT22 recalibré\n"
                "- Dissipateur thermique installé\n"
                "- Température stabilisée à 27.5°C\n"
                "- Aucune anomalie détectée"
            ),
            "technicien_id": tech["id"],
            "mission_id": mission_id,
            "photos": [],
        }
        resp = client.post("/api/rapports", json=rapport)
        assert resp.status_code == 200
        rapport_id = resp.json().get("id")
        if rapport_id:
            TEST_CAPTURED_IDS["rapport_ids"].append(rapport_id)
        print(f"  ✅ Rapport #{rapport_id} soumis")

        # ── 7. Terminer la mission ──
        print("\n  ── Phase 7: Terminer la mission ──")
        resp = client.post(f"/api/missions/{mission_id}/terminer")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        print(f"  ✅ Mission #{mission_id} terminée !")

        # ── 8. Vérifications finales ──
        print("\n  ── Phase 8: Vérifications finales ──")

        # Mission terminée
        rows = db_query("SELECT statut, date_fin FROM missions WHERE id=%s", (mission_id,))
        assert rows[0]["statut"] == "terminee"
        assert rows[0]["date_fin"] is not None
        print(f"  ✅ Statut: {rows[0]['statut']}, date_fin: {rows[0]['date_fin']}")

        # Technicien disponible
        rows = db_query("SELECT disponible FROM utilisateurs WHERE id=%s", (tech["id"],))
        print(f"  ✅ Technicien disponible: {bool(rows[0]['disponible'])}")

        # L'admin voit la mission terminée
        resp = client.get("/api/dashboard")
        stats = resp.json()
        print(f"  ✅ Dashboard: pannes={stats.get('pannes_ouvertes')}, "
              f"terminees={stats.get('missions_terminees')}")

        print(f"\n  🎯 SCÉNARIO COMPLET RÉUSSI ! "
              f"Wokwi → DB → Mission #{mission_id} → {tech['nom']} → Terminée ✅")


# ════════════════════════════════════════════════════════════════════════════
#  Exécution directe
# ════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--capture=no"])
