"""
services/lmstudio_service.py — Communication avec LM Studio en Local (Qwen 2.5).
Responsabilité : Appeler l'API locale de LM Studio (localhost:1234) et garantir 
un retour JSON propre, même avec un petit modèle de 0.5B.
"""
import os
import re
import json
import requests

# URL par défaut de LM Studio
LM_STUDIO_URL = "http://localhost:1234/v1/chat/completions"


def chat_completion(
    messages: list[dict],
    max_tokens: int = 400,
    temperature: float = 0.1,  # temperature très basse (0.1) obligatoire pour Qwen 0.5B pour rester stable
    timeout: int = 30,
) -> str:
    """
    Appel générique au modèle local via LM Studio (compatible OpenAI API).
    """
    payload = {
        "model": "local-model",  # LM Studio utilise par défaut le modèle chargé
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }

    try:
        response = requests.post(LM_STUDIO_URL, json=payload, timeout=timeout)
        response.raise_for_status()
        res_json = response.json()
        raw_text = res_json["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[LM-Studio Error] API non accessible ou erreur: {e}")
        # Retourner un JSON vide par défaut pour éviter le crash du backend
        return "{}"

    # ── NETTOYAGE SÉVÈRE DU JSON (Spécial Modèles Sghars kima Qwen 0.5B) ──
    # Qwen 0.5B peut écrire du texte avant ou après le JSON. On extrait uniquement le bloc {}
    if "{" in raw_text and "}" in raw_text:
        try:
            # 1. Enlever les balises markdown ```json
            clean_text = re.sub(r"```json\s*|```", "", raw_text).strip()
            # 2. Prendre uniquement du premier '{' au dernier '}'
            start_idx = clean_text.find("{")
            end_idx = clean_text.rfind("}") + 1
            extracted_json = clean_text[start_idx:end_idx]
            
            # Valider que c'est un vrai JSON avant de le retourner
            json.loads(extracted_json)
            return extracted_json
        except Exception:
            pass

    return raw_text


def build_analyse_panne_messages(type_panne: str, description: str, valeur) -> list[dict]:
    """Construit le payload pour l'analyse d'une panne."""
    return [{
        "role": "user",
        "content": (
            f"Expert maintenance Tunisie Telecom.\n"
            f"Panne: {type_panne} | {description} | Valeur: {valeur}\n"
            f"Fournis: 1.Diagnostic 2.Causes 3.Actions. Court et clair."
        )
    }]


def build_chatbot_messages(system_prompt: str, historique: list, message: str) -> list[dict]:
    """Construit le payload complet pour le chatbot avec historique."""
    messages = [{"role": "system", "content": system_prompt}]
    for h in (historique or [])[-4:]: # Réduit à 4 pour ne pas surcharger Qwen 0.5B
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": message})
    return messages


def build_ai_assign_messages(prompt: str) -> list[dict]:
    """
    Payload pour l'assignation intelligente.
    On donne un exemple TRÈS strict à Qwen 0.5B pour qu'il comprenne le format attendu.
    """
    return [
        {
            "role": "system", 
            "content": (
                "You are an automated router. You must output a JSON object and NOTHING ELSE. "
                "No comments, no markdown, no introduction. "
                "Example of expected output: {\"technicien_id\": 3, \"reason\": \"disponible\"}"
            )
        },
        {"role": "user", "content": f"Based on this data:\n{prompt}\nReturn the JSON object now:"}
    ]