# 🚀 TT Workflow — Lancer le Projet (LM Studio Local Edition)

## 🤖 LM Studio (IA locale — requis)

LM Studio remplace NVIDIA NIM. Il tourne entièrement en local, **sans clé API**.

### Étapes de configuration LM Studio :
1. Télécharger LM Studio : https://lmstudio.ai
2. Charger un modèle compatible (ex : Llama 3.1 8B Instruct, Mistral 7B, etc.)
3. Aller dans l'onglet **"Local Server"** → cliquer **"Start Server"**
4. Vérifier que le serveur tourne sur `http://localhost:1234`
5. Copier le nom exact du modèle chargé (visible dans LM Studio)
6. Le coller dans `backend/.env` à la variable `LM_STUDIO_MODEL`

```
LM_STUDIO_BASE_URL=http://localhost:1234/v1
LM_STUDIO_MODEL=local-model   ← remplacer par le nom réel du modèle
```

> 💡 Pour trouver le nom exact du modèle : `curl http://localhost:1234/v1/models`

---

## 📡 Capteurs configurés

| ID | Nom             | Localisation |
|----|-----------------|--------------|
| 1  | Capteur TT-001  | **Jendouba** |
| 2  | Capteur TT-002  | **Ghardimaou** |
| 3  | Capteur TT-003  | **Bousselem** |

---

## 🗄️ 1. Base de données MySQL

```bash
mysql -u root -p < backend/setup.sql
```

---

## 🐍 2. Backend FastAPI

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```
→ API disponible : http://localhost:8000

---

## ⚛️ 3. Frontend React

```bash
cd frontend
npm install
npm start
```
→ App disponible : http://localhost:3000

---

## 🖥️ 4. Simulateur Wokwi (3 capteurs)

Ouvrir `wokwi/simulateur.html` dans votre navigateur.

> ⚠️ Le simulateur se connecte en WebSocket à `ws://localhost:8000/ws/capteurs`
> → Le backend doit être démarré avant d'ouvrir le simulateur.

---

## 👤 Comptes de test

| Rôle       | Email                        | Mot de passe |
|------------|------------------------------|--------------|
| Admin      | admin@tunisietelecom.tn      | admin123     |
| Technicien | ahmed@tunisietelecom.tn      | tech123      |
| Technicien | sara@tunisietelecom.tn       | tech123      |

---

## 🔧 Dépannage LM Studio

| Symptôme | Solution |
|----------|----------|
| `Connection refused` sur port 1234 | Démarrer le serveur dans LM Studio → onglet "Local Server" |
| `Model not found` | Vérifier `LM_STUDIO_MODEL` dans `.env` — doit correspondre exactement au nom affiché dans LM Studio |
| Réponse très lente | Normal pour les grands modèles (7B+). Essayer un modèle plus petit (3B) ou activer l'accélération GPU dans LM Studio |
| Erreur CORS | Non applicable — LM Studio accepte toutes les origines par défaut |
freebuff --continue 2026-07-14T15-53-38.303Z
freebuff --continue 2026-07-14T15-53-38.303Z

