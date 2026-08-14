import axios from 'axios';
const api = axios.create({ baseURL: 'http://localhost:8000', timeout: 90000 });

export const login               = d   => api.post('/api/login',d).then(r=>r.data);
export const getDashboard        = ()  => api.get('/api/dashboard').then(r=>r.data);
export const getPannes           = ()  => api.get('/api/pannes').then(r=>r.data.pannes);
export const creerPanne          = d   => api.post('/api/pannes',d).then(r=>r.data);
export const updatePanneStatut   = (id,d) => api.patch(`/api/pannes/${id}/statut`,d);
export const getMissions         = ()  => api.get('/api/missions').then(r=>r.data.missions);
export const creerMission        = d   => api.post('/api/missions',d).then(r=>r.data);
export const updateMission       = (id,d) => api.patch(`/api/missions/${id}`,d);
export const updateMissionStatut = (id,d) => api.patch(`/api/missions/${id}/statut`,d);
export const terminerMission     = id  => api.post(`/api/missions/${id}/terminer`).then(r=>r.data);
export const assignerMission     = (id,d) => api.patch(`/api/missions/${id}/assigner`,d);
export const signalerBlocage     = (id,d) => api.post(`/api/missions/${id}/signaler_blocage`,d).then(r=>r.data);
export const getMissionsTech     = id  => api.get(`/api/missions/technicien/${id}`).then(r=>r.data.missions);
export const getTechniciens      = ()  => api.get('/api/techniciens').then(r=>r.data.techniciens);
export const getTechnicienById   = id  => api.get(`/api/techniciens/${id}`).then(r=>r.data.technicien);
export const ajouterTechnicien   = d   => api.post('/api/techniciens',d).then(r=>r.data);
export const supprimerTechnicien = id  => api.delete(`/api/techniciens/${id}`);
export const updateTechnicien    = (id,d) => api.patch(`/api/techniciens/${id}`,d);
export const getRapports         = ()  => api.get('/api/rapports').then(r=>r.data.rapports);
export const creerRapport        = d   => api.post('/api/rapports',d).then(r=>r.data);
export const retoucheRapport     = (id,d) => api.patch(`/api/rapports/${id}/retouche`,d);
export const updateRapportStatut = (id,d) => api.patch(`/api/rapports/${id}/statut`,d);
export const getRapportPhotos    = id  => api.get(`/api/rapports/${id}/photos`).then(r=>r.data.photos);
export const getAlertes          = ()  => api.get('/api/alertes').then(r=>r.data.alertes);
export const marquerLue          = id  => api.patch(`/api/alertes/${id}/lire`);
export const getMessages         = id  => api.get(`/api/messages/${id}`).then(r=>r.data.messages);
export const envoyerMessage      = d   => api.post('/api/messages',d).then(r=>r.data);
export const countMessages       = id  => api.get(`/api/messages/${id}/count`).then(r=>r.data.count);
export const analyserIA          = d   => api.post('/api/ia/analyser',d).then(r=>r.data);
export const chatbot             = d   => api.post('/api/chatbot',d).then(r=>r.data);
export const getHistoriqueCapteur= (id,l) => api.get(`/api/capteurs/historique/${id}?limit=${l||50}`).then(r=>r.data.data);

// ── Import Excel missions ──────────────────────────
// IMPORTANT: route fixée — utilise /api/missions/import-excel (avant /technicien/{id})
export const importerMissionsExcel = (formData) =>
  api.post('/api/missions/import-excel', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);

// ── Télécharger template Excel ─────────────────────
export const downloadTemplateExcel = () => {
  downloadFile(`${API_BASE}/api/missions/template-excel`, 'template_missions_TT.xlsx');
};

// ── URL de base backend (utilisé pour les téléchargements directs) ──
const API_BASE = 'http://localhost:8000';

// ── Helper: télécharger un fichier via Blob URL (fonctionne cross-origin) ────
const downloadFile = async (url, filename) => {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'document';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch(e) {
    console.error('Download failed:', e);
  }
};

// ── Générer PDF d'un rapport ───────────────────────
export const genererRapportPDF = (rapportId) => {
  downloadFile(`${API_BASE}/api/rapports/${rapportId}/pdf`, `rapport_${rapportId}.pdf`);
};

// ── Générer PDF global des missions ───────────────
export const genererMissionsPDF = () => {
  downloadFile(`${API_BASE}/api/missions/rapport-pdf`, 'missions.pdf');
};

export default api;