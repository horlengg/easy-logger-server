const SOCKET_URL = window.__SERVER_URI__;
// const SOCKET_URL = 'http://10.105.141.142:3000';
let renderedCount = 0;  // track how many logs are already in the DOM
let currentFilter = { type: 0, query: "" };

let logs = [];
let activeFilter = 0;

const logSizeLimitTextField = document.getElementById('logSize');

// ── Socket ────────────────────────────────────────
const socket = io(SOCKET_URL, { transports: ["websocket"] });

socket.on("connect", () => {
    document.getElementById("dot").classList.add("connected");
    document.getElementById("status-label").textContent =
        "connected · " + socket.id.slice(0, 8);
});
socket.on("disconnect", () => {
    document.getElementById("dot").classList.remove("connected");
    document.getElementById("status-label").textContent = "disconnected";
});
socket.on("remove-log", (msgId) => {
    document.querySelector(`[data-log-id="${msgId}"]`)?.remove();
    logs.shift()
    // render();
    scrollBottom();
});
socket.on("clear-all-logs", () => {
    logs = [];
    render();
});
socket.on("log-size-limit-changed", (logSizeLimit) => {
    logSizeLimitTextField.value = logSizeLimit
});
socket.on("new-log", (data) => {
    logs.push(data);
    updateCounts();
    const q = currentFilter.query;
    const typeMatch = currentFilter.type === 0 || data.type === currentFilter.type;
    const searchMatch = !q || String(data.message).toLowerCase().includes(q) || String(data.tag).toLowerCase().includes(q);

    if (typeMatch && searchMatch) {
        appendRow(data, q);
    }
    scrollBottom();
});

socket.on("initial-logs", (data) => {
    logs = data.logs;
    setConnectionSource(data.uri);
    render();
    scrollBottom();
    logSizeLimitTextField.value = data.logSizeLimit
});

function setFilter(n) {
    activeFilter = n;
    document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.toggle("active", +b.dataset.type === n));
    render();
}

function setConnectionSource(uri) {
    const el = document.getElementById("btn_copy_connection");
    el.setAttribute("data-uri", uri);
    el.textContent = "Copy";
}

function appendRow(log, q = "") {
    const container = document.getElementById("log-container");

    // First row — inject header + remove empty state if present
    // if (container.querySelector(".empty-state") || container.children.length === 0) {
    //     container.innerHTML = `
    //         <div class="col-header">
    //           <span>TIME</span><span>TYPE</span><span>MESSAGE</span><span>TAG</span>
    //         </div>`;
    // }

    const div = document.createElement("div");
    div.innerHTML = entryHTML(log, q);
    const row = div.firstElementChild;
    container.appendChild(row);
    checkOverflows(container);
}

function updateCounts() {
    document.getElementById("total-count").textContent = logs.length;
    // visible-count still needs full filter count — but this is cheap
    const q = currentFilter.query;
    const visible = logs.filter((l) => {
        const typeMatch = currentFilter.type === 0 || l.type === currentFilter.type;
        const searchMatch = !q || String(l.message).toLowerCase().includes(q) || String(l.tag).toLowerCase().includes(q);
        return typeMatch && searchMatch;
    }).length;
    document.getElementById("visible-count").textContent = visible;
}

function render() {
    const q = document.getElementById("search").value.trim().toLowerCase();
    currentFilter = { type: activeFilter, query: q };

    const container = document.getElementById("log-container");
    const filtered = logs.filter((l) => {
        const typeMatch = activeFilter === 0 || l.type === activeFilter;
        const searchMatch = !q || String(l.message).toLowerCase().includes(q) || String(l.tag).toLowerCase().includes(q);
        return typeMatch && searchMatch;
    });

    document.getElementById("total-count").textContent = logs.length;
    document.getElementById("visible-count").textContent = filtered.length;

    // if (filtered.length === 0) {
    //     container.innerHTML = `
    //             <div class="empty-state">
    //               <svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
    //                 <path d="M9 12h6M9 16h6M9 8h2M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z"/>
    //               </svg>
    //               <span>${logs.length === 0 ? "waiting for logs…" : "no matching logs"}</span>
    //             </div>`;
    //     return;
    // }

    container.innerHTML = `
              ${filtered.map((l) => entryHTML(l, q)).join("")}`;

    checkOverflows(container);
}

