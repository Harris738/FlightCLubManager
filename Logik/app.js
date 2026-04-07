import { db, ref, onValue } from "./config.js";
import { currentUser } from "./auth.js";

// --- DASHBOARD INITIALISIERUNG ---
// Diese Funktion wird von auth.js aufgerufen, sobald der User eingeloggt ist
window.initDashboard = () => {
  if (!currentUser) return;

  // 1. REKORDE (High Finish)
  onValue(ref(db, "users/" + currentUser.uid), (snap) => {
    const userData = snap.val();
    const dashBestEl = document.getElementById("dash-best");
    if (dashBestEl) {
      dashBestEl.innerText =
        userData && userData.highFinish ? userData.highFinish : "--";
    }
  });

  // 2. GESAMT-AVERAGE
  onValue(ref(db, "user_stats"), (snap) => {
    const data = snap.val();
    const dashAvgEl = document.getElementById("dash-avg");
    let totalAvg = 0;
    let countAvg = 0;
    if (data) {
      Object.values(data).forEach((stat) => {
        if (stat.uid === currentUser.uid && stat.finalAvg) {
          totalAvg += stat.finalAvg;
          countAvg++;
        }
      });
    }
    if (dashAvgEl) {
      dashAvgEl.innerText =
        countAvg > 0 ? (totalAvg / countAvg).toFixed(2) : "--";
    }
  });

  // 3. EVENT-LISTE (Turniere auf dem Dashboard)
  onValue(ref(db, "all_events"), (snap) => {
    const data = snap.val();
    const dashWinsEl = document.getElementById("dash-wins");
    const list = document.getElementById("tournament-list");
    const statTotal = document.getElementById("stat-total-events");

    if (!data) {
      if (dashWinsEl) dashWinsEl.innerText = "0";
      if (statTotal) statTotal.innerText = "0";
      if (list)
        list.innerHTML =
          "<p style='opacity:0.5; text-align:center;'>Keine Events gefunden.</p>";
      return;
    }

    const myEventIds = Object.keys(data).filter(
      (id) => data[id].uid === currentUser.uid,
    );
    if (dashWinsEl) dashWinsEl.innerText = myEventIds.length;
    if (statTotal) statTotal.innerText = myEventIds.length;

    if (list) {
      list.innerHTML = "";
      const myEventsData = myEventIds
        .map((id) => ({ id, ...data[id] }))
        .sort((a, b) => b.createdAt - a.createdAt);

      myEventsData.forEach((event) => {
        const item = document.createElement("div");
        item.className = "tournament-item";
        item.innerHTML = `
          <div onclick="window.openEvent('${event.id}')" style="cursor:pointer; flex:1;">
            <div style="font-weight:bold; font-size:1rem; color:#fff;">${event.name}</div>
            <div style="font-size:0.65rem; color:var(--gold); margin-top:4px;">
              ${event.mode.toUpperCase()} • ${event.players ? event.players.length : 0} SPIELER
            </div>
          </div>
          <button class="btn-delete" onclick="window.deleteEvent('${event.id}')">LÖSCHEN</button>
        `;
        list.appendChild(item);
      });
    }
  });
};

// --- NAVIGATION & SIDEBAR ---

window.toggleSidebar = function () {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (sidebar) {
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
  }
};

window.showView = function (viewId) {
  // 1. Check: Wenn der User zum Setup will, aber ein Spiel läuft -> Arena erzwingen
  // 'dartGame' muss deine globale Variable sein, die das Spiel hält
  if (
    viewId === "view-counter" &&
    typeof dartGame !== "undefined" &&
    dartGame.players &&
    dartGame.players.length > 0
  ) {
    viewId = "counter-arena";
  }

  // 2. Alle Standard-Views verstecken
  const views = document.querySelectorAll(".view");
  views.forEach((v) => {
    v.classList.remove("active");
    v.style.display = "none";
  });

  // 3. SPEZIELL: Dart-Arena und Setup explizit verstecken
  const arena = document.getElementById("counter-arena");
  const setup = document.getElementById("view-setup");
  if (arena) arena.style.display = "none";
  if (setup) setup.style.display = "none";

  // 4. Ziel-View anzeigen
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add("active");
    // WICHTIG: Arena braucht FLEX für das Layout, alles andere BLOCK
    if (viewId === "counter-arena") {
      target.style.display = "flex";
    } else {
      target.style.display = "block";
    }
  }

  // --- DATEN FÜR STATISTIK LADEN ---
  if (viewId === "view-stats" && typeof window.loadProStats === "function") {
    window.loadProStats();
  }

  // --- HEADER TITEL LOGIK ---
  const headerTitle = document.getElementById("current-view-title");
  if (headerTitle) {
    const titles = {
      "view-dashboard":
        '<span class="gold-part">FLIGHTCLUB</span><span class="white-part">PRO</span>',
      "view-counter":
        '<span class="gold-part">DART</span><span class="white-part">COUNTER</span>',
      "view-creator":
        '<span class="gold-part">EVENT</span><span class="white-part">MANAGER</span>',
      "view-profile":
        '<span class="gold-part">MEIN</span><span class="white-part">PROFIL</span>',
      "view-event":
        '<span class="gold-part">LIVE</span><span class="white-part">TURNIER</span>',
      "counter-arena":
        '<span class="gold-part">DART</span><span class="white-part">ARENA</span>',
      "view-stats":
        '<span class="gold-part">PRO</span><span class="white-part">STATS</span>',
    };
    headerTitle.innerHTML = titles[viewId] || "FLIGHTCLUB PRO";
  }

  // --- BUTTON LOGIK ---
  const menuBtn = document.getElementById("menu-toggle");
  const backBtn = document.getElementById("header-back-btn");
  const abortBtn = document.getElementById("abort-btn");

  // Im Spiel (Arena) verstecken wir das Sandwich-Menü und zeigen den Abbrechen-Button
  if (menuBtn)
    menuBtn.style.display =
      viewId === "view-setup" ||
      viewId === "view-event" ||
      viewId === "counter-arena"
        ? "none"
        : "flex";

  if (backBtn)
    backBtn.style.display =
      viewId === "view-setup" || viewId === "view-event" ? "flex" : "none";

  if (abortBtn)
    abortBtn.style.display = viewId === "counter-arena" ? "flex" : "none";

  // --- SIDEBAR RESET ---
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  if (sidebar) sidebar.classList.remove("active");
  if (overlay) overlay.classList.remove("active");
};

