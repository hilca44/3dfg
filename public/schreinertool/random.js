function updateAndReloadURL() {
    let inn =window.document.getElementById("inn").value

  // let urlFromInn=makeFullUrlFromInn(inn)
  let urlFromInn=innToUrl(inn)
  // if(window.location.href!= urlFromInn){
  window.location.href=urlFromInn 

  // }

}


function innToUrl(inn) {

  if (!inn) return location.origin + location.pathname;

  const lines = inn
    .trim()
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (!lines.length) return location.origin + location.pathname;

  const firstWords = lines[0].split(/\s+/);

  let name = firstWords[0];

  // 🔒 Sicherheits-Check:
  // Key darf keine URL sein und kein "=" enthalten
  if (name.includes("http") || name.includes("=") || name.includes("?")) {
    console.warn("Ungültiger Name in DSL:", name);
    return location.origin + location.pathname;
  }

  const firstLineWithoutName = firstWords.slice(1).join(" ");

  const valueLines = [
    firstLineWithoutName,
    ...lines.slice(1)
  ];

  const value = valueLines
    .map(line => line.split(/\s+/).join("~"))
    .join("--");

  const url = new URL(location.origin + location.pathname);
  url.searchParams.set(name, value);

  return url.toString();
}

function randomFurniture1() {

  const rand = (min,max)=>Math.floor(Math.random()*(max-min+1))+min;
  const pick = a => a[rand(0,a.length-1)];

  const letters = "abcdefghijklmnopqrstuvwxyz".split("");

  const colors  = ["wh","bt","ec","gr","an","bl","gn","ro","te","we"];
  const connect = ["c","c1","c3"];
  const parts   = ["l","r","g","t","b","c","f"];
  const rotations = ["o","o9","o-9","o20","o-20"];
  const brightness = "abcdefghijklmnopqrstuvwxyz".split("");

  const furnitureTypes = [
    "regal",
    "sideboard",
    "hochschrank",
    "lowboard",
    "raumteiler"
  ];

  const type = pick(furnitureTypes);

  const lines = [];

  // materialdefinitionen
  const mats = [];

  for(let i=0;i<3;i++){
    mats.push(`m19${pick(colors)}${pick(brightness)}`);
  }

  lines.push("test " + mats.join(" "));

  let furnitureCount = rand(2,4);

  for(let i=0;i<furnitureCount;i++){

    const id = letters[i];

    let w,d,h,shelves;

    // typabhängige maße
    if(type==="regal"){
      w = rand(60,100);
      d = rand(30,40);
      h = rand(160,220);
      shelves = rand(4,8);
    }

    else if(type==="sideboard"){
      w = rand(120,200);
      d = rand(40,60);
      h = rand(60,90);
      shelves = rand(1,3);
    }

    else if(type==="hochschrank"){
      w = rand(50,80);
      d = rand(40,60);
      h = rand(180,240);
      shelves = rand(3,6);
    }

    else if(type==="lowboard"){
      w = rand(140,220);
      d = rand(40,60);
      h = rand(40,70);
      shelves = rand(0,2);
    }

    else { // raumteiler
      w = rand(60,100);
      d = rand(30,40);
      h = rand(160,220);
      shelves = rand(3,7);
    }

    let line = `${id} plrgtbc ${w},${d},${h} m${rand(1,3)}`;

    if(shelves>0){
      line += ` sc${shelves}`;
    }

    if(i>0){
      line += ` ${pick(connect)}`;
    }

    // materialwechsel einzelteile
    if(Math.random() < 0.5){

      let pool = [...parts];
      let count = rand(1,3);
      let cmd = "m";

      for(let k=0;k<count;k++){
        const idx = rand(0,pool.length-1);
        cmd += pool[idx];
        pool.splice(idx,1);
      }

      cmd += rand(1,3);

      line += ` ${cmd}`;
    }

    // rotation selten
    if(Math.random() < 0.15){
      line += ` ${pick(rotations)}`;
    }

    // raumteiler öfter wiederholen
    if(i===furnitureCount-1){

      if(type==="raumteiler" || Math.random()<0.6){
        line += ` n${rand(2,6)}`;
      }

    }

    lines.push(line);
  }

  return lines.join("\n");
}

function applyRandomFurniture() {

  const ta = document.getElementById("inn");

  const header = ta.value.split("\n")[0];

  ta.value = randomFurnitureFromProject(header);
  window.recordReloadHistory?.();

  updateAndReloadURL();
}


