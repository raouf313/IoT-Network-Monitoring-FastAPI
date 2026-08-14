"""
tests/test_services.py — Tests des services métier.
Tests unitaires sans base de données.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from services.tech_service import (
    get_zone, LOCALISATION_ZONE, SPECIALITE_MOTS, _score_specialite,
)


class TestGetZone:
    def test_tunis(self):
        assert get_zone("Tunis Centre") == "nord"

    def test_ghardimaou(self):
        assert get_zone("Ghardimaou") == "nord-ouest"

    def test_sfax(self):
        assert get_zone("Sfax") == "sud"

    def test_case_insensitive(self):
        assert get_zone("SOUSSE") == "centre"

    def test_partial_match(self):
        assert get_zone("Ariana Banlieue") == "nord"

    def test_unknown(self):
        assert get_zone("Paris") == "inconnu"

    def test_empty(self):
        assert get_zone("") == "inconnu"

    def test_none(self):
        assert get_zone(None) == "inconnu"


class TestScoreSpecialite:
    def test_reseau_match(self):
        score = _score_specialite("réseau", "Problème fibre optique ADSL")
        # "fibre" et "adsl" sont dans les mots-clés réseau
        assert score > 0

    def test_no_match(self):
        score = _score_specialite("informatique", "Problème de climatisation")
        # "climatisation" n'est pas dans les mots-clés informatique
        assert score == 0

    def test_multiple_matches(self):
        score = _score_specialite(
            "électricité",
            "Tension électrique anormale sur le courant"
        )
        # "électrique" ou "électricité" et "courant" et "tension" -> 3 matches
        assert score >= 2

    def test_case_insensitive(self):
        score = _score_specialite("RÉSEAU", "Problème FIBRE optique")
        assert score > 0

    def test_empty_specialite(self):
        score = _score_specialite("", "Description quelconque")
        assert score == 0

    def test_none_specialite(self):
        score = _score_specialite(None, "Description quelconque")
        assert score == 0


class TestLocalisationZoneDict:
    """Vérifie que toutes les localisations connues sont couvertes."""

    def test_nord_zones(self):
        nord_keys = ['tunis', 'ariana', 'ben arous', 'manouba',
                     'bizerte', 'nabeul', 'zaghouan']
        for k in nord_keys:
            assert k in LOCALISATION_ZONE, f"{k} manque dans LOCALISATION_ZONE"
            assert LOCALISATION_ZONE[k] == "nord"

    def test_nord_ouest_zones(self):
        nw_keys = ['jendouba', 'ghardimaou', 'ain draham',
                   'beja', 'kef', 'siliana']
        for k in nw_keys:
            assert k in LOCALISATION_ZONE, f"{k} manque dans LOCALISATION_ZONE"
            assert LOCALISATION_ZONE[k] == "nord-ouest"

    def test_centre_zones(self):
        centre_keys = ['sousse', 'monastir', 'mahdia',
                       'kairouan', 'kasserine', 'sidi bouzid']
        for k in centre_keys:
            assert k in LOCALISATION_ZONE, f"{k} manque dans LOCALISATION_ZONE"
            assert LOCALISATION_ZONE[k] == "centre"

    def test_sud_zones(self):
        sud_keys = ['sfax', 'gabes', 'mednine', 'tataouine',
                    'gafsa', 'tozeur', 'kebili']
        for k in sud_keys:
            assert k in LOCALISATION_ZONE, f"{k} manque dans LOCALISATION_ZONE"
            assert LOCALISATION_ZONE[k] == "sud"


class TestSpecialiteMots:
    def test_reseau_keywords(self):
        mots = ['réseau', 'fibre', 'adsl', 'backbone', 'routeur',
                'commutateur', 'câblage']
        for m in mots:
            assert m in SPECIALITE_MOTS['réseau'], f"'{m}' manque dans réseau"

    def test_electricite_keywords(self):
        mots = ['électrique', 'électrogen', 'électricité', 'courant', 'tension']
        for m in mots:
            assert m in SPECIALITE_MOTS['électricité'], f"'{m}' manque dans électricité"

    def test_informatique_keywords(self):
        mots = ['firmware', 'logiciel', 'informatique', 'serveur',
                'système', 'software']
        for m in mots:
            assert m in SPECIALITE_MOTS['informatique'], f"'{m}' manque dans informatique"

    def test_climatisation_keywords(self):
        mots = ['refroidissement', 'climatisation', 'température',
                'hvac', 'cooling', 'critique']
        for m in mots:
            assert m in SPECIALITE_MOTS['climatisation'], f"'{m}' manque dans climatisation"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
