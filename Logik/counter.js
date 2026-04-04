import { db, auth, ref, push, get, update, onValue } from "./config.js";
import { currentUser } from "./auth.js";

// ---Variablen für das Dart-Spiel---
let dartGame = {};
let dartGameHistory = null;
let selectedPlayers = [];
let editingPlayerIndex = null;
let currentUserData = null;

// --- INITIALISIERUNG ---
// Da addPlayerField in deinem alten Code eine Hilfsfunktion war,
// die den ersten Chip (Dich) erzeugt hat, rufen wir hier stattdessen renderPlayerChips auf.
window.addEventListener("DOMContentLoaded", () => {
  renderPlayerChips();
});

// Dieser Block in js/counter.js kümmert sich NUR um dein Profil im Match-Setup
auth.onAuthStateChanged((user) => {
  if (user) {
    currentUserData = {
      name: user.displayName || "Mein Profil",
      photoURL: null,
    };

    // Echtzeit-Listener für dein Foto (nur für deinen Chip im Counter-Setup)
    onValue(ref(db, `users/${user.uid}/photo`), (snapshot) => {
      const photoData = snapshot.val();
      if (photoData) {
        currentUserData.photoURL = photoData;
      } else {
        currentUserData.photoURL = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUserData.name)}&background=d4af37&color=fff`;
      }
      // Aktualisiert nur den Spieler-Chip im Setup
      updateHostData();
    });

    // Echtzeit-Listener für den Namen
    onValue(ref(db, `users/${user.uid}/username`), (snap) => {
      if (snap.exists()) {
        currentUserData.name = snap.val();
        updateHostData();
      }
    });
  } else {
    currentUserData = null;
    selectedPlayers = [];
    renderPlayerChips();
  }
});

/**
 * Hilfsfunktion, um die Spielerliste (Counter-Setup)
 * mit den aktuellen User-Daten synchron zu halten.
 */
function updateHostData() {
  if (currentUserData) {
    if (selectedPlayers.length === 0) {
      selectedPlayers.push(currentUserData.name);
    } else {
      selectedPlayers[0] = currentUserData.name;
    }
  }
  renderPlayerChips();
}

// Öffnet das Fenster für einen NEUEN Spieler (Klick auf das +)
window.triggerAddPlayer = () => {
  if (selectedPlayers.length >= 4) return;
  editingPlayerIndex = null;
  openNamePrompt("Spieler hinzufügen", "");
};

function openNamePrompt(title, nameValue) {
  const overlay = document.getElementById("player-name-prompt");
  document.getElementById("prompt-title").innerText = title;
  const input = document.getElementById("prompt-name-input");
  input.value = nameValue;
  overlay.style.display = "flex";
  setTimeout(() => input.focus(), 100);
}

window.closeNamePrompt = () => {
  document.getElementById("player-name-prompt").style.display = "none";
};

window.handlePromptConfirm = () => {
  const nameInput = document.getElementById("prompt-name-input");
  const name = nameInput.value.trim();

  if (name === "") return;

  if (editingPlayerIndex === null) {
    selectedPlayers.push(name);
  } else {
    selectedPlayers[editingPlayerIndex] = name;
  }

  closeNamePrompt();
  renderPlayerChips();
};

// --- RENDER FUNKTION ---
function renderPlayerChips() {
  const container = document.getElementById("player-chips-container");
  if (!container) return;

  const existingChips = container.querySelectorAll(
    ".player-chip:not(.add-starter)",
  );
  existingChips.forEach((c) => c.remove());

  const plusStarter = document.getElementById("add-player-starter");

  selectedPlayers.forEach((name, index) => {
    const chip = document.createElement("div");
    chip.className = "player-chip";

    // Prüfen: Ist dies der eingeloggte User (Index 0)?
    if (index === 0 && currentUserData) {
      chip.classList.add("host-user");
      chip.innerHTML = `
        <div class="chip-avatar host-avatar" onclick="triggerEditPlayer(${index})">
          ${
            currentUserData.photoURL
              ? `<img src="${currentUserData.photoURL}" class="avatar-img" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`
              : `<span class="avatar-initial">${name.charAt(0).toUpperCase()}</span>`
          }
          <div class="profile-settings-icon" style="position:absolute; top:-2px; right:-2px; background:var(--bright-gold); border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:10px; border:1px solid #000;">⚙</div>
        </div>
        <div class="chip-name" onclick="triggerEditPlayer(${index})">${name}</div>
      `;
    } else {
      // Normale Gäste-Chips
      chip.innerHTML = `
        <div class="remove-chip" onclick="event.stopPropagation(); removePlayerChip(${index})">✕</div>
        <div class="chip-avatar" onclick="triggerEditPlayer(${index})">${name.charAt(0).toUpperCase()}</div>
        <div class="chip-name" onclick="triggerEditPlayer(${index})">${name}</div>
      `;
    }

    container.insertBefore(chip, plusStarter);
  });

  if (plusStarter) {
    plusStarter.style.display = selectedPlayers.length >= 4 ? "none" : "flex";
  }
}

window.removePlayerChip = (index) => {
  // Host (Spieler 1) kann nicht gelöscht werden
  if (index === 0) return;

  selectedPlayers.splice(index, 1);
  renderPlayerChips();
};

document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("prompt-name-input");
  if (nameInput) {
    nameInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        window.handlePromptConfirm();
      }
    });
  }
});

// --- DEINE CHECKOUT TABELLE (VOLLSTÄNDIG) ---
const checkouts = {
  170: "T20 T20 Bull",
  167: "T20 T19 Bull",
  164: "T20 T18 Bull",
  161: "T20 T17 Bull",
  160: "T20 T20 D20",
  158: "T20 T20 D19",
  157: "T20 T19 D20",
  156: "T20 T20 D18",
  155: "T20 T19 D19",
  154: "T20 T18 D20",
  153: "T20 T19 D18",
  152: "T20 T20 D16",
  151: "T20 T17 D20",
  150: "T20 T18 D18",
  149: "T20 T19 D16",
  148: "T20 T16 D20",
  147: "T20 T17 D18",
  146: "T20 T18 D16",
  145: "T20 T15 D20",
  144: "T20 T20 D12",
  143: "T20 T17 D16",
  142: "T20 T14 D20",
  141: "T20 T19 D12",
  140: "T20 T20 D10",
  139: "T20 T13 D20",
  138: "T20 T18 D12",
  137: "T20 T19 D10",
  136: "T20 T20 D8",
  135: "T20 T17 D12",
  134: "T20 T14 D16",
  133: "T20 T19 D8",
  132: "Bull Bull D16",
  131: "T20 T13 D16",
  130: "T20 T20 D5",
  129: "T19 T16 D12",
  128: "T18 T14 D16",
  127: "T20 T17 D8",
  126: "T19 T19 D6",
  125: "SB T20 D20",
  124: "T20 T16 D8",
  123: "T19 T16 D9",
  122: "T18 T20 D4",
  121: "T20 T11 D14",
  120: "T20 S20 D20",
  119: "T19 T10 D16",
  118: "T20 18 D20",
  117: "T20 17 D20",
  116: "T20 16 D20",
  115: "T20 15 D20",
  114: "T20 14 D20",
  113: "T20 13 D20",
  112: "T20 12 D20",
  111: "T20 11 D20",
  110: "T20 10 D20",
  109: "T20 9 D20",
  108: "T19 19 D16",
  107: "T20 7 D20",
  106: "T20 14 D16",
  105: "SB T20 D10",
  104: "T20 12 D16",
  103: "T19 14 D16",
  102: "T20 10 D16",
  101: "T17 10 D20",
};

function getCheckout(score) {
  if (score > 170 || score < 2) return "";
  if (checkouts[score]) return checkouts[score];
  if (score <= 40 && score % 2 === 0) return "D" + score / 2;
  if (score === 50) return "Bullseye";
  if (score < 60) {
    if (score > 40) return "S" + (score - 40) + " D20";
    return "S" + (score % 2 === 0 ? score : score - 1) + "...";
  }
  if (score <= 100) {
    let treble = 20;
    let rest = score - treble * 3;
    if (rest > 0 && rest % 2 === 0 && rest <= 40) return "T20 D" + rest / 2;
    treble = 19;
    rest = score - treble * 3;
    if (rest > 0 && rest % 2 === 0 && rest <= 40) return "T19 D" + rest / 2;
  }
  return "FINISH MÖGLICH";
}

// --- DEINE UI LOGIK (ERWEITERT) ---
function updateActiveUI() {
  dartGame.players.forEach((player, index) => {
    const pNum = index + 1;
    const card = document.getElementById(`side-p${pNum}`);
    if (card) {
      const avg =
        player.throws > 0
          ? (player.totalPoints / player.throws).toFixed(2)
          : "0.00";
      document.getElementById(`avg-p${pNum}`).innerText = `3-Dart Avg. ${avg}`;
      document.getElementById(`score-p${pNum}`).innerText = player.score;
      document.getElementById(`leg-count-p${pNum}`).innerText = player.legs;

      const path = getCheckout(player.score);
      const coDisplay = document.getElementById(`co-p${pNum}`);
      if (coDisplay) {
        coDisplay.innerText = path;
        coDisplay.style.display = path ? "inline-block" : "none";
      }

      if (index === dartGame.activePlayerIndex) {
        card.classList.add("active-turn");
        document.getElementById("current-player-status").innerText =
          player.name.toUpperCase();
      } else {
        card.classList.remove("active-turn");
      }
    }
  });
  const statusText = document.querySelector(".turn-status-bar");
  if (statusText) statusText.style.color = "var(--gold)";
}

window.startDartGame = () => {
  // 1. Check: Hat der User überhaupt Spieler per Chip hinzugefügt?
  if (selectedPlayers.length === 0) {
    alert("Bitte füge mindestens einen Spieler hinzu!");
    return;
  }

  showView("counter-arena");

  // --- Header-Buttons tauschen ---
  const menuBtn = document.getElementById("menu-toggle");
  const abortBtn = document.getElementById("abort-btn");
  if (menuBtn) menuBtn.style.display = "none";
  if (abortBtn) abortBtn.style.display = "flex";

  const s = parseInt(document.getElementById("start-score").value);

  // 2. NEU: Wir mappen jetzt das 'selectedPlayers' Array statt nach Inputs zu suchen
  let players = selectedPlayers.map((name) => ({
    name: name,
    score: s,
    legs: 0,
    totalPoints: 0,
    throws: 0,
  }));

  // --- WICHTIG: ATTRIBUT FÜR DAS FOCUS-LAYOUT SETZEN ---
  const grid = document.querySelector(".score-grid");
  if (grid) {
    grid.setAttribute("data-players", players.length);
  }

  // Das Spiel-Objekt initialisieren
  dartGame = { players: players, activePlayerIndex: 0, startScore: s };
  dartGameHistory = null;

  // 3. Karten-Display Logik (Namen in die Arena schreiben)
  for (let i = 1; i <= 4; i++) {
    const card = document.getElementById(`side-p${i}`);
    if (card) {
      if (i <= players.length) {
        card.style.display = "flex";
        // Den Namen aus dem Objekt in das Namensfeld der Karte schreiben
        const nameTag = document.getElementById(`disp-p${i}-name`);
        if (nameTag) nameTag.innerText = players[i - 1].name;

        // Score-Anzeige auf Startwert setzen
        const scoreTag = document.getElementById(`score-p${i}`);
        if (scoreTag) scoreTag.innerText = s;
      } else {
        card.style.display = "none";
      }
    }
  }

  document.getElementById("counter-setup").style.display = "none";
  document.getElementById("counter-arena").style.display = "flex";

  // Fokus setzen (optional für Numpad)
  setTimeout(() => {
    const input = document.getElementById("points-input");
    if (input) input.focus();
  }, 100);

  updateActiveUI();
};

window.resetDartGame = () => {
  if (confirm("Match abbrechen?")) {
    // Zurück zur Setup-View (Burger wieder einblenden über showView)
    if (typeof showView === "function") {
      showView("view-counter");
    }

    // --- NEU: Header-Buttons zurücktauschen ---
    const menuBtn = document.getElementById("menu-toggle");
    const abortBtn = document.getElementById("abort-btn");
    if (menuBtn) menuBtn.style.display = "flex";
    if (abortBtn) abortBtn.style.display = "none";
    // -------------------------------------------

    document.getElementById("counter-setup").style.display = "block";
    document.getElementById("counter-arena").style.display = "none";
    dartGameHistory = null;
  }
};

// --- 1. HAUPTFUNKTION: PUNKTE EINGEBEN ---
window.submitPoints = () => {
  const input = document.getElementById("points-input");
  let val = parseInt(input.value);
  if (isNaN(val)) val = 0;
  if (val < 0 || val > 180) {
    alert("Bitte einen gültigen Wurf (0-180) eingeben!");
    input.value = "";
    return;
  }

  dartGameHistory = JSON.parse(JSON.stringify(dartGame));
  const currentPlayer = dartGame.players[dartGame.activePlayerIndex];

  // Stats tracken
  currentPlayer.totalPoints += val;
  currentPlayer.throws++;
  const newScore = currentPlayer.score - val;

  if (newScore === 0) {
    // ANSTATT PROMPT: Zeige dein neues schickes Modal
    document.getElementById("checkout-modal").style.display = "flex";

    // Wir merken uns den Wert des letzten Wurfs für die zweite Funktion
    window.lastWinningVal = val;
  } else if (newScore < 2) {
    alert("BUST! Zu viel geworfen.");
    dartGame.activePlayerIndex =
      (dartGame.activePlayerIndex + 1) % dartGame.players.length;
    updateActiveUI();
  } else {
    currentPlayer.score = newScore;
    dartGame.activePlayerIndex =
      (dartGame.activePlayerIndex + 1) % dartGame.players.length;
    updateActiveUI();
  }

  input.value = "";
  input.focus();
};

// --- 2. NEUE FUNKTION: WENN DU AUF 1, 2 ODER 3 IM MODAL KLICKST ---
window.confirmCheckout = (checkoutDarts) => {
  const currentPlayer = dartGame.players[dartGame.activePlayerIndex];
  const val = window.lastWinningVal; // Der Wert vom Sieg-Wurf

  // Modal wieder schließen
  document.getElementById("checkout-modal").style.display = "none";

  currentPlayer.legs++;
  alert("GAME SHOT! " + currentPlayer.name + " gewinnt das Leg.");

  // --- SPIEL AUTOMATISCH SPEICHERN ---
  // WICHTIG: Prüfe in der Konsole (F12), ob diese Namen identisch sind!
  const myProfileName = currentUserData ? currentUserData.name : "";
  console.log("Spieler:", currentPlayer.name, "| Profil:", myProfileName);

  if (currentUser && currentPlayer.name === myProfileName) {
    // 1. High Finish Check
    const userRef = ref(db, "users/" + currentUser.uid);
    get(userRef).then((snapshot) => {
      const userData = snapshot.val();
      const currentHigh =
        userData && userData.highFinish ? userData.highFinish : 0;
      if (val > currentHigh) {
        update(userRef, { highFinish: val });
        console.log("Neuer Rekord gespeichert:", val);
      }
    });

    // 2. Average präzise berechnen
    const totalDartsThrown = (currentPlayer.throws - 1) * 3 + checkoutDarts;
    const sessionAvg = parseFloat(
      ((currentPlayer.totalPoints / totalDartsThrown) * 3).toFixed(2),
    );

    // 3. In 'user_stats' speichern (Passend zum Dashboard!)
    const statsRef = ref(db, "user_stats");
    push(statsRef, {
      uid: currentUser.uid,
      name: "Training " + dartGame.startScore,
      mode: "x01",
      finalAvg: sessionAvg,
      players: dartGame.players.map((p) => p.name),
      createdAt: Date.now(),
      checkoutDart: checkoutDarts,
    });
  }

  // Spiel zurücksetzen für das nächste Leg
  dartGame.players.forEach((p) => {
    p.score = dartGame.startScore;
  });

  dartGame.activePlayerIndex =
    (dartGame.activePlayerIndex + 1) % dartGame.players.length;

  updateActiveUI();
};
// Wartet, bis das Dokument geladen ist
document.addEventListener("DOMContentLoaded", () => {
  const pointsInput = document.getElementById("points-input");

  if (pointsInput) {
    pointsInput.addEventListener("keydown", (event) => {
      // Prüft auf "Enter" (Key-Code 13)
      if (event.key === "Enter") {
        // Verhindert das Neuladen der Seite (falls der Input in einem Form-Tag ist)
        event.preventDefault();

        // Ruft deine Senden-Funktion auf
        submitPoints();
      }
    });
  }
});

window.undoLastMove = () => {
  if (!dartGameHistory) return;
  dartGame = JSON.parse(JSON.stringify(dartGameHistory));
  dartGameHistory = null;
  updateActiveUI();
};
/* --- NUMPAD LOGIK --- */
window.pressNum = (num) => {
  const input = document.getElementById("points-input");

  if (num === "CLR") {
    input.value = "";
  } else if (num === "DEL") {
    input.value = input.value.slice(0, -1);
  } else {
    // Dart-Scores sind maximal 3-stellig (0-180)
    if (input.value.length < 3) {
      input.value += num;
    }
  }
};
