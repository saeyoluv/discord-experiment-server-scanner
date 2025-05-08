# discord-experiment-server-scanner

**Scanner de serveurs expérimentaux Discord**

Ce projet automatise la détection de serveurs Discord déployant des fonctionnalités en test (feature flags). Il crée et supprime des serveurs à partir d’un template, analyse leurs identifiants selon un algorithme de hachage, et signale ceux qui correspondent à vos plages d’expérience.

---

## Table des matières

1. [Fonctionnalités](#fonctionnalités)
2. [Prérequis](#prérequis)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Utilisation](#utilisation)
6. [Organisation du code](#organisation-du-code)
7. [Gestion des erreurs et back-off](#gestion-des-erreurs-et-back-off)
8. [Notifications](#notifications)
9. [Dépannage](#dépannage)

---

## Fonctionnalités

* **Création automatique** de serveurs via l’API interne `createGuildFromTemplate`.
* **Détection déterministe** : un algorithme de hachage (MurmurHash3) filtre les IDs selon vos plages d’expérience.
* **Suppression programmée** des serveurs non pertinents.
* **Intervalle aléatoire & back-off exponentiel** pour limiter les risques de rate-limits et blocages anti-spam.
* **Arrêt automatique** dès qu’un serveur valide est détecté (option configurable).
* **Logs détaillés** et clairs pour suivre le déroulement en temps réel.

## Prérequis

> **⚠️ ATTENTION** : L'utilisation du script peut entraîner des requêtes massives vers l'API Discord et violer ses Conditions d’Utilisation, ce qui risque de bannir ou suspendre votre compte. Utilisez-le avec précaution.

## Prérequis

* **Plugin** : [Vencord ConsoleShortcuts](https://vencord.com/) installé et activé.
* **Compte Discord** : connecté, avec la capacité de créer des serveurs (quota non atteint).

## Installation

1. Lancez Discord dans votre navigateur.
2. Vérifiez que Vencord et le plugin **ConsoleShortcuts** sont actifs.
3. Ouvrez la console Développeur (F12 ou Ctrl+Shift+I).
4. **Créez manuellement un serveur Discord** via l'interface utilisateur (nécessaire pour initialiser la fonction `createGuildFromTemplate`). Vous pouvez le supprimer ensuite si vous le souhaitez.
5. Copiez-collez l’intégralité du script dans la console, puis validez.

## Configuration

Personnalisez l’objet `CONFIG` en tête du script :

```js
const CONFIG = {
  BASE_INTERVAL: 120_000,           // Intervalle de base entre deux créations (ms, ≥ 120s)
  DELETE_DELAY: 2_000,              // Délai avant suppression (ms)
  MAX_ADDITIONAL_JITTER: 5_000,     // Jitter aléatoire max (ms)
  EXPERIMENT_SEED: "2025-02_skill_trees:", // Préfixe pour le hash
  EXPERIMENT_RANGES: [ [10, 20], [60, 100] ], // Plages valides (sur 10000)
  SERVER_NAME: "Tag server",       // Nom des serveurs créés
  STOP_ON_FOUND: true,              // Arrêter au premier succès
  MAX_BACKOFF_MULTIPLIER: 5,        // Multiplicateur max pour le back-off
};
```

> **Conseil** : pour des tests rapides, réduisez temporairement `BASE_INTERVAL` à `5000` (5 s).

## Utilisation

Dès que le script est lancé :

1. Affichage d’un en‑tête et des paramètres initiaux.
2. Création d’un nouveau serveur, puis test de son ID.
3. Suppression si l’ID n’est pas dans les plages configurées.
4. Attente d’un intervalle aléatoire (jitter + back‑off) avant la prochaine tentative.
5. Répétition jusqu’à détection d’un serveur valide ou arrêt manuel.

## Organisation du code

* **`murmurhash3_32_gc`** : implémentation de MurmurHash3 32 bits.
* **`inExperiment`** : vérifie si un ID entre dans les plages d’expérience.
* **`GuildCreator`** : classe gérant le cycle principal :

  * `runCycle()` : création, test, suppression ou notification.
  * `scheduleDeletion()` : supprime un serveur après un délai aléatoire.
  * `getNextInterval()` : calcule l’intervalle en intégrant back-off et jitter.
  * `scheduleNext()` : planifie l’itération suivante.
  * `start()` : initialise et lance le premier cycle.

## Gestion des erreurs et back-off

* Toutes les exceptions sont capturées et loggées.
* Un compteur `failureCount` augmente à chaque erreur, multipliant progressivement l’intervalle de base (jusqu’à `MAX_BACKOFF_MULTIPLIER` ×).
* Permet de diminuer la pression sur l’API et d’éviter les blocages temporaires.

## Notifications

* Un message clair s’affiche lors de la découverte d’un serveur valide.
* Vous pouvez enrichir `notifySuccess()` avec :

  * Un **son** (`new Audio('ding.mp3').play()`).
  * Un **webhook** Discord.

## Dépannage

* **403 Forbidden** : quota de serveurs atteint ou blocage anti-abus.

  * Vérifiez votre quota, rallongez l’intervalle, supprimez des serveurs existants.
* **`findByProps`**\*\* undefined\*\* : assurez-vous que **ConsoleShortcuts** est chargé.
* **Rate limit** : ne passez jamais sous 120 s sans back-off approprié.
