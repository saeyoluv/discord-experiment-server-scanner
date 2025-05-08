// ───────────────────────────────────────
// CONFIGURATION
// ───────────────────────────────────────

const CONFIG = {
  BASE_INTERVAL: 120_000,           // intervalle de base (en ms) ≳ 120 s
  DELETE_DELAY: 2_000,              // délai avant suppression (en ms)
  MAX_ADDITIONAL_JITTER: 5_000,     // jitter max (en ms)
  EXPERIMENT_SEED: "2025-02_skill_trees:",
  EXPERIMENT_RANGES: [ [10, 20], [60, 100] ],
  SERVER_NAME: "Tag server",
  STOP_ON_FOUND: true,
  MAX_BACKOFF_MULTIPLIER: 5,        // jusqu’à 5× l’intervalle de base
};

// ───────────────────────────────────────
// UTILITAIRES
// ───────────────────────────────────────

/** Sleep promisifié */
const wait = ms => new Promise(res => setTimeout(res, ms));

/** MurmurHash3 32 bits (identique à la version originale) */
function murmurhash3_32_gc(str, seed = 0) {
  let h1 = seed >>> 0, k1, i = 0;
  const key = new TextEncoder().encode(str);
  const len = key.length;
  const view = new DataView(key.buffer, key.byteOffset);

  // blocs de 4 octets
  for (; i + 4 <= len; i += 4) {
    k1 = view.getUint32(i, true);
    k1 = Math.imul(k1, 0xcc9e2d51);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, 0x1b873593);
    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1 = Math.imul(h1, 5) + 0xe6546b64;
  }
  // reste
  k1 = 0;
  const tail = len & 3;
  if (tail === 3) k1 ^= key[i + 2] << 16;
  if (tail >= 2) k1 ^= key[i + 1] << 8;
  if (tail >= 1) {
    k1 ^= key[i];
    k1 = Math.imul(k1, 0xcc9e2d51);
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = Math.imul(k1, 0x1b873593);
    h1 ^= k1;
  }
  // finalisation
  h1 ^= len;
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h1 = Math.imul(h1, 0xc2b2ae35);
  h1 ^= h1 >>> 16;
  return h1 >>> 0;
}

/** Teste si un ID tombe dans les plages de l’expérience */
function inExperiment(id) {
  const hash = murmurhash3_32_gc(CONFIG.EXPERIMENT_SEED + id) % 10000;
  return CONFIG.EXPERIMENT_RANGES.some(
    ([min, max]) => hash >= min && hash < max
  );
}

// ───────────────────────────────────────
// DÉTECTION DES FONCTIONS DISCORD
// ───────────────────────────────────────

if (typeof findByProps !== "function")
  throw new Error("Le plugin ConsoleShortcuts n'est pas chargé.");

const deleteGuild    = findByProps("deleteGuild").deleteGuild;
const createFromTpl  = findByProps("createGuildFromTemplate").createGuildFromTemplate;
if (!deleteGuild || !createFromTpl)
  throw new Error("Impossible de récupérer les API internes Discord.");

// ───────────────────────────────────────
// GESTIONNAIRE DE CRÉATION DE GUILDE
// ───────────────────────────────────────

class GuildCreator {
  constructor() {
    this.keepRunning   = true;
    this.failureCount  = 0;   // pour l’exponentiel back-off
  }

  /** Calcule l’intervalle avant la prochaine tentative */
  getNextInterval() {
    const base    = CONFIG.BASE_INTERVAL;
    const backoff = Math.min(
      CONFIG.MAX_BACKOFF_MULTIPLIER,
      1 + this.failureCount * 0.5
    );
    const jitter  = Math.random() * CONFIG.MAX_ADDITIONAL_JITTER;
    return base * backoff + jitter;
  }

  /** Planifie la prochaine itération */
  scheduleNext() {
    if (!this.keepRunning) return;
    const delay = this.getNextInterval();
    console.log(`→ Prochaine tentative dans ${(delay/1000).toFixed(1)} s`);
    return wait(delay).then(() => this.runCycle());
  }

  /** Supprime une guilde après un petit délai */
  async scheduleDeletion(guild) {
    const delay = CONFIG.DELETE_DELAY + Math.random() * CONFIG.MAX_ADDITIONAL_JITTER;
    console.log(`  [⏳] Suppression de ${guild.id} dans ${(delay/1000).toFixed(1)} s`);
    await wait(delay);
    await deleteGuild(guild.id);
    console.log(`  [🗑️] Guild supprimée: ${guild.id}`);
  }

  /** Envoi d’un log de succès (et alertes si besoin) */
  notifySuccess(guild) {
    console.log(`🎉 Serveur TAG trouvé ! ID=${guild.id}`);
    // par ex. new Audio('ding.mp3').play();
  }

  /** Coeur du cycle : création, test, suppression ou arrêt */
  async runCycle() {
    if (!this.keepRunning) return;

    try {
      console.log("\n[🔄] Création d’une nouvelle guilde…");
      const guild = await createFromTpl(
        CONFIG.SERVER_NAME,
        null,
        { id: "CREATE", label: "Create My Own", channels: [], system_channel_id: null },
        false,
        false
      );
      if (!guild?.id) throw new Error("ID non renvoyé");

      console.log(`  [✅] Créée: ${guild.id}`);
      if (inExperiment(guild.id)) {
        this.notifySuccess(guild);
        if (CONFIG.STOP_ON_FOUND) {
          this.keepRunning = false;
          return;
        }
      } else {
        await this.scheduleDeletion(guild);
      }

      this.failureCount = 0; // reset back-off après succès

    } catch (err) {
      console.error("  [❌] Erreur:", err.message || err);
      this.failureCount++;
    } finally {
      if (this.keepRunning) {
        await this.scheduleNext();
      }
    }
  }

  /** Démarre la boucle */
  start() {
    console.clear();
    console.log("===== Guild Creation Script =====");
    console.log(` Base interval : ${CONFIG.BASE_INTERVAL/1000}s`);
    console.log(` Max jitter : ${CONFIG.MAX_ADDITIONAL_JITTER/1000}s`);
    console.log("=================================");
    this.runCycle();
  }
}

// ───────────────────────────────────────
// LANCEMENT
// ───────────────────────────────────────

new GuildCreator().start();
