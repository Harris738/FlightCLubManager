import { db, ref, push, get, update, remove, set } from "./config.js";
import { currentUser } from "./auth.js";

// Variable für das aktuell geöffnete Event (wird innerhalb dieser Datei genutzt)
let currentId = null;

// --- 3. EVENT-MANAGER LOGIK (Aus all_events) ---
window.generateEvent = () => {
  const name = document.getElementById("event-name").value;
  const mode = document.getElementById("event-mode").value;
  const players = document
    .getElementById("event-players")
    .value.split(",")
    .map((s) => s.trim())
    .filter((s) => s !== "");

  if (!name || players.length < 2) return alert("Daten unvollständig!");

  let eventData = {
    name,
    mode,
    players,
    uid: currentUser.uid,
    createdAt: Date.now(),
    finals: { unlocked: false },
  };

  // --- INTERNE HILFSFUNKTION: FAIR ROTATION ---
  // Diese Funktion sortiert die Spiele so, dass Spieler mit der längsten Pause priorisiert werden
  const getFairRotationMatches = (matches, allPlayers) => {
    let pool = [...matches].sort(() => Math.random() - 0.5); // Grundmischung
    let sorted = [];
    let lastPlayed = {};

    // Initialisieren: Jeder Spieler hat "unendlich" lange nicht gespielt (-100)
    allPlayers.forEach((p) => (lastPlayed[p] = -100));

    while (pool.length > 0) {
      let bestIdx = 0;
      let maxWaitTime = -1;

      for (let i = 0; i < pool.length; i++) {
        const m = pool[i];
        // Wartezeit berechnen: Wie viele Spiele ist es her, seit p1 und p2 dran waren?
        const waitTime =
          sorted.length - lastPlayed[m.p1] + (sorted.length - lastPlayed[m.p2]);

        if (waitTime > maxWaitTime) {
          maxWaitTime = waitTime;
          bestIdx = i;
        }
      }

      const picked = pool.splice(bestIdx, 1)[0];
      // Markieren, dass diese Spieler JETZT (beim aktuellen Index) gespielt haben
      lastPlayed[picked.p1] = sorted.length;
      lastPlayed[picked.p2] = sorted.length;
      sorted.push(picked);
    }
    return sorted;
  };

  if (mode === "knockout") {
    eventData.koRounds = createKOBracket(players);
    eventData.finals.unlocked = true;
    checkAllFreilosLocally(eventData.koRounds);
  } else {
    const pairs = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        pairs.push({ p1: players[i], p2: players[j], s1: "", s2: "" });
      }
    }

    const multiplier =
      mode === "groups" && document.getElementById("group-rounds").value === "2"
        ? 2
        : 1;

    let finalPairs = [...pairs];
    if (multiplier === 2) {
      pairs.forEach((p) =>
        finalPairs.push({ p1: p.p2, p2: p.p1, s1: "", s2: "" }),
      );
    }

    const count = mode === "league" ? 12 : 1;
    eventData.days = [];

    for (let d = 1; d <= count; d++) {
      // Hier wird die Fair Rotation auf den aktuellen Spieltag angewendet
      const balancedMatches = getFairRotationMatches(finalPairs, players);

      eventData.days.push({
        round: mode === "league" ? "Spieltag " + d : "Gruppenphase",
        matches: JSON.parse(JSON.stringify(balancedMatches)),
        locked: false,
      });
    }
  }

  push(ref(db, "all_events"), eventData).then(() => showView("view-creator"));
};

window.toggleGroupOptions = () => {
  const mode = document.getElementById("event-mode").value;
  document.getElementById("group-options").style.display =
    mode === "groups" ? "block" : "none";
};

window.showView = (id) => {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (id !== "view-profile") {
    document.getElementById("profile-msg").innerText = "";
    document.getElementById("upload-status").innerText =
      "Bild zum Ändern antippen";
    document.getElementById("upload-status").style.color = "var(--gold)";
  }
};

window.deleteEvent = (id) => {
  if (confirm("Event wirklich löschen?")) remove(ref(db, "all_events/" + id));
};

