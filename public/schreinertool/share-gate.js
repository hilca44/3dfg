// === SHARE GATE SYSTEM ===

window.openShareGate = function (data) {

    // Modal erstellen
    let overlay = document.createElement("div");
    overlay.id = "shareGateOverlay";

    overlay.innerHTML = `
    <div class="shareGateBox">
        <h2>Projekt teilen?</h2>
        <p>
            Möchtest du dein Projekt anonym mit der Community teilen?

        </p>

        <h2>Ja</h2>
         <p>
                Dein Projekt wird anonym in der Galerie veröffentlicht.
                Danach wird ein Free-Dokument mit gekürzter Holzliste heruntergeladen.
         </p>
            <h2>Nein</h2>
       <p>
            Deine Projekte bleiben privat. Pro kostet 12€/Jahr. Sende dafür 12€/Jahr über Paypal an
            carsten.hilbert@gmail.com.
              </p>
         

        <div class="shareGateButtons">
            <button id="shareYes">Ja, teilen und Download</button>
                <button id="shareNo">Nein, privat halten (12€/Jahr)</button>
           
           
            <button id="shareCancel" onclick="closeGate()">Abbrechen</button>
        </div>
    </div>
`;
    document.body.appendChild(overlay);

    // Styles (inline, damit du keine CSS-Datei brauchst)
    const style = document.createElement("style");
    style.innerHTML = `
        #shareGateOverlay {
            position: fixed;
            top:0; left:0; right:0; bottom:0;
            background: rgba(0,0,0,0.6);
            display:flex;
            align-items:center;
            justify-content:center;
            z-index:99999;
        }
            #shareCancel {
    background:#777;
    color:#fff;
}
        .shareGateBox {
            background:#fff;
            padding:20px;
            border-radius:12px;
            max-width:400px;
            text-align:center;
            font-family:sans-serif;
        }

        .shareGateBox h2 {
            margin-top:20px;
        }           
        .shareGateButtons {
            margin-top:20px;
            display:flex;
            gap:10px;
            flex-direction:column;
        }
        .shareGateButtons button {
            padding:12px;
            border:none;
            border-radius:8px;
            cursor:pointer;
            font-size:14px;
        }
        #shareYes {
            background:#27ae60;
            color:#fff;
        }
        #shareNo {
            background:#e67e22;
            color:#fff;
        }
    `;
    document.head.appendChild(style);

    // === EVENTS ===
document.getElementById("shareYes").onclick = async () => {

    await downloadHolzliste({ free: true });   // 🔥 wichtig
    closeGate();
        


};

    document.getElementById("shareNo").onclick = async () => {
        await sendPrivate(data);
        closeGate();
    };

};

function closeGate() {
    const overlay = document.getElementById("shareGateOverlay");
    if (overlay) overlay.remove();
}   
// === API CALLS ===

async function sendPublic(data) {
    const inn = data?.inn || data?.project || document.getElementById("inn")?.value || "";
    await fetch("/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...data,
            inn,
            shared: true
        })
    });
}

async function sendPrivate(data) {
    const inn = data?.inn || data?.project || document.getElementById("inn")?.value || "";
    const res = await fetch("/private-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...data,
            inn,
            shared: false
        })
    });

    if (res.status === 401) {
        alert("Bitte logge dich ein, um in deiner persönlichen Galerie zu speichern.");
        window.location.href = "/login";
        return;
    }

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Privates Speichern fehlgeschlagen.");
        return;
    }

    alert("Privater Modus aktiviert. \
        Bitte überweise 12€/Jahr \
        an carsten.hilbert@gmail.com. \
        Das Einrichten deines Accounts\
        kann nach der Zahlung 2 bis 3 Werktage dauern.\
        Speichere bis dahin die URL deines Projekts, \
        um es später zu laden."    );
}
