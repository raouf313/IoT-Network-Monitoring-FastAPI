-- ═══════════════════════════════════════════════════════════
--  Migration : Photos disque + suppression photo_data LONGTEXT
-- ═══════════════════════════════════════════════════════════
USE tunisie_telecom_db220;

-- 1. Ajouter la colonne nom_fichier si elle n'existe pas
ALTER TABLE rapport_photos
  ADD COLUMN IF NOT EXISTS nom_fichier VARCHAR(300) NOT NULL DEFAULT '';

-- 2. Supprimer la colonne photo_data (libère l'espace disque BD)
ALTER TABLE rapport_photos
  DROP COLUMN IF EXISTS photo_data;

-- 3. Vérification finale
DESCRIBE rapport_photos;
