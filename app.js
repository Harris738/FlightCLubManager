    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
    import { getDatabase, ref, push, onValue, update, remove, set, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
    import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail, updateEmail, updatePassword, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

    const firebaseConfig = {
        apiKey: "AIzaSyBz_CsnVtihY_wuAgzxRHK4Y8D57DQAd2M",
        authDomain: "flightclub-pro-db.firebaseapp.com",
        databaseURL: "https://flightclub-pro-db-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "flightclub-pro-db",
        storageBucket: "flightclub-pro-db.firebasestorage.app",
        messagingSenderId: "342700744940",
        appId: "1:342700744940:web:9b6e41852a12ebd03185c9"
    };

    const app = initializeApp(firebaseConfig);
    const db = getDatabase(app);
    const auth = getAuth(app);
    const googleProvider = new GoogleAuthProvider();
    
    let currentId = null;
    let currentUser = null;
    const PW = "5869";

    // --- AUTH LOGIK ---
    window.toggleAuthMode = (isRegistering) => {
        document.getElementById('username-wrapper').style.display = isRegistering ? 'block' : 'none';
        document.getElementById('login-actions').style.display = isRegistering ? 'none' : 'block';
        document.getElementById('register-actions').style.display = isRegistering ? 'block' : 'none';
        document.getElementById('auth-title').innerText = isRegistering ? "Neuen Account erstellen" : "Anmelden";
        document.getElementById('auth-error').innerText = "";
    };

    window.handleAuth = (mode) => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-pass').value;
        const username = document.getElementById('auth-username').value;
        const errEl = document.getElementById('auth-error');

        if(mode === 'register') {
            if(!username) return alert("Benutzername erforderlich!");
            createUserWithEmailAndPassword(auth, email, pass)
                .then((cred) => updateProfile(cred.user, { displayName: username }).then(() => location.reload()))
                .catch(e => errEl.innerText = e.message);
        } else {
            signInWithEmailAndPassword(auth, email, pass).catch(e => errEl.innerText = "Login fehlgeschlagen.");
        }
    };

    window.handleGoogleLogin = () => {
        signInWithPopup(auth, googleProvider)
            .then((result) => {
                const user = result.user;
                // Falls der User neu ist oder kein Foto in der DB hat, Google Foto übernehmen
                get(ref(db, `users/${user.uid}/photo`)).then(snap => {
                    if(!snap.exists() && user.photoURL) {
                        set(ref(db, `users/${user.uid}/photo`), user.photoURL);
                    }
                });
            })
            .catch((error) => {
    console.error("Google Error:", error.code, error.message); // Hilft dir beim Fehlersuchen
    document.getElementById('auth-error').innerText = "Login fehlgeschlagen oder abgebrochen.";
});

    };

    window.forgotPassword = () => {
        const email = document.getElementById('auth-email').value;
        if(!email) return alert("Bitte E-Mail Adresse eingeben.");
        sendPasswordResetEmail(auth, email)
            .then(() => alert("Reset-Link wurde an deine E-Mail gesendet! (Spam-Ordner prüfen)"))
            .catch(e => alert("Fehler: " + e.message));
    };

    window.handleLogout = () => {
        signOut(auth).then(() => {
            location.reload();
        });
    };

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('stat-active-user').innerText = user.displayName || "User";
            document.getElementById('profile-email').value = user.email;
            
            get(ref(db, `users/${user.uid}/photo`)).then(snap => {
                const photoData = snap.val();
                const displayImg = photoData ? photoData : (user.photoURL ? user.photoURL : "https://via.placeholder.com/100");
                document.getElementById('profile-img-preview').src = displayImg;
                document.getElementById('dash-img').src = displayImg;
            });
            
            showView('view-dashboard');
            initDashboard();
        } else {
            currentUser = null;
            showView('view-login');
        }
    });

    window.handleImageUpload = (input) => {
        const file = input.files[0];
        if (!file) return;
        const statusEl = document.getElementById('upload-status');
        statusEl.innerText = "Verarbeite Bild...";
        statusEl.style.color = "var(--gold)";
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 150; 
                canvas.width = size; canvas.height = size;
                const ctx = canvas.getContext('2d');
                const scale = Math.max(size / img.width, size / img.height);
                const x = (size - img.width * scale) / 2;
                const y = (size - img.height * scale) / 2;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                set(ref(db, `users/${auth.currentUser.uid}/photo`), compressedBase64)
                .then(() => {
                    document.getElementById('profile-img-preview').src = compressedBase64;
                    document.getElementById('dash-img').src = compressedBase64;
                    statusEl.innerText = "Profilbild gespeichert!";
                    statusEl.style.color = "var(--qualify-green)";
                })
                .catch(err => {
                    statusEl.innerText = "Fehler beim Speichern!";
                    console.error(err);
                });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };

    window.updateUserEmail = () => {
        const newEmail = document.getElementById('profile-email').value;
        const msg = document.getElementById('profile-msg');
        updateEmail(auth.currentUser, newEmail)
            .then(() => { msg.innerText = "E-Mail erfolgreich geändert!"; msg.style.color = "var(--qualify-green)"; })
            .catch(e => { msg.innerText = "Fehler: Erfordert evtl. neuen Login."; msg.style.color = "var(--danger)"; });
    };

    window.updateUserPassword = () => {
        const newPass = document.getElementById('profile-pass').value;
        const msg = document.getElementById('profile-msg');
        if(newPass.length < 6) return alert("Passwort zu kurz!");
        updatePassword(auth.currentUser, newPass)
            .then(() => { msg.innerText = "Passwort erfolgreich geändert!"; msg.style.color = "var(--qualify-green)"; })
            .catch(e => { msg.innerText = "Fehler: Erfordert evtl. neuen Login."; msg.style.color = "var(--danger)"; });
    };

    function initDashboard() {
        onValue(ref(db, 'all_events'), (snap) => {
            const list = document.getElementById('tournament-list'); 
            const statTotal = document.getElementById('stat-total-events');
            list.innerHTML = "";
            const data = snap.val(); 
            if(!data) { statTotal.innerText = "0"; return; }
            const myKeys = Object.keys(data).filter(id => data[id].uid === currentUser.uid);
            statTotal.innerText = myKeys.length;
            myKeys.sort((a,b) => data[b].createdAt - data[a].createdAt).forEach(id => {
                const item = document.createElement('div'); item.className = 'tournament-item';
                item.innerHTML = `<div onclick="openEvent('${id}')" style="cursor:pointer; flex:1;">
                    <div style="font-weight:bold; font-size:1rem; color:#fff;">${data[id].name}</div>
                    <div style="font-size:0.65rem; color:var(--gold); margin-top:4px;">${data[id].mode.toUpperCase()} • ${data[id].players.length} SPIELER</div>
                </div>
                <button class="btn-delete" onclick="deleteEvent('${id}')">LÖSCHEN</button>`;
                list.appendChild(item);
            });
        });
    }

    window.generateEvent = () => {
        const name = document.getElementById('event-name').value;
        const mode = document.getElementById('event-mode').value;
        const players = document.getElementById('event-players').value.split(',').map(s => s.trim()).filter(s => s !== "");
        if(!name || players.length < 2) return alert("Daten unvollständig!");
        let eventData = { name, mode, players, uid: currentUser.uid, createdAt: Date.now(), finals: {unlocked: false} };
        if(mode === 'knockout') {
            eventData.koRounds = createKOBracket(players);
            eventData.finals.unlocked = true;
            checkAllFreilosLocally(eventData.koRounds);
        } else {
            const pairs = [];
            for(let i=0; i<players.length; i++) for(let j=i+1; j<players.length; j++) pairs.push({p1:players[i], p2:players[j], s1:"", s2:""});
            const multiplier = (mode === 'groups' && document.getElementById('group-rounds').value === "2") ? 2 : 1;
            let finalPairs = [...pairs];
            if(multiplier === 2) pairs.forEach(p => finalPairs.push({p1:p.p2, p2:p.p1, s1:"", s2:""}));
            const count = (mode === 'league') ? 12 : 1;
            eventData.days = [];
            for(let d=1; d<=count; d++) {
                eventData.days.push({ round: (mode==='league'?'Spieltag '+d:'Gruppenphase'), matches: JSON.parse(JSON.stringify(finalPairs.sort(() => Math.random() - 0.5))), locked: false });
            }
        }
        push(ref(db, 'all_events'), eventData).then(() => showView('view-dashboard'));
    };

    window.toggleGroupOptions = () => {
        const mode = document.getElementById('event-mode').value;
        document.getElementById('group-options').style.display = (mode === 'groups') ? 'block' : 'none';
    };

    window.showView = (id) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        if(id !== 'view-profile') {
            document.getElementById('profile-msg').innerText = "";
            document.getElementById('upload-status').innerText = "Bild zum Ändern antippen";
            document.getElementById('upload-status').style.color = "var(--gold)";
        }
    };

    window.deleteEvent = (id) => { if(confirm("Event wirklich löschen?")) remove(ref(db, 'all_events/' + id)); };

    function createKOBracket(players) {
        let shuffled = [...players].sort(() => Math.random() - 0.5);
        let size = Math.pow(2, Math.ceil(Math.log2(shuffled.length)));
        let slots = Array(size).fill("FREILOS");
        for(let i=0; i<shuffled.length; i++) slots[i] = shuffled[i];
        let firstRound = [];
        for(let i=0; i < size/2; i++) firstRound.push({p1: slots[i], p2: slots[size - 1 - i], s1: "", s2: ""});
        let rounds = { "Runde_1": firstRound };
        let rCount = 2;
        for(let s = firstRound.length/2; s >= 1; s /= 2) {
            let nextR = [];
            for(let i=0; i<s; i++) nextR.push({p1: "?", p2: "?", s1: "", s2: ""});
            rounds["Runde_" + rCount] = nextR;
            rCount++;
        }
        return rounds;
    }

    function checkAllFreilosLocally(rounds) {
        const roundKeys = Object.keys(rounds).sort((a,b) => a.localeCompare(b, undefined, {numeric: true}));
        roundKeys.forEach((rKey) => {
            rounds[rKey].forEach((m, i) => {
                let winner = null;
                if (m.p2 === "FREILOS" && m.p1 !== "?" && m.p1 !== "FREILOS") { m.s1 = "1"; m.s2 = "0"; winner = m.p1; }
                else if (m.p1 === "FREILOS" && m.p2 !== "?" && m.p2 !== "FREILOS") { m.s1 = "0"; m.s2 = "1"; winner = m.p2; }
                if(winner) {
                    const nextR = "Runde_" + (parseInt(rKey.split('_')[1]) + 1);
                    if(rounds[nextR]) {
                        const nextIdx = Math.floor(i / 2);
                        const slot = (i % 2 === 0) ? 'p1' : 'p2';
                        rounds[nextR][nextIdx][slot] = winner;
                    }
                }
            });
        });
    }

    window.openEvent = (id) => {
        currentId = id; showView('view-event');
        onValue(ref(db, 'all_events/' + id), (snap) => {
            const ev = snap.val(); if(!ev) return;
            document.getElementById('active-event-title').innerHTML = `<span>${ev.name}</span>`;
            if(ev.mode === 'knockout') {
                document.getElementById('league-container').style.display = 'none';
                document.getElementById('ko-container').style.display = 'block';
                renderKO(ev.koRounds);
            } else {
                document.getElementById('league-container').style.display = 'block';
                document.getElementById('ko-container').style.display = 'none';
                renderLeague(ev);
            }
        });
    };

    function renderLeague(ev) {
        let stats = ev.players.map(p => ({ name: p, sp: 0, diff: 0, pkt: 0 }));
        if(ev.days) {
            ev.days.forEach(day => {
                day.matches.forEach(m => {
                    const s1 = parseInt(m.s1), s2 = parseInt(m.s2);
                    if(!isNaN(s1) && !isNaN(s2)) {
                        let p1 = stats.find(s => s.name === m.p1), p2 = stats.find(s => s.name === m.p2);
                        p1.sp++; p2.sp++; p1.diff += (s1-s2); p2.diff += (s2-s1);
                        if(s1>s2) p1.pkt+=2; else if(s2>s1) p2.pkt+=2; else {p1.pkt++; p2.pkt++;}
                    }
                });
            });
        }
        stats.sort((a,b) => b.pkt - a.pkt || b.diff - a.diff);
        document.getElementById('league-table-area').innerHTML = `<div class="table-wrapper"><table><thead><tr><th>#</th><th style="text-align:left">Spieler</th><th>SP.</th><th>+/-</th><th>PKT.</th></tr></thead><tbody>${stats.map((s,i) => `<tr><td class="rank-cell ${i<4?'qualify':''}">${i+1}</td><td style="text-align:left; font-weight:bold;">${s.name}</td><td>${s.sp}</td><td>${s.diff}</td><td><strong>${s.pkt}</strong></td></tr>`).join('')}</tbody></table></div>`;
        
        if(ev.mode === 'league') {
            document.getElementById('records-area').style.display = 'block';
            let recHTML = "";
            const currentRecs = ev.playerRecords || {};
            ev.players.forEach(p => {
                const r = currentRecs[p] || { m180: 0, hf: 0, sl: 0 };
                recHTML += `<tr><td style="text-align:left; font-weight:bold; font-size:0.8rem;">${p}</td><td><button class="rec-btn" onclick="modRec('${p}','m180',1)">180er</button><span class="rec-num" onclick="modRec('${p}','m180',-1)">${r.m180}</span></td><td><button class="rec-btn" onclick="modRec('${p}','hf',1)">HF</button><span class="rec-num" onclick="modRec('${p}','hf',-1)">${r.hf}</span></td><td><button class="rec-btn" onclick="modRec('${p}','sl',1)">SL</button><span class="rec-num" onclick="modRec('${p}','sl',-1)">${r.sl}</span></td></tr>`;
            });
            document.getElementById('records-body').innerHTML = recHTML;
        }
        let h = "";
        if(ev.days) {
            ev.days.forEach((day, dIdx) => {
                h += `<div class="day-section"><div class="day-header" onclick="toggleDay(${dIdx})"><strong>${day.round}</strong><div><span id="arrow-${dIdx}">▼</span><span class="lock-icon" onclick="handleLock(event, ${dIdx}, ${day.locked})">${day.locked ? '🔒' : '🔓'}</span></div></div><div id="day-content-${dIdx}" class="day-content">${day.matches.map((m, mIdx) => `<div class="match-row"><div>${m.p1}</div><div class="score-box"><input type="number" value="${m.s1}" ${day.locked?'disabled':''} onchange="updateScore(${dIdx}, ${mIdx}, 's1', this.value)">:<input type="number" value="${m.s2}" ${day.locked?'disabled':''} onchange="updateScore(${dIdx}, ${mIdx}, 's2', this.value)"></div><div>${m.p2}</div></div>`).join('')}</div></div>`;
            });
        }
        document.getElementById('schedule-content').innerHTML = h;
        if(!ev.finals || !ev.finals.unlocked) {
            document.getElementById('schedule-content').innerHTML += `<button class="primary" onclick="unlockLeagueFinals('${stats[0].name}','${stats[1].name}','${stats[2].name}','${stats[3].name}')">🏆 FINALTURNIER STARTEN</button>`;
        } else { renderFinalMatches(ev.finals); }
    }

    window.modRec = (player, type, val) => {
        get(ref(db, `all_events/${currentId}/playerRecords/${player}/${type}`)).then(snap => {
            let newVal = (snap.val() || 0) + val;
            update(ref(db, `all_events/${currentId}/playerRecords/${player}`), { [type]: newVal < 0 ? 0 : newVal });
        });
    };

    window.handleLock = (e, dIdx, isLocked) => { e.stopPropagation(); if(!isLocked) update(ref(db, `all_events/${currentId}/days/${dIdx}`), { locked: true }); else if(prompt("PIN:") === PW) update(ref(db, `all_events/${currentId}/days/${dIdx}`), { locked: false }); };
    window.toggleDay = (idx) => { 
        const el = document.getElementById(`day-content-${idx}`); 
        if(!el) return;
        const isActive = el.classList.toggle('active'); 
        document.getElementById(`arrow-${idx}`).textContent = isActive ? '▲' : '▼'; 
    };
    window.updateScore = (dIdx, mIdx, side, val) => update(ref(db, `all_events/${currentId}/days/${dIdx}/matches/${mIdx}`), { [side]: val });

    window.unlockLeagueFinals = (p1, p2, p3, p4) => {
        set(ref(db, `all_events/${currentId}/finals`), { unlocked: true, semi1: {p1, p2:p4, s1:"", s2:""}, semi2: {p1:p2, p2:p3, s1:"", s2:""}, final: {p1:"?", p2:"?", s1:"", s2:""} });
    };

    function renderFinalMatches(f) {
        document.getElementById('final-area').innerHTML = `
        <div style="margin-top:40px; padding:25px; border:2px solid var(--gold); border-radius:20px; background:rgba(0,0,0,0.5);">
            <h2 style="text-align:center; color:var(--gold);">🏆 FINALTAG</h2>
            <div class="final-match"><div>${f.semi1.p1}</div><div class="score-box"><input type="number" value="${f.semi1.s1}" onchange="updateF('semi1','s1',this.value)">:<input type="number" value="${f.semi1.s2}" onchange="updateF('semi1','s2',this.value)"></div><div>${f.semi1.p2}</div></div>
            <div class="final-match"><div>${f.semi2.p1}</div><div class="score-box"><input type="number" value="${f.semi2.s1}" onchange="updateF('semi2','s1',this.value)">:<input type="number" value="${f.semi2.s2}" onchange="updateF('semi2','s2',this.value)"></div><div>${f.semi2.p2}</div></div>
            <div class="final-match" style="background:rgba(212,175,55,0.1); padding:20px; border-radius:12px;"><div style="font-weight:bold;">${f.final.p1}</div><div class="score-box"><input type="number" value="${f.final.s1}" onchange="updateF('final','s1',this.value)">:<input type="number" value="${f.final.s2}" onchange="updateF('final','s2',this.value)"></div><div style="font-weight:bold;">${f.final.p2}</div></div>
            <button style="margin-top:20px; color:var(--danger); background:none; border:none; cursor:pointer; width:100%; font-size:0.75rem;" onclick="resetFinals()">❌ FINALTAG ABBRECHEN</button>
        </div>`;
    }

    window.resetFinals = () => { if(confirm("Abbrechen?")) update(ref(db, `all_events/${currentId}/finals`), { unlocked: false }); };
    window.updateF = (m, s, v) => {
        update(ref(db, `all_events/${currentId}/finals/${m}`), { [s]: v }).then(() => {
            get(ref(db, `all_events/${currentId}/finals`)).then(snap => {
                const f = snap.val(); let w1 = "?", w2 = "?";
                if(f.semi1.s1 && f.semi1.s2) w1 = parseInt(f.semi1.s1) > parseInt(f.semi1.s2) ? f.semi1.p1 : f.semi1.p2;
                if(f.semi2.s1 && f.semi2.s2) w2 = parseInt(f.semi2.s1) > parseInt(f.semi2.s2) ? f.semi2.p1 : f.semi2.p2;
                if(f.final.p1 !== w1 || f.final.p2 !== w2) update(ref(db, `all_events/${currentId}/finals/final`), { p1: w1, p2: w2 });
            });
        });
    };

    function renderKO(rounds) {
        let h = `<h2 style="text-align:center; color:var(--gold);">🏆 TURNIER-BAUM</h2>`;
        Object.keys(rounds).sort((a,b) => a.localeCompare(b, undefined, {numeric: true})).forEach(r => {
            h += `<div class="section-title" style="text-align:center;">${r.replace('_',' ')}</div>`;
            rounds[r].forEach((m, i) => {
                h += `<div class="match-row"><div>${m.p1}</div><div class="score-box"><input type="number" value="${m.s1}" onchange="updateKO('${r}', ${i}, 's1', this.value)">:<input type="number" value="${m.s2}" onchange="updateKO('${r}', ${i}, 's2', this.value)"></div><div>${m.p2}</div></div>`;
            });
        });
        document.getElementById('ko-container').innerHTML = h;
    }

    window.updateKO = (r, i, s, v) => {
        update(ref(db, `all_events/${currentId}/koRounds/${r}/${i}`), { [s]: v }).then(() => {
            get(ref(db, `all_events/${currentId}/koRounds`)).then((snap) => {
                const allRounds = snap.val(); const m = allRounds[r][i];
                if(m.s1 !== "" && m.s2 !== "" && m.p1 !== "?" && m.p2 !== "?") {
                    const winner = parseInt(m.s1) > parseInt(m.s2) ? m.p1 : m.p2;
                    const nextRKey = "Runde_" + (parseInt(r.split('_')[1]) + 1);
                    const nextIdx = Math.floor(i / 2); const slot = (i % 2 === 0) ? 'p1' : 'p2';
                    if(allRounds[nextRKey]) update(ref(db, `all_events/${currentId}/koRounds/${nextRKey}/${nextIdx}`), { [slot]: winner }).then(() => triggerFreilosCheck(nextRKey, nextIdx));
                }
            });
        });
    };

    function triggerFreilosCheck(rKey, i) {
        get(ref(db, `all_events/${currentId}/koRounds/${rKey}/${i}`)).then(snap => {
            const m = snap.val(); if(!m) return;
            let winner = null;
            if(m.p2 === "FREILOS" && m.p1 !== "?" && m.p1 !== "FREILOS") { winner = m.p1; update(ref(db, `all_events/${currentId}/koRounds/${rKey}/${i}`), {s1: "1", s2: "0"}); }
            else if(m.p1 === "FREILOS" && m.p2 !== "?" && m.p2 !== "FREILOS") { winner = m.p2; update(ref(db, `all_events/${currentId}/koRounds/${rKey}/${i}`), {s1: "0", s2: "1"}); }
            if(winner) {
                const nextRKey = "Runde_" + (parseInt(rKey.split('_')[1]) + 1);
                const nextIdx = Math.floor(i / 2); const slot = (i % 2 === 0) ? 'p1' : 'p2';
                get(ref(db, `all_events/${currentId}/koRounds/${nextRKey}`)).then(nextSnap => {
                    if(nextSnap.exists()) update(ref(db, `all_events/${currentId}/koRounds/${nextRKey}/${nextIdx}`), { [slot]: winner }).then(() => triggerFreilosCheck(nextRKey, nextIdx));
                });
            }
        });
    }