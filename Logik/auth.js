import { auth, db, googleProvider } from "./config.js"; // googleProvider importiert
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  ref,
  get,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// EXPORT: Damit counter.js und andere Dateien wissen, wer eingeloggt ist
export let currentUser = null;
export let currentId = null;

window.toggleAuthMode = (isRegistering) => {
  document.getElementById("username-wrapper").style.display = isRegistering
    ? "block"
    : "none";
  document.getElementById("login-actions").style.display = isRegistering
    ? "none"
    : "block";
  document.getElementById("register-actions").style.display = isRegistering
    ? "block"
    : "none";
  document.getElementById("auth-title").innerText = isRegistering
    ? "Neuen Account erstellen"
    : "Bei FLIGHTCLUB anmelden";
  document.getElementById("auth-error").innerText = "";
  const forgotPw = document.getElementById("forgot-pw-wrapper");
  if (forgotPw) {
    forgotPw.style.display = isRegistering ? "none" : "flex";
  }
};

window.handleAuth = (mode) => {
  const email = document.getElementById("auth-email").value;
  const pass = document.getElementById("auth-pass").value;
  const username = document.getElementById("auth-username").value;
  const errEl = document.getElementById("auth-error");

  if (mode === "register") {
    if (!username) return alert("Benutzername erforderlich!");
    createUserWithEmailAndPassword(auth, email, pass)
      .then((cred) =>
        updateProfile(cred.user, { displayName: username }).then(() =>
          location.reload(),
        ),
      )
      .catch((e) => (errEl.innerText = e.message));
  } else {
    signInWithEmailAndPassword(auth, email, pass).catch(
      (e) => (errEl.innerText = "Login fehlgeschlagen."),
    );
  }
};

window.handleGoogleLogin = () => {
  signInWithPopup(auth, googleProvider)
    .then((result) => {
      const user = result.user;
      get(ref(db, `users/${user.uid}/photo`)).then((snap) => {
        if (!snap.exists() && user.photoURL) {
          set(ref(db, `users/${user.uid}/photo`), user.photoURL);
        }
      });
    })
    .catch((error) => {
      console.error("Google Error:", error.code, error.message);
      document.getElementById("auth-error").innerText =
        "Login fehlgeschlagen oder abgebrochen.";
    });
};

window.forgotPassword = () => {
  const email = document.getElementById("auth-email").value;
  if (!email) return alert("Bitte E-Mail Adresse eingeben.");
  sendPasswordResetEmail(auth, email)
    .then(() =>
      alert("Reset-Link wurde an deine E-Mail gesendet! (Spam-Ordner prüfen)"),
    )
    .catch((e) => alert("Fehler: " + e.message));
};

window.handleLogout = () => {
  if (
    confirm("Möchtest du dich wirklich abmelden und den FlightClub verlassen?")
  ) {
    signOut(auth)
      .then(() => {
        location.reload();
      })
      .catch((error) => {
        console.error("Fehler beim Abmelden:", error);
      });
  }
};

onAuthStateChanged(auth, (user) => {
  const loader = document.getElementById("app-loader");

  if (user) {
    currentUser = user;

    // EventManager Namensanzeige
    const eventUserDisplay = document.getElementById("stat-active-user");
    if (eventUserDisplay) {
      // Nutze den Displaynamen aus Firebase oder den User-Teil der E-Mail als Fallback
      eventUserDisplay.textContent =
        user.displayName || user.email.split("@")[0].toUpperCase();
    }

    //  Name aus Profil oder DB laden
    const dashNameEl = document.getElementById("dash-username");
    if (dashNameEl) dashNameEl.innerText = user.displayName || "User";

    // Echtzeit-Update für den Namen aus der DB (falls geändert)
    onValue(ref(db, `users/${user.uid}/username`), (snap) => {
      if (snap.exists() && dashNameEl) dashNameEl.innerText = snap.val();
    });

    //  Foto laden (Header & Dashboard)
    get(ref(db, `users/${user.uid}/photo`)).then((snap) => {
      const photoData = snap.val();
      const displayImg = photoData
        ? photoData
        : user.photoURL
          ? user.photoURL
          : "https://via.placeholder.com/100";

      if (document.getElementById("profile-img-preview"))
        document.getElementById("profile-img-preview").src = displayImg;
      if (document.getElementById("header-profile-img"))
        document.getElementById("header-profile-img").src = displayImg;
      if (document.getElementById("dash-img"))
        document.getElementById("dash-img").src = displayImg;
    });

    if (window.showView) window.showView("view-dashboard");
    if (window.initDashboard) window.initDashboard();
  } else {
    currentUser = null;
    if (window.showView) window.showView("view-login");
  }

  // Loader-Logik bleibt gleich
  if (loader) {
    setTimeout(() => {
      loader.classList.add("loader-hidden");
      setTimeout(() => {
        loader.style.display = "none";
      }, 500);
    }, 2000);
  }
});

// Profil-Funktionen
window.handleImageUpload = (input) => {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById("upload-status");
  statusEl.innerText = "Verarbeite Bild...";
  statusEl.style.color = "var(--gold)";
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 150;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(size / img.width, size / img.height);
      const x = (size - img.width * scale) / 2;
      const y = (size - img.height * scale) / 2;
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
      set(ref(db, `users/${auth.currentUser.uid}/photo`), compressedBase64)
        .then(() => {
          document.getElementById("profile-img-preview").src = compressedBase64;
          document.getElementById("header-profile-img").src = compressedBase64;
          statusEl.innerText = "Profilbild gespeichert!";
          statusEl.style.color = "var(--qualify-green)";
        })
        .catch((err) => {
          statusEl.innerText = "Fehler beim Speichern!";
          console.error(err);
        });
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.updateUserEmail = () => {
  const newEmail = document.getElementById("profile-email").value;
  const msg = document.getElementById("profile-msg");
  updateEmail(auth.currentUser, newEmail)
    .then(() => {
      msg.innerText = "E-Mail erfolgreich geändert!";
      msg.style.color = "var(--qualify-green)";
    })
    .catch((e) => {
      msg.innerText = "Fehler: Erfordert evtl. neuen Login.";
      msg.style.color = "var(--danger)";
    });
};

window.updateUserPassword = () => {
  const newPass = document.getElementById("profile-pass").value;
  const msg = document.getElementById("profile-msg");
  if (newPass.length < 6) return alert("Passwort zu kurz!");
  updatePassword(auth.currentUser, newPass)
    .then(() => {
      msg.innerText = "Passwort erfolgreich geändert!";
      msg.style.color = "var(--qualify-green)";
    })
    .catch((e) => {
      msg.innerText = "Fehler: Erfordert evtl. neuen Login.";
      msg.style.color = "var(--danger)";
    });
};