function createKOBracket(players) {
  let shuffled = [...players].sort(() => Math.random() - 0.5);
  let size = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
  let slots = Array(size).fill("FREILOS");
  for (let i = 0; i < shuffled.length; i++) slots[i] = shuffled[i];
  let firstRound = [];
  for (let i = 0; i < size / 2; i++)
    firstRound.push({ p1: slots[i], p2: slots[size - 1 - i], s1: "", s2: "" });
  let rounds = { Runde_1: firstRound };
  let rCount = 2;
  for (let s = firstRound.length / 2; s >= 1; s /= 2) {
    let nextR = [];
    for (let i = 0; i < s; i++)
      nextR.push({ p1: "?", p2: "?", s1: "", s2: "" });
    rounds["Runde_" + rCount] = nextR;
    rCount++;
  }
  return rounds;
}

function checkAllFreilosLocally(rounds) {
  const roundKeys = Object.keys(rounds).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  roundKeys.forEach((rKey) => {
    rounds[rKey].forEach((m, i) => {
      let winner = null;
      if (m.p2 === "FREILOS" && m.p1 !== "?" && m.p1 !== "FREILOS") {
        m.s1 = "1";
        m.s2 = "0";
        winner = m.p1;
      } else if (m.p1 === "FREILOS" && m.p2 !== "?" && m.p2 !== "FREILOS") {
        m.s1 = "0";
        m.s2 = "1";
        winner = m.p2;
      }
      if (winner) {
        const nextR = "Runde_" + (parseInt(rKey.split("_")[1]) + 1);
        if (rounds[nextR]) {
          const nextIdx = Math.floor(i / 2);
          const slot = i % 2 === 0 ? "p1" : "p2";
          rounds[nextR][nextIdx][slot] = winner;
        }
      }
    });
  });
}