let autoTimer = null;
let autoMark = "";

function autoText(base){
  return autoMark ? `${base} ${autoMark}` : base;
}

async function loadAutoMark(btn){
  try {
    const res = await fetch("/q", { cache: "no-store" });
    const data = await res.json();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(data?.v || "")) {
      autoMark = data.v;
      btn.textContent = autoText(autoTimer ? "STOP" : "AUTO");
    }
  } catch {}
}

function startRandomLoop() {

  if (autoTimer) return;

  autoTimer = setInterval(() => {

    applyRandomFurniture();

  }, 10000);

  updateRandomControls();

}

function stopRandomLoop() {

  clearInterval(autoTimer);

  autoTimer = null;
  localStorage.setItem("c3_auto","0");
  updateRandomControls();

}

function startRandomFurniture(){

  if(autoTimer) return;

  autoTimer = setInterval(()=>{

    applyRandomFurniture();

  },10000);

  updateRandomControls();

}

function toggleRandomFurniture(btn){

  if(autoTimer){

    stopRandomLoop();

  } else {

    toggleRandomParams() 
    
  }

}



const stopBtn = document.getElementById("randomStopButton");
if (stopBtn) stopBtn.onclick = stopRandomLoop;

function updateRandomControls() {
  if (stopBtn) stopBtn.style.display = autoTimer ? "block" : "none";
  window.dispatchEvent(new CustomEvent("c3:auto", { detail: { running: !!autoTimer } }));
}

window.toggleRandomFurniture = toggleRandomFurniture;
window.stopRandomLoop = stopRandomLoop;
window.getRandomAutoRunning = () => !!autoTimer;
loadAutoMark({ textContent: "" });

if(localStorage.getItem("c3_auto") === "1"){

  startRandomFurniture();

  updateRandomControls();

}

function countMaterials(header){

    const words = header.split(/\s+/)

    let count = 0

    for(const w of words){

        if(/^m\d/.test(w)){
            count++
        }
    }

    return Math.max(1,count)
}
/* ======================================================
   RANDOM FURNITURE GENERATOR
   ====================================================== */
function parseRange(str,min,max){

    if(!str) return [min,max]

    const p=str.split("-").map(Number)

    if(p.length!==2) return [min,max]

    return [
        Number.isFinite(p[0]) ? p[0] : min,
        Number.isFinite(p[1]) ? p[1] : max
    ]
}

function rand(a,b){
    return Math.floor(Math.random()*(b-a+1))+a
}


function randomFurnitureFromProject(header){

  header = ensureProjectDefaults(header)

  const params = getRandomParamsFromProject(header) || {}
  const materialCount = countMaterials(header)

  function parseRange(s,a,b){
    if(!s) return [a,b]
    const p=s.split("-").map(Number)
    if(p.length!==2) return [a,b]
    return [p[0]||a,p[1]||b]
  }

  function rand(a,b){
    return Math.floor(Math.random()*(b-a+1))+a
  }

  const [wmin,wmax] = parseRange(params.w,40,80)
  const [dmin,dmax] = parseRange(params.d,40,40)
  const [hmin,hmax] = parseRange(params.h,30,120)

  const words = header.split(/\s+/)
const [W,D,H] = readProjectSize(header)

  const columnWidths = generateColumnWidths(W,20,100)

  const letters="abcdefghijklmnopqrstuvwxyz".split("")
  const lines=[header]

  let i=0
  let prevColumnBase=null
  let botko ="a"
  let id = "a";
  let prevIndex=id
  for(let col=0; col<columnWidths.length; col++){
    let cc=0
    let tc = 1

    const w = columnWidths[col]
    const d = rand(dmin,dmax)

    let columnHeight=0
    let columnBase=null
    botko=id
    prevko=id

    while(columnHeight < H*0.95 && i < d*111){


      // let h=rand(hmin,hmax)
      let h=rand(20,H)

      if(columnHeight + h > H){
        h = H - columnHeight
        tc=3
        
      }

      let line=""

      if(i===0){

        line=`a p=lrgtbc ${w},${d},${h} m1`
id="a"
      }else{

        let inherit
        let connect
        let corn = [0,0,0,1,2,3,4,5,6,7]
        let two = rndManyUnique(corn,[2])
        id="a"+ String(i)
        inherit = "a"+prevIndex;
        connect = `w=${w} h=${h} m=${rnd([1, 2])} cur=${id},,${cc} tar=${prevIndex},,${tc}`

        if(prevIndex!==null){


        }else{

          // inherit = letters[prevColumnBase]
          // connect = `c${letters[prevColumnBase]}3`
        }

        line = String(id + " " + connect)

        // if(Math.random()<0.3){
        //   line+=` b.m${rand(1,materialCount)}`
        // }
      }

      lines.push(line)

      if(columnBase===null) columnBase=i

      columnHeight += h
      i++

      if(columnHeight>=H) break
    }

    prevColumnBase = columnBase
      prevIndex=id

  }

  return lines.join("\n")
}


