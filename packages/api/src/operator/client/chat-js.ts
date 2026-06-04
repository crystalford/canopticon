// Chat client JS, served at /op/chat.js. Vanilla, no framework, no
// build step — a single module string the Worker returns with a long
// cache. Handles: creating a conversation on first send, POSTing the
// message, consuming the SSE stream, and appending message_delta /
// tool_call / tool_result to the DOM as they arrive.
//
// Event shape matches packages/api/src/routes/chat.ts:
//   message_delta { text }
//   tool_call     { tool_use_id, name, input, confirm }
//   tool_result   { tool_use_id, output?, error?, side_effects? }
//   awaiting_confirm { tool_use_id, name, input }
//   done          { ok }
//   error         { message }
//
// Classes match the design's chat surface CSS: chat-msg user/system,
// chat-q (user bubble), chat-r-text (system response), chat-chip
// (tool/result chips).

export const CHAT_CLIENT_JS = String.raw`
const boot = JSON.parse(document.getElementById("chat-bootstrap")?.textContent || "{}");
let conversationId = boot.conversationId || null;

const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const scroll = document.getElementById("chat-scroll");
const statusEl = document.getElementById("chat-status");
const sendBtn = document.getElementById("chat-send");

function esc(s){ const d=document.createElement("div"); d.textContent=s==null?"":String(s); return d.innerHTML; }
function scrollDown(){ scroll.scrollTop = scroll.scrollHeight; }
function setStatus(t){ statusEl.textContent = t || ""; }

function addUserMsg(text){
  const el = document.createElement("div");
  el.className = "chat-msg user";
  el.innerHTML = '<div class="chat-q">' + esc(text) + '</div>';
  scroll.appendChild(el); scrollDown();
}

function startAssistant(){
  const el = document.createElement("div");
  el.className = "chat-msg system";
  const inner = document.createElement("div");
  inner.className = "chat-r";
  el.appendChild(inner);
  scroll.appendChild(el); scrollDown();
  return el;
}

function ensureBubble(container){
  const inner = container.querySelector(".chat-r");
  let b = inner.querySelector(".chat-r-text.streaming");
  if(!b){
    b = document.createElement("div");
    b.className = "chat-r-text streaming";
    inner.appendChild(b);
  }
  return b;
}

function ensureChips(container){
  const inner = container.querySelector(".chat-r");
  let c = inner.querySelector(".chat-chips");
  if(!c){
    c = document.createElement("div");
    c.className = "chat-chips";
    inner.appendChild(c);
  }
  return c;
}

function addToolChip(container, name, state){
  const chips = ensureChips(container);
  const chip = document.createElement("span");
  chip.className = "chat-chip ch-pattern " + (state||"pending");
  chip.dataset.tool = name;
  chip.innerHTML = '<span class="cc-label">tool</span><span class="cc-val">' + esc(name) + '</span>';
  chips.appendChild(chip); scrollDown();
  return chip;
}

function addLoading(container){
  const inner = container.querySelector(".chat-r");
  const ld = document.createElement("div");
  ld.className = "chat-loading";
  ld.innerHTML = '<span class="chat-dot"></span><span class="chat-dot"></span><span class="chat-dot"></span>';
  inner.appendChild(ld);
  return ld;
}

function removeLoading(container){
  const ld = container.querySelector(".chat-loading");
  if (ld) ld.remove();
}

async function createConversation(){
  const res = await fetch("/v1/chat/conversations", {
    method:"POST", headers:{"content-type":"application/json"},
    credentials:"include", body: JSON.stringify({})
  });
  if(!res.ok) throw new Error("could not create conversation");
  const j = await res.json();
  return j.id || j.conversation?.id;
}

async function send(text){
  sendBtn.disabled = true;
  setStatus("thinking…");
  if(!conversationId){
    conversationId = await createConversation();
    history.replaceState(null,"", "/op/chat/" + conversationId);
  }
  addUserMsg(text);
  const assistant = startAssistant();
  addLoading(assistant);

  const res = await fetch("/v1/chat/conversations/" + conversationId + "/messages", {
    method:"POST",
    headers:{"content-type":"application/json","accept":"text/event-stream"},
    credentials:"include",
    body: JSON.stringify({ text })
  });
  if(!res.ok || !res.body){ setStatus("error"); sendBtn.disabled=false; removeLoading(assistant); return; }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for(;;){
    const { value, done } = await reader.read();
    if(done) break;
    buffer += decoder.decode(value, { stream:true });
    let idx;
    while((idx = buffer.indexOf("\n\n")) >= 0){
      const block = buffer.slice(0, idx); buffer = buffer.slice(idx+2);
      removeLoading(assistant);
      handleEvent(parseBlock(block), assistant);
    }
  }
  removeLoading(assistant);
  const sb = assistant.querySelector(".chat-r-text.streaming");
  if(sb) sb.classList.remove("streaming");
  setStatus(""); sendBtn.disabled = false;
}

function parseBlock(block){
  let event = "message"; let data = "";
  for(const line of block.split("\n")){
    if(line.startsWith("event:")) event = line.slice(6).trim();
    else if(line.startsWith("data:")) data += line.slice(5).trim();
  }
  let parsed = null;
  try { parsed = data ? JSON.parse(data) : null; } catch(_e){ parsed = data; }
  return { event, data: parsed };
}

function handleEvent(ev, assistant){
  if(ev.event === "message_delta" && ev.data && ev.data.text){
    ensureBubble(assistant).innerHTML += esc(ev.data.text);
    scrollDown();
  } else if(ev.event === "tool_call"){
    addToolChip(assistant, ev.data.name, ev.data.confirm ? "pending" : "pending");
  } else if(ev.event === "tool_result"){
    const chips = assistant.querySelectorAll(".chat-chip");
    const chip = chips[chips.length-1];
    if(chip){
      chip.classList.remove("pending");
      chip.classList.add(ev.data && ev.data.error ? "err" : "ok");
    }
  } else if(ev.event === "awaiting_confirm"){
    setStatus("awaiting confirmation — " + (ev.data && ev.data.name));
  } else if(ev.event === "error"){
    setStatus("error: " + (ev.data && ev.data.message || "unknown"));
  } else if(ev.event === "done"){
    setStatus("");
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if(!text) return;
  input.value = "";
  send(text).catch((err) => { setStatus("error: " + err.message); sendBtn.disabled=false; });
});

// Suggestion chips: click to populate + auto-submit.
document.querySelectorAll(".chat-sg").forEach((b) => {
  b.addEventListener("click", () => {
    const sg = b.getAttribute("data-sg") || b.textContent;
    if (!sg) return;
    input.value = sg;
    form.requestSubmit();
  });
});

input.addEventListener("keydown", (e) => {
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    form.requestSubmit();
  }
});
`;
