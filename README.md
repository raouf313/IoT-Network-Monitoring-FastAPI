# IoT-Network-Monitoring-FastAPI
Real-time IoT network equipment monitoring platform built with Python, FastAPI, and React

A full-stack solution designed to monitor telemetry data from network equipment in real-time, detect anomalies using AI models, and automate periodic reports.

## 🛠️ Tech Stack
- **Backend:** Python, FastAPI, WebSockets, MQTT, MySQL
- **Frontend:** React.js, Tailwind CSS, Recharts
- **AI / Data:** Local AI Model (Qwen 2.5), ReportLab (PDF Generation)
- **DevOps & Tools:** Git, Docker, Postman

## ✨ Key Features
- **Real-time Monitoring:** Live telemetry data streaming via WebSockets and MQTT with reduced latency.
- **AI Anomaly Classification:** Integration of local LLM to classify technical issues automatically.
- **Dynamic Dashboard:** Interactive charts and state management for network status.
- **Automated Reporting:** Periodical PDF/Excel report generator.

## 🔧 Installation & Setup
```bash
# Clone the repository
git clone [https://github.com/votre-username/votre-repo.git](https://github.com/votre-username/votre-repo.git)

# Install Backend Dependencies
cd backend
pip install -r requirements.txt

# Run the FastAPI server
uvicorn main:app --reload
