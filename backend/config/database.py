"""
config/database.py — Connexion MySQL et migrations automatiques.
"""
import mysql.connector
from config.settings import settings


def get_db():
    """Ouvre et retourne une connexion MySQL. À fermer après usage."""
    return mysql.connector.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
    )


def run_migrations():
    """Ajoute les colonnes manquantes sans casser une BD existante."""
    add_cols = [
        ("utilisateurs", "retour_disponible",    "DATETIME NULL"),
        ("utilisateurs", "duree_retour_minutes", "INT DEFAULT NULL"),
        ("pannes",       "source",               "VARCHAR(50) DEFAULT 'manuel'"),
    ]
    fix_types = [
        ("pannes", "source", "VARCHAR(50) DEFAULT 'manuel'"),
    ]
    try:
        db = get_db()
        cur = db.cursor()
        for table, col, defn in add_cols:
            cur.execute(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s",
                (table, col)
            )
            (exists,) = cur.fetchone()
            if not exists:
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {defn}")
                db.commit()
                print(f"[MIGRATION] ✅ {table}.{col} ajoutée")
        for table, col, defn in fix_types:
            cur.execute(
                "SELECT DATA_TYPE FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s",
                (table, col)
            )
            row = cur.fetchone()
            if row and row[0].lower() != 'varchar':
                cur.execute(f"ALTER TABLE {table} MODIFY COLUMN {col} {defn}")
                db.commit()
        cur.close()
        db.close()
        print("[MIGRATION] Schéma à jour ✅")
    except Exception as e:
        print(f"[MIGRATION] ⚠️ Erreur (non bloquant) : {e}")
