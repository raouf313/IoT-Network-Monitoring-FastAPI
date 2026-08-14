/*
 ╔══════════════════════════════════════════════════════════╗
 ║   TT Workflow — ESP32 DHT22 → HTTP POST → BD MySQL      ║
 ║                                                          ║
 ║   1 DHT22 sur GPIO 4 → WiFi HTTP POST → FastAPI         ║
 ║   → Backend TT (pannes/alertes/missions)                ║
 ╚══════════════════════════════════════════════════════════╝

  Bibliothèques (Library Manager Wokwi) :
    - DHT sensor library    (Adafruit)
    - LiquidCrystal I2C     (Frank de Brabander)
    - ArduinoJson           (Benoit Blanchon)

  ⚠️  IMPORTANT — Configuration backend :
  Le simulateur Wokwi ne peut PAS accéder à votre IP locale
  (192.168.x.x). Vous devez exposer votre backend FastAPI
  sur Internet via une des méthodes suivantes :

    1) ngrok (recommandé) :
         ngrok http 8000
         → puis copier l'URL https://xxx.ngrok-free.app

    2) cloudflared / localtunnel / serveo

    3) Backend déjà déployé (Render, Railway, etc.)

  Puis modifier la constante BACKEND_URL ci-dessous.
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <ArduinoJson.h>

// ══════════════════════════════════════════════════════════
//  ⚙️  CONFIGURATION — À modifier selon votre setup
// ══════════════════════════════════════════════════════════
const char* WIFI_SSID     = "Wokwi-GUEST";   // WiFi simulé Wokwi
const char* WIFI_PASS     = "";               // Pas de mot de passe

// ⚠️  REMPLACER par votre URL publique (ngrok, déploiement, etc.)
// Exemples valides :
//   "https://abcd-1234.ngrok-free.app"
//   "http://mon-backend.onrender.com"
// ❌ NE PAS utiliser "192.168.x.x" — Wokwi ne peut pas y accéder
const char* BACKEND_URL   = "https://CHANGE-ME.ngrok-free.app";

// ══════════════════════════════════════════════════════════
//  🗺️  ID CAPTEUR — envoyé au backend dans JSON
//  1 = Jendouba | 2 = Ghardimaou | 3 = Bousselem
// ══════════════════════════════════════════════════════════
const int    CAPTEUR_ID    = 1;     // 1=Jendouba | 2=Ghardimaou | 3=Bousselem
const int    SEND_INTERVAL = 3000;  // Envoyer toutes les 3 secondes

// ══════════════════════════════════════════════════════════
//  Pins
// ══════════════════════════════════════════════════════════
#define DHT_PIN       4
#define DHT_TYPE      DHT22
#define LED_TEMP      2        // Rouge  — alerte température
#define LED_HUM       5        // Bleu   — alerte humidité
#define LED_OK        18       // Vert   — tout OK
#define LED_WIFI      19       // Jaune  — connexion WiFi/HTTP
#define BUZZER_PIN    15

// ══════════════════════════════════════════════════════════
//  Seuils LOCAUX (pour l'affichage LCD/LEDs uniquement)
//  ⚠️ La création des pannes en BD est décidée côté backend
//      (température>40, humidité>85)
// ══════════════════════════════════════════════════════════
const float SEUIL_TEMP_MAX = 35.0;
const float SEUIL_TEMP_MIN = 10.0;
const float SEUIL_HUM_MAX  = 80.0;
const float SEUIL_HUM_MIN  = 20.0;

// ══════════════════════════════════════════════════════════
//  Objets
// ══════════════════════════════════════════════════════════
DHT              dht(DHT_PIN, DHT_TYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ══════════════════════════════════════════════════════════
//  Variables
// ══════════════════════════════════════════════════════════
float  temp_val      = 0.0;
float  hum_val       = 0.0;
bool   alerte_temp   = false;
bool   alerte_hum    = false;
bool   wifi_ok       = false;
bool   backend_ok    = false;

unsigned long t_last_send    = 0;
unsigned long t_last_display = 0;
unsigned long t_last_beep    = 0;
int    pannes_envoyees       = 0;
int    envois_total          = 0;
int    envois_reussis        = 0;

// Caractères LCD
byte icoThermo[8] = {0x04,0x0A,0x0A,0x0E,0x0E,0x1F,0x1F,0x0E};
byte icoGoutte[8] = {0x04,0x04,0x0E,0x1F,0x1F,0x1F,0x0E,0x00};
byte icoWifi[8]   = {0x00,0x0E,0x11,0x04,0x0A,0x00,0x04,0x00};

// ══════════════════════════════════════════════════════════
//  Envoyer données au backend via HTTP POST
// ══════════════════════════════════════════════════════════
bool envoyerDonnees(float t, float h) {
  if (!wifi_ok) return false;

  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/capteurs/donnees";

  // HTTPS ou HTTP selon préfixe
  if (url.startsWith("https://")) {
    WiFiClientSecure *client = new WiFiClientSecure;
    client->setInsecure();   // Wokwi : pas de vérification cert
    http.begin(*client, url);
  } else {
    http.begin(url);
  }

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);

  // Construire le JSON à envoyer
  StaticJsonDocument<128> doc;
  doc["capteur_id"]  = CAPTEUR_ID;
  doc["temperature"] = round(t * 10) / 10.0;
  doc["humidite"]    = round(h * 10) / 10.0;
  String body;
  serializeJson(doc, body);

  envois_total++;
  Serial.printf("[HTTP] → POST %s\n", url.c_str());
  Serial.printf("[HTTP] → Body: %s\n", body.c_str());

  int code = http.POST(body);
  bool ok = false;

  if (code == 200 || code == 201) {
    String response = http.getString();
    Serial.printf("[HTTP] ✅ %d → %s\n", code, response.c_str());

    // Parser la réponse pour compter les pannes créées
    StaticJsonDocument<512> resp;
    if (deserializeJson(resp, response) == DeserializationError::Ok) {
      JsonArray pannes = resp["pannes_creees"];
      for (JsonObject p : pannes) {
        const char* ticket = p["ticket"] | "?";
        const char* type_p = p["type"]   | "?";
        Serial.printf("[BD] 🚨 PANNE CRÉÉE → ticket:%s type:%s\n", ticket, type_p);
        pannes_envoyees++;
      }
    }
    envois_reussis++;
    ok = true;
  } else if (code > 0) {
    Serial.printf("[HTTP] ❌ Code HTTP: %d\n", code);
    Serial.printf("[HTTP]    Réponse: %s\n", http.getString().c_str());
  } else {
    Serial.printf("[HTTP] ❌ Échec connexion (code %d) — vérifiez BACKEND_URL\n", code);
  }

  http.end();
  return ok;
}

// ══════════════════════════════════════════════════════════
//  SETUP
// ══════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(200);

  // Pins
  pinMode(LED_TEMP,   OUTPUT);
  pinMode(LED_HUM,    OUTPUT);
  pinMode(LED_OK,     OUTPUT);
  pinMode(LED_WIFI,   OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  // LCD
  lcd.init();
  lcd.backlight();
  lcd.createChar(0, icoThermo);
  lcd.createChar(1, icoGoutte);
  lcd.createChar(2, icoWifi);

  // Splash
  lcd.setCursor(3, 0); lcd.print("TT WORKFLOW");
  lcd.setCursor(0, 1); lcd.print("Connexion WiFi..");
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  TT Workflow — ESP32 HTTP POST     ║");
  Serial.println("║  Données → /api/capteurs/donnees   ║");
  Serial.println("╠══════════════════════════════════════╣");
  Serial.print("║  📍 Localisation : ");
  if (CAPTEUR_ID == 1) Serial.print("Jendouba");
  else if (CAPTEUR_ID == 2) Serial.print("Ghardimaou");
  else if (CAPTEUR_ID == 3) Serial.print("Bousselem");
  else Serial.print("Capteur #" + String(CAPTEUR_ID));
  Serial.println("               ║");
  Serial.println("╚════════════════════════════════════╝");
  Serial.printf("[CFG] Backend URL : %s\n", BACKEND_URL);

  // DHT
  dht.begin();

  // Test LEDs
  for (int p : {LED_TEMP, LED_HUM, LED_OK, LED_WIFI}) {
    digitalWrite(p, HIGH); delay(100); digitalWrite(p, LOW);
  }
  tone(BUZZER_PIN, 880, 80);

  // ── Connexion WiFi ─────────────────────────────────────
  Serial.printf("[WiFi] Connexion à %s ...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  int wifi_timeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifi_timeout < 20) {
    delay(500);
    Serial.print(".");
    wifi_timeout++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifi_ok = true;
    digitalWrite(LED_WIFI, HIGH);
    Serial.printf("\n[WiFi] ✅ Connecté ! IP locale ESP32: %s\n",
                  WiFi.localIP().toString().c_str());
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("WiFi OK!");
    lcd.setCursor(0, 1); lcd.print(WiFi.localIP().toString());
    delay(1500);
  } else {
    wifi_ok = false;
    Serial.println("\n[WiFi] ❌ Échec connexion WiFi");
    lcd.clear();
    lcd.setCursor(0, 0); lcd.print("WiFi ECHEC!");
    lcd.setCursor(0, 1); lcd.print("Mode local...");
    delay(1500);
  }

  // Avertissement si BACKEND_URL pas configuré
  if (String(BACKEND_URL).indexOf("CHANGE-ME") >= 0) {
    Serial.println("⚠️═══════════════════════════════════════════⚠️");
    Serial.println("⚠️ BACKEND_URL non configurée !              ⚠️");
    Serial.println("⚠️ Modifiez la constante BACKEND_URL          ⚠️");
    Serial.println("⚠️ avec votre URL ngrok ou de déploiement.    ⚠️");
    Serial.println("⚠═══════════════════════════════════════════⚠️");
  }

  lcd.clear();
  Serial.println("[READY] Bougez les curseurs DHT22 !\n");
}

// ══════════════════════════════════════════════════════════
//  LOOP
// ══════════════════════════════════════════════════════════
void loop() {

  // ── Lecture DHT22 + envoi HTTP ────────────────────────
  if (millis() - t_last_send >= SEND_INTERVAL) {
    t_last_send = millis();

    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (!isnan(t)) temp_val = t;
    if (!isnan(h)) hum_val  = h;

    // Calculer alertes locales (LEDs/LCD seulement)
    bool prev_at = alerte_temp;
    bool prev_ah = alerte_hum;
    alerte_temp = (temp_val > SEUIL_TEMP_MAX || temp_val < SEUIL_TEMP_MIN);
    alerte_hum  = (hum_val  > SEUIL_HUM_MAX  || hum_val  < SEUIL_HUM_MIN);

    // Log Serial
    if (alerte_temp && !prev_at)
      Serial.printf("[DHT] 🔴 ALERTE TEMP: %.1f°C\n", temp_val);
    if (!alerte_temp && prev_at)
      Serial.printf("[DHT] ✅ Temp normale: %.1f°C\n", temp_val);
    if (alerte_hum && !prev_ah)
      Serial.printf("[DHT] 💧 ALERTE HUM: %.1f%%\n", hum_val);
    if (!alerte_hum && prev_ah)
      Serial.printf("[DHT] ✅ Hum normale: %.1f%%\n", hum_val);

    // ── Envoi au backend ──────────────────────────────
    backend_ok = envoyerDonnees(temp_val, hum_val);
    digitalWrite(LED_WIFI, backend_ok ? HIGH : LOW);

    // Stats
    Serial.printf("[STATS] Envois: %d/%d réussis · Pannes BD créées: %d\n\n",
                  envois_reussis, envois_total, pannes_envoyees);

    // LEDs
    digitalWrite(LED_TEMP, alerte_temp ? HIGH : LOW);
    digitalWrite(LED_HUM,  alerte_hum  ? HIGH : LOW);
    digitalWrite(LED_OK,   (!alerte_temp && !alerte_hum) ? HIGH : LOW);
  }

  // ── Buzzer ────────────────────────────────────────────
  if ((alerte_temp || alerte_hum) && millis() - t_last_beep > 2500) {
    t_last_beep = millis();
    tone(BUZZER_PIN, alerte_temp ? 1200 : 900, 200);
    if (alerte_temp && alerte_hum) { delay(250); tone(BUZZER_PIN, 1600, 200); }
  }
  if (!alerte_temp && !alerte_hum) noTone(BUZZER_PIN);

  // ── LCD 400ms ─────────────────────────────────────────
  if (millis() - t_last_display >= 400) {
    t_last_display = millis();
    afficherLCD();
  }
}

// ══════════════════════════════════════════════════════════
//  Affichage LCD
// ══════════════════════════════════════════════════════════
void afficherLCD() {
  lcd.clear();

  // Ligne 0 — Température
  lcd.setCursor(0, 0);
  lcd.write(byte(0));
  lcd.print(" ");
  lcd.print(temp_val, 1);
  lcd.print((char)0xDF); lcd.print("C");
  if (alerte_temp) {
    lcd.setCursor(9, 0);
    lcd.print(temp_val > SEUIL_TEMP_MAX ? " !CHAUD!" : " !FROID!");
  } else {
    lcd.setCursor(12, 0); lcd.print("  OK");
  }

  // Ligne 1 — Humidité + état backend
  lcd.setCursor(0, 1);
  lcd.write(byte(1));
  lcd.print(" ");
  lcd.print(hum_val, 1);
  lcd.print("%");
  if (alerte_hum) {
    lcd.setCursor(9, 1);
    lcd.print(hum_val > SEUIL_HUM_MAX ? " !HUMID!" : " !SECHE!");
  } else {
    lcd.setCursor(10, 1);
    lcd.print(backend_ok ? " ✓BD " : wifi_ok ? "WiFi " : " OFF ");
  }
}