function rnd(arr){
    return arr[Math.floor(Math.random() * arr.length)];
}


function rndManyUnique(arr, counts=[3,4,5,6]){

    const n = rnd(counts);

    return [...arr]
        .sort(() => Math.random()-0.5)
        .slice(0,n);
}   


function readProjectSize(header){

  const m = header.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)

  if(!m) return [400,40,250]

  return [
    Number(m[1]),
    Number(m[2]),
    Number(m[3])
  ]
}

function generateColumnWidths(W, wmin, wmax){

  const cols=[]
  let rest=W

  while(rest > wmax){

    let w=Math.floor(Math.random()*(wmax-wmin+1))+wmin

    if(rest-w < wmin){
      w=rest
    }

    cols.push(w)
    rest-=w
  }

  if(rest>=wmin){
    cols.push(rest)
  }else{
    cols[cols.length-1]+=rest
  }

  return cols
}


function randomFurnitureFromProje111111111111ct(header){

    header = ensureProjectDefaults(header)

    const params = getRandomParamsFromProject(header) || {}
    const materialCount = countMaterials(header)

    function parseRange(str,min,max){
        if(!str) return [min,max]
        const p=str.split("-").map(Number)
        if(p.length!==2) return [min,max]
        return [
            Number.isFinite(p[0]) ? p[0] : min,
            Number.isFinite(p[1]) ? p[1] : max
        ]
    }

    function rand(a,b){
        return Math.floor(Math.random()*(b-a+1))+a
    }

    const [bphMin,bphMax] = parseRange(params.bph,80,120)
    const [fillMin,fillMax] = parseRange(params.fill,70,100)
    const [boxMin,boxMax] = parseRange(params.box,2,5)

    const [wmin,wmax] = parseRange(params.w,40,80)
    const [dmin,dmax] = parseRange(params.d,40,40)
    const [hmin,hmax] = parseRange(params.h,30,120)

    const words = header.split(/\s+/)

    let W=400,D=40,H=250

    if(words[1] && words[1].includes(",")){
        [W,D,H]=words[1].split(",").map(Number)
    }

    const fillPercent = rand(fillMin,fillMax)
    const targetArea = W*H*(fillPercent/100)

    const horizonHeight = rand(bphMin,bphMax)

    const letters="abcdefghijklmnopqrstuvwxyz".split("")

    const lines=[header]

    let usedArea=0
    let i=0

    let columnHeight=0
    let columnBase=null
    let prevColumnBase=null
    let prevIndex=null

    /* neue Variablen */

    let columnWidth=null
    let columnDepth=null

    let frontToggle=Math.random()<0.5

    while(usedArea < targetArea && i < letters.length){

        /* neue Spalte */

        if(columnHeight===0){
            columnWidth = rand(wmin,wmax)
            columnDepth = rand(dmin,dmax)
        }

        const id = letters[i]

        const w = columnWidth
        const d = columnDepth

        let h

        if(rand(1,100)<=60){
            h=horizonHeight
        }else{
            h=rand(hmin,hmax)
        }

        if(h>H) h=H

        if(columnHeight + h > H*0.95){

            prevColumnBase = columnBase
            columnBase = null
            prevIndex = null
            columnHeight = 0

            continue
        }

        const partString = frontToggle ? "pflrgtbc" : "plrgtbc"
        frontToggle=!frontToggle

        let line=`${id} ${partString} ${w},${d},${h} m1`

        if(partString.includes("f")){
            line+=` mf${rand(1,materialCount)}`
        }

        if(prevIndex===null){
            line+=` u8g`
        }

        const r=rand(1,10)

        if(r<=7) line+=` mb1`
        else if(r<=9) line+=` mb2`
        else line+=` mb${materialCount}`

        const maxShelves=Math.floor(h/20)-1

        if(maxShelves>0 && Math.random()<0.6){
            line+=` sc${rand(1,maxShelves)}`
        }

        if(i>0){

            if(prevIndex!==null){
                line+=` c${letters[prevIndex]}1`
            }
            else if(prevColumnBase!==null){
                line+=` c${letters[prevColumnBase]}3`
            }
        }

        lines.push(line)

        usedArea += w*h
        columnHeight += h

        if(columnBase===null) columnBase=i

        prevIndex=i
        i++
    }

    const boxCount = rand(boxMin,boxMax)

    if(lines.length>1){
        lines[lines.length-1]+=` n${boxCount}`
    }

    return lines.join("\n")
}