function entryHTML(l, q) {
    const typeNum = Number(l.type);
    const typeClass =
        typeNum === 1 ? "type-1" : typeNum === 2 ? "type-2" : "type-0";
    const badge =
        typeNum === 1
            ? '<span class="badge-type badge-warn">warn</span>'
            : typeNum === 2
                ? '<span class="badge-type badge-error">error</span>'
                : '<span class="badge-type badge-info">info</span>';
    const time = l.timestamp ? l.timestamp : "--:--:--";
    const originalMsg = l.message.replaceAll("<json>", " ").replaceAll("<br>"," ")
    const msg = q
        ? highlight(escHtml(String(originalMsg)), q)
        : escHtml(String(originalMsg));
    const tag = q
        ? highlight(escHtml(String(l.tag ?? "")), q)
        : escHtml(String(l.tag ?? ""));

    return `<div class="log-entry ${typeClass}" data-log-id="${l.id}" onclick="toggle(event)">
          <div class="col-msg-header col-msg">
            <div>
              <span class="col-type">${badge}</span>
              <span class="col-tag">
                <span class="badge-tag">${tag}</span>
              </span>
              <span class="col-time">${time}</span>
            </div>
            <div>
              <span class="icon-button sm" data-log-id="${l.id}" onclick="copyLogs(event)">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                    <path d="M0 0h24v24H0z" fill="none" />
                    <g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2">
                        <path d="M7 9.667A2.667 2.667 0 0 1 9.667 7h8.666A2.667 2.667 0 0 1 21 9.667v8.666A2.667 2.667 0 0 1 18.333 21H9.667A2.667 2.667 0 0 1 7 18.333z" />
                        <path d="M4.012 16.737A2 2 0 0 1 3 15V5c0-1.1.9-2 2-2h10c.75 0 1.158.385 1.5 1" />
                    </g>
                </svg>

              </span>
              <span class="icon-button sm" data-log-id="${l.id}" onclick="viewFullLog(event)">
                <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
                  <path d="M0 0h24v24H0z" fill="none" />
                  <g fill="none" stroke="#fff" stroke-width="1.5">
                    <path d="M21.544 11.045c.304.426.456.64.456.955c0 .316-.152.529-.456.955C20.178 14.871 16.689 19 12 19c-4.69 0-8.178-4.13-9.544-6.045C2.152 12.529 2 12.315 2 12c0-.316.152-.529.456-.955C3.822 9.129 7.311 5 12 5c4.69 0 8.178 4.13 9.544 6.045Z" />
                    <path d="M15 12a3 3 0 1 0-6 0a3 3 0 0 0 6 0Z" />
                  </g>
                </svg>
              </span>
              <span class="expand-msg-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 5l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </div>
            
          </div>
          <div class="col-msg-body col-msg">${msg}</div>
        </div>`;
}

function checkOverflows(container) {
    const logEntryElement = container.querySelectorAll(".log-entry")
    
    logEntryElement.forEach((entry) => {
        if(entry.classList.contains("expanded")) return
        const body = entry.querySelector(".col-msg-body");
        const icon = entry.querySelector(".expand-msg-icon");
        if (body.scrollHeight <= body.clientHeight) {
            icon.style.visibility = "hidden";
            entry.classList.add("log-overflow-none");
        }
    });
}