window.openEvent = (id) => {
  currentId = id;
  showView("view-event");

  // get statt onValue: Lädt die Daten nur einmal beim Öffnen!
  get(ref(db, "all_events/" + id)).then((snap) => {
    const ev = snap.val();
    if (!ev) return;
    document.getElementById("active-event-title").innerHTML =
      `<span>${ev.name}</span>`;

    if (ev.mode === "knockout") {
      document.getElementById("league-container").style.display = "none";
      document.getElementById("ko-container").style.display = "block";
      renderKO(ev.koRounds);
    } else {
      document.getElementById("league-container").style.display = "block";
      document.getElementById("ko-container").style.display = "none";
      renderLeague(ev); // Baut den Spielplan einmalig auf
    }
  });
};
function renderLeague(ev) {
  const activeIds = Array.from(
    document.querySelectorAll(".day-content.active"),
  ).map((el) => el.id);

  let stats = ev.players.map((p) => ({ name: p, sp: 0, diff: 0, pkt: 0 }));
  if (ev.days) {
    ev.days.forEach((day) => {
      day.matches.forEach((m) => {
        const s1 = parseInt(m.s1),
          s2 = parseInt(m.s2);
        if (!isNaN(s1) && !isNaN(s2)) {
          let p1 = stats.find((s) => s.name === m.p1),
            p2 = stats.find((s) => s.name === m.p2);
          if (p1 && p2) {
            p1.sp++;
            p2.sp++;
            p1.diff += s1 - s2;
            p2.diff += s2 - s1;
            if (s1 > s2) p1.pkt += 2;
            else if (s2 > s1) p2.pkt += 2;
            else {
              p1.pkt++;
              p2.pkt++;
            }
          }
        }
      });
    });
  }
  stats.sort((a, b) => b.pkt - a.pkt || b.diff - a.diff);

  let h = "";
  if (ev.days) {
    ev.days.forEach((day, dIdx) => {
      const currentContentId = `day-content-${dIdx}`;
      const isActive = activeIds.includes(currentContentId) ? "active" : "";
      const arrow = activeIds.includes(currentContentId) ? "▲" : "▼";

      // --- FORTSCHRITT BERECHNEN ---
      const totalMatches = day.matches.length;
      const completedMatches = day.matches.filter(
        (m) => m.s1 !== "" && m.s2 !== "",
      ).length;
      const percent =
        totalMatches > 0
          ? Math.round((completedMatches / totalMatches) * 100)
          : 0;

      h += `<div class="day-section">
              <div class="day-header" onclick="toggleDay(${dIdx})">
                <strong>${day.round}</strong>
                <div style="display:flex; align-items:center; gap:10px;">
                  <span style="font-size:0.7rem; color:var(--gold); opacity:0.8;">${percent}%</span>
                  <span id="arrow-${dIdx}">${arrow}</span>
                </div>
              </div>
              <div id="${currentContentId}" class="day-content ${isActive}">
                <div class="progress-container">
                  <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${percent}%"></div>
                  </div>
                  <div class="progress-info">${completedMatches} / ${totalMatches} Spiele fertig</div>
                </div>

                ${day.matches
                  .map(
                    (m, mIdx) => `
                  <div class="match-row">
                    <div>${m.p1}</div>
                    <div class="score-box">
                      <input type="number" value="${m.s1}" oninput="updateScore(${dIdx}, ${mIdx}, 's1', this.value)">
                      :
                      <input type="number" value="${m.s2}" oninput="updateScore(${dIdx}, ${mIdx}, 's2', this.value)">
                    </div>
                    <div>${m.p2}</div>
                  </div>`,
                  )
                  .join("")}
              </div>
            </div>`;
    });
  }

  document.getElementById("schedule-content").innerHTML = h;

  if (!ev.finals || !ev.finals.unlocked) {
    document.getElementById("schedule-content").innerHTML +=
      `<button class="primary" onclick="unlockLeagueFinals('${stats[0].name}','${stats[1].name}','${stats[2].name}','${stats[3].name}')">🏆 FINALTURNIER STARTEN</button>`;
    document.getElementById("final-area").innerHTML = "";
  } else {
    renderFinalMatches(ev.finals);
  }

  updateOnlyStatsAndRecords(ev);
}
window.modRec = (player, type, val) => {
  if (!player || !type || !currentId) return;

  const playerRecordRef = ref(
    db,
    `all_events/${currentId}/playerRecords/${player}`,
  );

  get(playerRecordRef)
    .then((snap) => {
      // Sicherstellen, dass wir ein Objekt haben, auch wenn der Spieler neu ist
      const data = snap.val() || { m180: 0, hf: 0, sl: 0 };

      // Wert berechnen
      let newVal = (parseInt(data[type]) || 0) + val;
      if (newVal < 0) newVal = 0;

      // Nur das eine Feld updaten
      update(playerRecordRef, { [type]: newVal }).then(() => {
        // Wichtig: Wir laden das Event neu, um die Tabelle zu refreshen
        get(ref(db, "all_events/" + currentId)).then((eventSnap) => {
          updateOnlyStatsAndRecords(eventSnap.val());
        });
      });
    })
    .catch((err) => console.error("Firebase Fehler:", err));
};
window.toggleDay = (idx) => {
  const el = document.getElementById(`day-content-${idx}`);
  if (!el) return;
  const isActive = el.classList.toggle("active");
  document.getElementById(`arrow-${idx}`).textContent = isActive ? "▲" : "▼";
};
window.updateScore = (dIdx, mIdx, side, val) => {
  update(ref(db, `all_events/${currentId}/days/${dIdx}/matches/${mIdx}`), {
    [side]: val,
  });

  get(ref(db, "all_events/" + currentId)).then((snap) => {
    const ev = snap.val();
    updateOnlyStatsAndRecords(ev);

    // Fortschritt berechnen
    const day = ev.days[dIdx];
    const total = day.matches.length;
    const done = day.matches.filter((m) => m.s1 !== "" && m.s2 !== "").length;
    const percent = Math.round((done / total) * 100);

    // 1. Balken und Info-Text (im ausklappbaren Bereich)
    const container = document.querySelector(
      `#day-content-${dIdx} .progress-bar-fill`,
    );
    const info = document.querySelector(`#day-content-${dIdx} .progress-info`);
    if (container) container.style.width = percent + "%";
    if (info) info.innerText = `${done} / ${total} Spiele fertig`;

    // 2. DIE %-ANZEIGE IM HEADER (Die kleine Zahl neben dem Pfeil)
    // Wir suchen den Header des aktuellen Spieltags
    const dayHeader = document.querySelector(
      `.day-header[onclick="toggleDay(${dIdx})"]`,
    );
    if (dayHeader) {
      // Wir suchen das span innerhalb der Flex-Box (das erste span ist die %-Anzeige)
      const percentLabel = dayHeader.querySelector("div span:first-child");
      if (percentLabel) {
        percentLabel.innerText = percent + "%";
      }
    }
  });
};
window.unlockLeagueFinals = (p1, p2, p3, p4) => {
  set(ref(db, `all_events/${currentId}/finals`), {
    unlocked: true,
    semi1: { p1, p2: p4, s1: "", s2: "" },
    semi2: { p1: p2, p2: p3, s1: "", s2: "" },
    final: { p1: "?", p2: "?", s1: "", s2: "" },
  }).then(() => {
    openEvent(currentId);
  });
};
function renderFinalMatches(f) {
  document.getElementById("final-area").innerHTML = `
    <div class="finals-container">
        <div class="finals-header">
            <span class="finals-title">🔥 DER FINALTAG</span>
        </div>

        <div class="finals-main-section">
            
            <div class="final-match-card">
                <div class="match-row">
                    <span class="player-name">${f.semi1.p1}</span>
                    <div class="score-box">
                        <input type="number" value="${f.semi1.s1}" oninput="updateF('semi1','s1',this.value)">
                        <span>:</span>
                        <input type="number" value="${f.semi1.s2}" oninput="updateF('semi1','s2',this.value)">
                    </div>
                    <span class="player-name right">${f.semi1.p2}</span>
                </div>
                <div class="match-info-label">HALBFINALE 1</div>
            </div>

            <div class="final-match-card">
                <div class="match-row">
                    <span class="player-name">${f.semi2.p1}</span>
                    <div class="score-box">
                        <input type="number" value="${f.semi2.s1}" oninput="updateF('semi2','s1',this.value)">
                        <span>:</span>
                        <input type="number" value="${f.semi2.s2}" oninput="updateF('semi2','s2',this.value)">
                    </div>
                    <span class="player-name right">${f.semi2.p2}</span>
                </div>
                <div class="match-info-label">HALBFINALE 2</div>
            </div>

            <div class="final-match-card gold-border">
                <div class="match-row">
                    <span class="player-name" style="font-size: 1.3rem; color: var(--gold);">${f.final.p1}</span>
                    <div class="score-box">
                        <input type="number" value="${f.final.s1}" oninput="updateF('final','s1',this.value)">
                        <span>:</span>
                        <input type="number" value="${f.final.s2}" oninput="updateF('final','s2',this.value)">
                    </div>
                    <span class="player-name right" style="font-size: 1.3rem; color: var(--gold);">${f.final.p2}</span>
                </div>
                <div class="match-info-label" style="font-size: 1rem;">🏆 FINALE 🏆</div>
            </div>

        </div>

        <div style="text-align: center; margin-top: 30px;">
            <button style="color:var(--danger); background:none; border:1px solid var(--danger); padding: 8px 15px; border-radius: 8px; cursor:pointer; font-size:0.8rem; opacity: 0.7;" 
                    onclick="resetFinals()">
                ❌ FINALTAG ABBRECHEN
            </button>
        </div>
    </div>`;
}
window.updateF = (m, s, v) => {
  // 1. Speichern in Firebase (Hintergrund-Update)
  update(ref(db, `all_events/${currentId}/finals/${m}`), { [s]: v }).then(
    () => {
      // 2. Aktuelle Final-Daten abrufen
      get(ref(db, `all_events/${currentId}/finals`)).then((snap) => {
        const f = snap.val();

        // PRÜFUNG: Wenn ein Score im Halbfinale gelöscht oder geleert wurde
        if (m.startsWith("semi")) {
          if (v === "" || f[m].s1 === "" || f[m].s2 === "") {
            const finalSlot = m === "semi1" ? "p1" : "p2";
            // Den entsprechenden Platz im Finale wieder auf "?" zurücksetzen
            update(ref(db, `all_events/${currentId}/finals/final`), {
              [finalSlot]: "?",
            }).then(() => {
              // Ansicht der Final-Box aktualisieren
              get(ref(db, `all_events/${currentId}/finals`)).then((s) =>
                renderFinalMatches(s.val()),
              );
            });
            return; // Abbrechen, da kein Sieger ermittelt werden kann
          }
        }

        // REGULÄRE LOGIK: Gewinner für das Finale ermitteln
        let w1 = "?",
          w2 = "?";
        if (f.semi1.s1 && f.semi1.s2) {
          w1 =
            parseInt(f.semi1.s1) > parseInt(f.semi1.s2)
              ? f.semi1.p1
              : f.semi1.p2;
        }
        if (f.semi2.s1 && f.semi2.s2) {
          w2 =
            parseInt(f.semi2.s1) > parseInt(f.semi2.s2)
              ? f.semi2.p1
              : f.semi2.p2;
        }

        // 3. Finale-Teilnehmer aktualisieren, wenn sie feststehen
        if (f.final.p1 !== w1 || f.final.p2 !== w2) {
          update(ref(db, `all_events/${currentId}/finals/final`), {
            p1: w1,
            p2: w2,
          }).then(() => {
            // Ansicht nach dem Update der Finalisten erneuern
            get(ref(db, `all_events/${currentId}/finals`)).then((s) =>
              renderFinalMatches(s.val()),
            );
          });
        } else {
          // Nur die geänderten Zahlen in der Ansicht spiegeln
          renderFinalMatches(f);
        }
      });
    },
  );
};
window.resetFinals = () => {
  if (confirm("Möchtest du den Finaltag wirklich abbrechen?")) {
    // Referenz zum Firebase-Pfad
    const finalRef = ref(db, `all_events/${currentId}/finals`);

    // Setzt unlocked auf false, damit der Spielplan wieder erscheint
    update(finalRef, { unlocked: false })
      .then(() => {
        console.log("Finaltag abgebrochen");
        openEvent(currentId); // Lädt die Ansicht neu
      })
      .catch((error) => {
        console.error("Fehler:", error);
        alert("Abbrechen fehlgeschlagen.");
      });
  }
};
function renderKO(rounds) {
  let h = `<h2 style="text-align:center; color:var(--gold);">🏆 TURNIER-BAUM</h2>`;
  Object.keys(rounds)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .forEach((r) => {
      h += `<div class="section-title" style="text-align:center; color:var(--gold); font-weight:bold; text-transform:uppercase;">${r.replace("_", " ")}</div>`;
      rounds[r].forEach((m, i) => {
        h += `<div class="match-row"><div>${m.p1}</div><div class="score-box"><input type="number" value="${m.s1}" oninput="updateKO('${r}', ${i}, 's1', this.value)">:<input type="number" value="${m.s2}" oninput="updateKO('${r}', ${i}, 's2', this.value)"></div><div>${m.p2}</div></div>`;
      });
    });
  document.getElementById("ko-container").innerHTML = h;
}
window.updateKO = (r, i, s, v) => {
  // 1. Ergebnis in Firebase speichern
  update(ref(db, `all_events/${currentId}/koRounds/${r}/${i}`), {
    [s]: v,
  }).then(() => {
    get(ref(db, `all_events/${currentId}/koRounds`)).then((snap) => {
      const allRounds = snap.val();
      const m = allRounds[r][i];

      const nextRKey = "Runde_" + (parseInt(r.split("_")[1]) + 1);
      const nextIdx = Math.floor(i / 2);
      const slot = i % 2 === 0 ? "p1" : "p2";

      // PRÜFUNG: Wenn ein Score gelöscht wurde (leer ist), setzen wir die nächste Runde zurück
      if (v === "" || m.s1 === "" || m.s2 === "") {
        if (allRounds[nextRKey]) {
          update(
            ref(db, `all_events/${currentId}/koRounds/${nextRKey}/${nextIdx}`),
            {
              [slot]: "?",
            },
          ).then(() => openEvent(currentId));
        } else {
          openEvent(currentId);
        }
        return; // Funktion hier abbrechen
      }

      // REGULÄRE LOGIK: Gewinner ermitteln, wenn beide Scores da sind
      if (m.s1 !== "" && m.s2 !== "" && m.p1 !== "?" && m.p2 !== "?") {
        const winner = parseInt(m.s1) > parseInt(m.s2) ? m.p1 : m.p2;

        if (allRounds[nextRKey]) {
          update(
            ref(db, `all_events/${currentId}/koRounds/${nextRKey}/${nextIdx}`),
            {
              [slot]: winner,
            },
          ).then(() => {
            triggerFreilosCheck(nextRKey, nextIdx);
            openEvent(currentId);
          });
        } else {
          openEvent(currentId);
        }
      } else {
        openEvent(currentId);
      }
    });
  });
};