window.goBack = () => {
  const activeView = document.querySelector(".view.active");
  if (!activeView) return;
  if (activeView.id === "view-setup" || activeView.id === "view-event") {
    window.showView("view-creator");
  } else {
    window.showView("view-dashboard");
  }
};
// --- DASHBOARD NAVIGATION ---
// Wartet, bis das Dokument geladen ist, und verknüpft die Kachel
document.addEventListener("DOMContentLoaded", () => {
  const tournamentTile = document.getElementById("btn-dashboard-tournaments");
  if (tournamentTile) {
    tournamentTile.addEventListener("click", () => {
      // Nutzt deine bestehende Funktion, um zum Creator/Manager zu wechseln
      window.showView("view-creator");
      console.log("Navigation: Dashboard -> Event Manager");
    });
  }
});

window.loadProStats = () => {
  if (!currentUser) return;

  // 1. Bestwert (Rekord) direkt aus dem User-Profil laden (Bestes Leg)
  const userRef = ref(db, "users/" + currentUser.uid);
  onValue(userRef, (snap) => {
    const userData = snap.val();
    const bestLegEl = document.getElementById("stat-best-leg");
    if (bestLegEl) {
      // Zeigt den Rekordwert aus dem Profil an
      bestLegEl.innerText =
        userData && userData.bestLeg ? userData.bestLeg + " Darts" : "--";
    }
  });

  // 2. Hol dir den aktuellen Dashboard-Average für den Trend-Vergleich
  const dashAvgEl = document.getElementById("dash-avg");
  const currentGlobalAvg = dashAvgEl ? parseFloat(dashAvgEl.innerText) || 0 : 0;

  // 3. Match-Historie aus user_stats laden
  onValue(ref(db, "user_stats"), (snap) => {
    const data = snap.val();
    const historyContainer = document.getElementById("stats-history-container");
    if (!historyContainer) return;

    if (!data) {
      historyContainer.innerHTML =
        "<p style='opacity:0.5; text-align:center;'>Noch keine Spiele aufgezeichnet.</p>";
      return;
    }

    // Filtere Spiele des aktuellen Users
    const myStats = Object.values(data)
      .filter((s) => s.uid === currentUser.uid)
      .sort((a, b) => b.createdAt - a.createdAt);

    // Berechnung der Highlights (Checkout-Darts Durchschnitt)
    let totalCheckoutDarts = 0;
    let checkoutCount = 0;

    myStats.forEach((s) => {
      if (s.checkoutDart) {
        totalCheckoutDarts += s.checkoutDart;
        checkoutCount++;
      }
    });

    // Update der Checkout-Kachel oben
    const avgCOEl = document.getElementById("stat-avg-checkout");
    if (avgCOEl) {
      avgCOEl.innerText =
        checkoutCount > 0
          ? (totalCheckoutDarts / checkoutCount).toFixed(1)
          : "--";
    }

    // Liste rendern
    historyContainer.innerHTML = "";
    myStats.slice(0, 10).forEach((match) => {
      const date = new Date(match.createdAt).toLocaleDateString("de-DE");

      // Dynamischer Trend-Vergleich mit dem Dashboard-Average
      const isBetter = match.finalAvg >= currentGlobalAvg;
      const trendIcon = isBetter ? "📈" : "📉";
      const trendColor = isBetter ? "var(--qualify-green)" : "var(--danger)";

      const item = document.createElement("div");
      item.className = "tournament-item";
      item.innerHTML = `
        <div style="flex:1;">
          <div style="font-weight:bold; color:#fff;">${match.name} (${date})</div>
          <div style="font-size:0.7rem; color:var(--gold);">
            AVG: ${match.finalAvg.toFixed(2)} | 1st 9: ${match.first9Avg ? match.first9Avg.toFixed(2) : "--"} | Darts: ${match.dartsUsed || "?"}
          </div>
        </div>
        <div class="tile-arrow" style="opacity:1; color: ${trendColor}; font-size: 1.2rem;">
          ${trendIcon}
        </div>
      `;
      historyContainer.appendChild(item);
    });
  });
};
