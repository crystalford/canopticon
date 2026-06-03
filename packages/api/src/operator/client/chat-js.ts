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
  el.className = "op-msg user";
  el.innerHTML = '<div class="bubble">' + esc(text) + '</div>';
  scroll.appendChild(el); scrollDown();
}

function startAssistant(){
  const el = document.createElement("div");
  el.className = "op-msg assistant";
  scroll.appendChild(el); scrollDown();
  return el;
}

function ensureBubble(container){
  let b = container.querySelector(".bubble.streaming");
  if(!b){
    b = document.createElement("div");
    b.className = "bubble streaming";
    container.appendChild(b);
  }
  return b;
}

function addToolChip(container, name, state){
  const chip = document.createElement("div");
  chip.className = "op-toolchip " + (state||"pending");
  chip.dataset.tool = name;
  chip.innerHTML = '<span class="dot"></span>' + esc(name);
  container.appendChild(chip); scrollDown();
  return chip;
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

  const res = await fetch("/v1/chat/conversations/" + conversationId + "/messages", {
    method:"POST",
    headers:{"content-type":"application/json","accept":"text/event-stream"},
    credentials:"include",
    body: JSON.stringify({ text })
  });
  if(!res.ok || !res.body){ setStatus("error"); sendBtn.disabled=false; return; }

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
      handleEvent(parseBlock(block), assistant);
    }
  }
  // strip the streaming marker so the next turn starts a fresh bubble
  const sb = assistant.querySelector(".bubble.streaming");
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
    const name = ev.data && ev.data.name;
    const chips = assistant.querySelectorAll(".op-toolchip");
    const chip = chips[chips.length-1];
    if(chip) chip.className = "op-toolchip " + (ev.data && ev.data.error ? "err" : "ok");
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

input.addEventListener("keydown", (e) => {
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    form.requestSubmit();
  }
});
`;