function highlight(text, q) {
    const re = new RegExp(
        `(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
    );
    return text.replace(re, "<mark>$1</mark>");
}

function escHtml(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


function clearLogs() {
    socket.emit("clear");
}

function copyIp() {
    const uri = document
        .getElementById("btn_copy_connection")
        .getAttribute("data-uri");
    if (!uri) {
        console.warn("No uri address found.");
        return;
    }
    navigator.clipboard
        .writeText(uri)
        .then(() => {
            console.log("uri copied:", uri);

            // Optional: visual feedback
            const btn = document.getElementById("btn_copy_connection");
            const original = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => (btn.textContent = original), 2000);
        })
        .catch((err) => {
            console.error("Failed to copy:", err);

            // Fallback for older browsers
            const textarea = document.createElement("textarea");
            textarea.value = uri;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        });
}

render();

function toggle(event) {
    const element = event.currentTarget;
    if (element.classList.contains("log-overflow-none")) return;
    element.classList.toggle("expanded");
}

function copyLogs(event) {
    event.preventDefault()
    event.stopPropagation()
    const currentElement = event.currentTarget
    const logId = currentElement.getAttribute("data-log-id")
    let msg = logs.find(e => e.id == logId)?.message;
    msg = msg
        .replaceAll("<json>","")
        .replaceAll("<br>","")
    navigator.clipboard
        .writeText(msg)
        .then(()=>{
            console.log("Copy success!.")
        })
        .catch((err)=>{
            console.log(`Copy failed!. ${err}`)
        })
}
function viewFullLog(event) {
    event.preventDefault()
    event.stopPropagation()
    const currentElement = event.currentTarget
    const logId = currentElement.getAttribute("data-log-id")
    const overlayElement = document.getElementById("overlay")
    overlayElement.classList.add("active");
    document.body.style.overflow = 'hidden';
    const log = logs.find(l => l.id == logId)
    const typeNum = Number(log.type);
    const typeClass =
        typeNum === 1 ? "type-1" : typeNum === 2 ? "type-2" : "type-0";
    const badge =
        typeNum === 1
            ? '<span class="badge-type badge-warn">warn</span>'
            : typeNum === 2
                ? '<span class="badge-type badge-error">error</span>'
                : '<span class="badge-type badge-info">info</span>';

    overlayElement.querySelector(".modal-header").innerHTML = `
          <div>
            <span class="col-type">${badge}</span>
            <span class="col-tag">
              <span class="badge-tag">${log.tag}</span>
            </span>
            <span class="col-time">${log.timestamp}</span>
          </div>
          <button class="close-btn" onclick="closeModal()" aria-label="Close">
            &times;
          </button>
        `

    const modalBody = overlayElement.querySelector(".modal-body");
    renderFullLogContent(modalBody, log.message)

}

function closeModal() {
    document.getElementById("overlay").classList.remove("active");
    document.body.style.overflow = 'auto';
}

function handleOverlayClick(e) {
    if (e.target === document.getElementById("overlay")) closeModal();
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

function renderFullLogContent(modalBody, msg) {

    try {
        const parsed = JSON.parse(msg);
        const formatted = JSON.stringify(parsed, null, 2);
        modalBody.innerHTML = `<pre><code class="language-json"></code></pre>`;
        const codeEl = modalBody.querySelector("code");
        codeEl.textContent = formatted;
        hljs.highlightElement(codeEl);
        return
    } catch { }

    const parts = msg.split("<json>");
    let html = "";

    parts.forEach((part, index) => {
        const trimmed = part.trim();
        if (!trimmed) return;

        if (index % 2 === 1) {
            // Odd index = inside a <json>...</json> block
            try {
                const parsed = JSON.parse(trimmed);
                const formatted = JSON.stringify(parsed, null, 2);
                const codeId = `json-block-${index}`;
                html += `<pre><code id="${codeId}" class="language-json"></code></pre>`;
                // Store formatted text to inject after innerHTML is set
                parts[index] = { id: codeId, formatted };
            } catch {
                // Not valid JSON — render as plain text
                html += `<pre>${escapeHtml(trimmed)}</pre>`;
                parts[index] = null;
            }
        } else {
            // Even index = plain text segment
            html += `<div class="log-text">${escapeHtml(trimmed)}</div>`;
            parts[index] = null;
        }
    });

    modalBody.innerHTML = html;

    // Now inject + highlight JSON blocks
    parts.forEach((part) => {
        if (part && part.id) {
            const codeEl = document.getElementById(part.id);
            if (codeEl) {
                codeEl.textContent = part.formatted;
                hljs.highlightElement(codeEl);
            }
        }
    });
}

function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/<br\s*\/?>/gi, "\x00BR\x00")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/\x00BR\x00/g, "<br>"); 
}
let autoScroll = true;
let lastScrollY = window.scrollY;

window.addEventListener("scroll", () => {
  const currentScrollY = window.scrollY;
  const isUserNearBottom = () => {
    const threshold = 150;
    return window.innerHeight + window.scrollY >= document.body.scrollHeight - threshold;
  };

  const scrollingUp = currentScrollY < lastScrollY;

  if (isUserNearBottom()) {
    autoScroll = true;       // re-enable at bottom regardless of direction
  } else if (scrollingUp) {
    autoScroll = false;      // disable when scrolling up
  }

  lastScrollY = currentScrollY;
});

function scrollBottom() {
  if (logs.length === 0 || !autoScroll) return;

  const latestLogId = logs[logs.length - 1].id;
  const latestLogElement = document.querySelector(`[data-log-id="${latestLogId}"]`);
  latestLogElement?.scrollIntoView({ behavior: "smooth", block: "end" });
}

var isScrollingToButtom = false

function scrollBottom() {
    if(isScrollingToButtom) return
    console.log("scrollBottom() started...");
    
    isScrollingToButtom = true;

    setTimeout(() => {
        isScrollingToButtom = false
    }, 200);

    if (logs.length === 0 || !autoScroll) return;

    const latestLogElement = document.getElementById("bottom_screen_element");
    latestLogElement?.scrollIntoView({ behavior: "smooth", block: "end" });
}



function saveLogSizeLimit() {
  const size = parseInt(logSizeLimitTextField.value);
  if (isNaN(size) || size <= 0) {
    logSizeLimitTextField.value = '';
    return;
  }
  logSizeLimitTextField.value = size;
  socket.emit("log-size-limit-change", size);
}

logSizeLimitTextField.addEventListener('blur', saveLogSizeLimit);
logSizeLimitTextField.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    logSizeLimitTextField.blur();
  }
});