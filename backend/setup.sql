-- ════════════════════════════════════════
--  Création de la base de données TT Workflow
-- ════════════════════════════════════════
CREATE DATABASE IF NOT EXISTS tunisie_telecom_db222
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tunisie_telecom_db222;

CREATE TABLE utilisateurs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nom          VARCHAR(100) NOT NULL,
  email        VARCHAR(100) UNIQUE NOT NULL,
  mot_de_passe VARCHAR(255) NOT NULL,
  role         ENUM('admin','technicien') DEFAULT 'technicien',
  disponible   BOOLEAN DEFAULT TRUE,
  retour_disponible DATETIME NULL COMMENT 'Date/heure de retour disponibilité',
  duree_retour_minutes INT DEFAULT NULL COMMENT 'Durée indisponibilité en minutes',
  telephone    VARCHAR(20),
  specialite   VARCHAR(100),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE capteurs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nom          VARCHAR(100) NOT NULL,
  localisation VARCHAR(200),
  statut       ENUM('actif','inactif','erreur') DEFAULT 'actif',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE donnees_capteurs (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  capteur_id   INT NOT NULL,
  temperature  DECIMAL(5,2),
  humidite     DECIMAL(5,2),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (capteur_id) REFERENCES capteurs(id)
);

CREATE TABLE pannes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  capteur_id      INT,
  description     TEXT NOT NULL,
  type            VARCHAR(100),
  valeur_detectee DECIMAL(10,2),
  priorite        ENUM('faible','moyen','eleve','critique') DEFAULT 'moyen',
  statut          ENUM('ouverte','assignee','resolue') DEFAULT 'ouverte',
  numero_ticket   VARCHAR(20),
  source          VARCHAR(50) DEFAULT 'manuel',
  date_detection  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (capteur_id) REFERENCES capteurs(id)
);

CREATE TABLE missions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  description    TEXT NOT NULL,
  localisation   VARCHAR(200),
  statut         ENUM('en_attente','acceptee','refusee','en_cours','terminee') DEFAULT 'en_attente',
  technicien_id  INT,
  panne_id       INT,
  priorite       ENUM('faible','moyen','eleve','critique') DEFAULT 'moyen',
  date_creation  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  date_fin       DATETIME,
  FOREIGN KEY (technicien_id) REFERENCES utilisateurs(id),
  FOREIGN KEY (panne_id) REFERENCES pannes(id)
);

CREATE TABLE rapports (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  titre          VARCHAR(200),
  contenu        TEXT NOT NULL,
  technicien_id  INT,
  mission_id     INT,
  statut         ENUM('brouillon','soumis','approuve','rejete') DEFAULT 'soumis',
  date_creation  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (technicien_id) REFERENCES utilisateurs(id),
  FOREIGN KEY (mission_id) REFERENCES missions(id)
);

CREATE TABLE rapport_photos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  rapport_id   INT NOT NULL,
  nom_fichier  VARCHAR(300) NOT NULL,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (rapport_id) REFERENCES rapports(id)
);

CREATE TABLE analyses_ia (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  panne_id     INT,
  resultat     TEXT,
  modele       VARCHAR(100),
  date_analyse TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (panne_id) REFERENCES pannes(id)
);

CREATE TABLE alertes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  type         VARCHAR(100),
  message      TEXT,
  severite     ENUM('info','warning','critique') DEFAULT 'warning',
  panne_id     INT,
  lue          BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  expediteur_id   INT NOT NULL,
  destinataire_id INT NOT NULL,
  contenu         TEXT NOT NULL,
  lu              BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expediteur_id)   REFERENCES utilisateurs(id),
  FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id)
);

INSERT INTO capteurs (nom, localisation) VALUES
  ('Capteur TT-001', 'Jendouba'),
  ('Capteur TT-002', 'Ghardimaou'),
  ('Capteur TT-003', 'Bousselem');

INSERT INTO utilisateurs (nom, email, mot_de_passe, role, telephone, specialite) VALUES
  ('Admin TT',       'admin@tunisietelecom.tn',  'admin123', 'admin',      '+216 71 000 000', 'Administration'),
  ('Ahmed Ben Ali',  'ahmed@tunisietelecom.tn',  'tech123',  'technicien', '+216 55 111 111', 'Réseau'),
  ('Sara Mansour',   'sara@tunisietelecom.tn',   'tech123',  'technicien', '+216 55 222 222', 'Électricité'),
  ('Mohamed Karim',  'karim@tunisietelecom.tn',  'tech123',  'technicien', '+216 55 333 333', 'Informatique'),
  ('Fatma Trabelsi', 'fatma@tunisietelecom.tn',  'tech123',  'technicien', '+216 55 444 444', 'Climatisation');