/* ======================================================
   HISTORY + GENERATOR
   ====================================================== */

function generateRandomProject(){

    const ta=document.getElementById("inn")

    const header=ta.value.split("\n")[0]

    const newText=randomFurnitureFromProject(header)

    ta.value=newText

    updateURL(newText)

    renderProject()
}

function toggleRandomParams() {
  const host = document.getElementById("randomParamHost") || document.body;
  let box = document.getElementById("randomParams");

  if (!box) {
    box = createRandomParamForm();
    host.appendChild(box);
    return;
  }

  box.classList.toggle("hidden");
}



function applyRandomParams() {

  const ta = document.getElementById("inn");
  if (!ta) return;

  const bph  = document.getElementById("rf_bph").value.trim();
  const box  = document.getElementById("rf_box").value.trim();
  const fill = document.getElementById("rf_fill").value.trim();

  let lines = ta.value.split(/\r?\n/);

  let header = lines[0];

  header = header.replace(/\s*r\[.*?\]/,"");

  const params = [];

  if (bph)  params.push(`bph=${bph}`);
  if (box)  params.push(`box=${box}`);
  if (fill) params.push(`fill=${fill}`);

  header += ` r[${params.join(" ")}]`;

  lines[0] = header;
  ta.value = lines.join("\n");

  document.getElementById("randomParams")?.classList.add("hidden");
///////////////
  // runRandomFurniture();
  startRandomFurniture();
    localStorage.setItem("c3_auto","1");
    updateRandomControls();

}


function createRandomParamForm() {

  const params = getRandomParamsFromProject() || {}

  const box = document.createElement("div");
  box.id = "randomParams";
  box.className = "random-box";

  box.innerHTML = `
    <div class="random-title">Random Furniture</div>

    <label>BPH</label>
    <input id="rf_bph" type="text" value="${params.bph || "80-120"}">

    <label>Box</label>
    <input id="rf_box" type="text" value="${params.box || "2-5"}">

    <label>Fill %</label>
    <input id="rf_fill" type="text" value="${params.fill || "70-100"}">

    <div class="random-actions">
      <button id="rf_apply" type="button">Apply</button>
    </div>
  `;

  box.querySelector("#rf_apply")
     .addEventListener("click", applyRandomParams);

  return box;
}

function getRandomParamsFromProject(text) {
  const src = text ?? document.getElementById("inn")?.value ?? "";
  const firstLine = src.split(/\r?\n/)[0] || "";

  const m = firstLine.match(/r\[([^\]]*)\]/);
  if (!m) return null;

  const out = {};

  m[1].split(/\s+/).forEach(part => {
    const [key, value] = part.split("=");
    if (key && value) out[key] = value;
  });

  return out;
}






function getRandomParams(){

  const ta = document.getElementById("inn");
  if (!ta) return {};

  const line = ta.value.split("\n")[0];

  const m = line.match(/r\[(.*?)\]/);
  if (!m) return {};

  const obj = {};

  m[1].split(" ").forEach(p=>{
    const [k,v] = p.split("=");
    obj[k] = v;
  });

  return obj;
}

function runRandomFurniture(){

    const ta=document.getElementById("inn")

    const header=ta.value.split("\n")[0]

    const result=randomFurnitureFromProject(header)
  //   toggleRandomFurniture(btn)
  // return
    ta.value=result

    /* wichtig */

    ta.dispatchEvent(new Event("input",{bubbles:true}))

}

function ensureProjectDefaults(header){

    if(!header) header="test";

    const words = header.trim().split(/\s+/)

    /* Projektmaß */

    if(!words[1] || !/^\d+,\d+,\d+$/.test(words[1])){
        words.splice(1,0,"400,40,250")
    }

    /* Box-Parameter */

    let box = words.find(w => w.startsWith("box"))

    if(!box){
        words.push("box40_80,40,30_120")
    }

    return words.join(" ")
}