function triggerFreilosCheck(rKey, i) {
  get(ref(db, `all_events/${currentId}/koRounds/${rKey}/${i}`)).then((snap) => {
    const m = snap.val();
    if (!m) return;
    let winner = null;
    if (m.p2 === "FREILOS" && m.p1 !== "?" && m.p1 !== "FREILOS") {
      winner = m.p1;
      update(ref(db, `all_events/${currentId}/koRounds/${rKey}/${i}`), {
        s1: "1",
        s2: "0",
      });
    } else if (m.p1 === "FREILOS" && m.p2 !== "?" && m.p2 !== "FREILOS") {
      winner = m.p2;
      update(ref(db, `all_events/${currentId}/koRounds/${rKey}/${i}`), {
        s1: "0",
        s2: "1",
      });
    }
    if (winner) {
      const nextRKey = "Runde_" + (parseInt(rKey.split("_")[1]) + 1);
      const nextIdx = Math.floor(i / 2);
      const slot = i % 2 === 0 ? "p1" : "p2";
      get(ref(db, `all_events/${currentId}/koRounds/${nextRKey}`)).then(
        (nextSnap) => {
          if (nextSnap.exists())
            update(
              ref(
                db,
                `all_events/${currentId}/koRounds/${nextRKey}/${nextIdx}`,
              ),
              { [slot]: winner },
            ).then(() => triggerFreilosCheck(nextRKey, nextIdx));
        },
      );
    }
  });
}
function updateOnlyStatsAndRecords(ev) {
  // 1. Stats berechnen (Bleibt gleich)
  let stats = ev.players.map((p) => ({ name: p, sp: 0, diff: 0, pkt: 0 }));
  if (ev.days) {
    ev.days.forEach((day) => {
      day.matches.forEach((m) => {
        const s1 = parseInt(m.s1),
          s2 = parseInt(m.s2);
        if (!isNaN(s1) && !isNaN(s2)) {
          let p1 = stats.find((s) => s.name === m.p1);
          let p2 = stats.find((s) => s.name === m.p2);
          if (p1 && p2) {
            p1.sp++;
            p2.sp++;
            p1.diff += s1 - s2;
            p2.diff += s2 - s1;
            if (s1 > s2) p1.pkt += 2;
            else if (s2 > s1) p2.pkt += 2;
            else {
              p1.pkt++;
              p2.pkt++;
            }
          }
        }
      });
    });
  }
  stats.sort((a, b) => b.pkt - a.pkt || b.diff - a.diff);

  // 2. Tabelle rendern
  document.getElementById("league-table-area").innerHTML =
    `<div class="table-wrapper"><table><thead><tr><th>#</th><th style="text-align:left">Spieler</th><th>SP.</th><th>+/-</th><th>PKT.</th></tr></thead><tbody>${stats.map((s, i) => `<tr><td class="rank-cell ${i < 4 ? "qualify" : ""}">${i + 1}</td><td style="text-align:left; font-weight:bold;">${s.name}</td><td>${s.sp}</td><td>${s.diff}</td><td><strong>${s.pkt}</strong></td></tr>`).join("")}</tbody></table></div>`;

  // 3. Bestleistungen (Records) rendern
  if (ev.mode === "league" || ev.mode === "groups") {
    let recHTML = "";
    const currentRecs = ev.playerRecords || {};

    ev.players.forEach((p) => {
      // SICHERHEITS-CHECK: Falls Werte fehlen, setze 0 (verhindert 'undefined' Layout-Fehler)
      const raw = currentRecs[p] || {};
      const r = {
        m180: raw.m180 || 0,
        hf: raw.hf || 0,
        sl: raw.sl || 0,
      };

      // WICHTIG: window.modRec nutzen und Anführungszeichen um ${p}
      recHTML += `
        <tr>
          <td style="text-align:left; font-weight:bold; font-size:0.8rem;">${p}</td>
          <td>
            <button class="rec-btn" onclick="window.modRec('${p}','m180',1)">180er</button>
            <span class="rec-num" onclick="window.modRec('${p}','m180',-1)">${r.m180}</span>
          </td>
          <td>
            <button class="rec-btn" onclick="window.modRec('${p}','hf',1)">HF</button>
            <span class="rec-num" onclick="window.modRec('${p}','hf',-1)">${r.hf}</span>
          </td>
          <td>
            <button class="rec-btn" onclick="window.modRec('${p}','sl',1)">SL</button>
            <span class="rec-num" onclick="window.modRec('${p}','sl',-1)">${r.sl}</span>
          </td>
        </tr>`;
    });

    const recordsBody = document.getElementById("records-body");
    if (recordsBody) {
      recordsBody.innerHTML = recHTML;
      // Sicherstellen, dass die Area sichtbar ist
      document.getElementById("records-area").style.display = "block";
    }
  }
}
