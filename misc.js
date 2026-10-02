function refreshTracks(force){
    if(simSettings.trackMode===2 && !force) return;
    tracks.clear();
    forecastTracks.clear();
    if(selectedStorm) selectedStorm.renderTrack();
    else if(simSettings.trackMode===2){
        let target = UI.viewBasin.getSeason(viewTick);
        let valid = sys=>(sys.inBasinTC && (UI.viewBasin.getSeason(sys.enterTime)===target || UI.viewBasin.getSeason(sys.enterTime)<target && (sys.exitTime===undefined || UI.viewBasin.getSeason(sys.exitTime-1)>=target)));
        for(let s of UI.viewBasin.fetchSeason(viewTick,true,true).forSystems()) if(valid(s)) s.renderTrack();
    }else if(UI.viewBasin.viewingPresent()) for(let s of UI.viewBasin.activeSystems) s.fetchStorm().renderTrack();
    else for(let s of UI.viewBasin.fetchSeason(viewTick,true,true).forSystems()) s.renderTrack();
}

function createBuffer(w,h,alwaysFull,noScale){
    w = w || WIDTH;
    h = h || HEIGHT;
    let b = createGraphics(w,h);
    let metadata = {
        baseWidth: w,
        baseHeight: h,
        alwaysFull,
        noScale
    };
    buffers.set(b,metadata);
    return b;
}

function rescaleCanvases(s){
    for(let [buffer, metadata] of buffers){
        if(!metadata.alwaysFull){
            buffer.resizeCanvas(floor(metadata.baseWidth*s),floor(metadata.baseHeight*s));
            if(!metadata.noScale) buffer.scale(s);
        }
    }
    resizeCanvas(floor(WIDTH*s),floor(HEIGHT*s));
}

function toggleFullscreen(){
    if(document.fullscreenElement===canvas || deviceOrientation===PORTRAIT) document.exitFullscreen();
    else{
        canvas.requestFullscreen().then(function(){
            scaler = displayWidth/WIDTH;
            rescaleCanvases(scaler);
            if(UI.viewBasin){
                refreshTracks(true);
                UI.viewBasin.env.displayLayer();
            }
        });
    }
}

function fullDimensions(){
    let fullW = deviceOrientation===PORTRAIT ? displayHeight : displayWidth;
    let fullH = fullW*HEIGHT/WIDTH;
    return {fullW, fullH};
}

function drawBuffer(b){
    image(b,0,0,WIDTH,HEIGHT);
}

function getMouseX(){
    return floor(mouseX/scaler);
}

function getMouseY(){
    return floor(mouseY/scaler);
}

function coordinateInCanvas(x,y,isPixelCoordinate){
    if(isPixelCoordinate) return x >= 0 && x < width && y >= 0 && y < height;
    return x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT;
}

function cbrt(n){   // Cubed root function since p5 doesn't have one nor does pow(n,1/3) work for negative numbers
    return n<0 ? -pow(abs(n),1/3) : pow(n,1/3);
}

function zeroPad(n,d){
    n = parseFloat(n);
    if(!Number.isNaN(n)){
        let str;
        let int = parseInt(n);
        if(int<0){
            int = int.toString().slice(1);
            str = '-' + int.padStart(d,'0');
        }else{
            int = int.toString();
            str = int.padStart(d,'0');
        }
        str = str.slice(0,-int.length);
        str += abs(n).toString();
        return str;
    }
}

function hashCode(str){
    let hash = 0;
    if(str.length === 0) return hash;
    for(let i = 0; i < str.length; i++){
        let char = str.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

let embeddedEarthMap;   // promise for the base64 copy of the map, loaded at most once
function loadEmbeddedEarthMap(){    // fetches resources/earth_data.js on demand (file:// only)
    if(!embeddedEarthMap){
        embeddedEarthMap = new Promise((resolve,reject)=>{
            if(typeof EARTH_MAP_DATA_URI === 'string'){ resolve(EARTH_MAP_DATA_URI); return; }
            let script = document.createElement('script');
            script.src = 'resources/earth_data.js';
            script.onload = ()=>{
                if(typeof EARTH_MAP_DATA_URI === 'string') resolve(EARTH_MAP_DATA_URI);
                else reject(new Error('resources/earth_data.js did not define EARTH_MAP_DATA_URI'));
            };
            script.onerror = ()=>reject(new Error('could not load resources/earth_data.js'));
            document.head.appendChild(script);
        });
    }
    return embeddedEarthMap;
}

function mapLoadFailed(err){    // the map image could not be loaded; report it instead of crashing later
    let box = document.getElementById('map-load-failed');
    if(box) return box;
    box = document.createElement('div');
    box.id = 'map-load-failed';
    box.style.cssText = 'position:fixed;left:0;right:0;top:0;padding:12px 16px;background:#a00;color:#fff;'
        + 'font:14px/1.7 "Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif;z-index:99999;';
    box.textContent = '地图图片载入失败，无法开始模拟：' + ((err && err.message) ? err.message : err)
        + '　请检查 resources 目录下的 earth.png 与 earth_data.js 是否都在；'
        + '如果你是直接双击 index.html 打开的，也请确认 resources\\earth_data.js 没有被移动或删除。';
    document.body.appendChild(box);
    return box;
}

function loadImg(path){     // wrap p5.loadImage in a promise
    return new Promise((resolve,reject)=>{
        setTimeout(()=>{
            // Browsers refuse to fetch local files over the file:// protocol, and an image opened
            // from disk taints the canvas so its pixels cannot be read either (see loadPixels() in
            // basin.js). The map therefore also ships as an embedded data URI, which loads and
            // allows pixel access no matter how the page was opened, so use it in that case.
            if(location.protocol==='file:' && path===EARTH_MAP_PATH){
                loadEmbeddedEarthMap().then(uri=>loadImage(uri,resolve,reject),reject);
            }else{
                loadImage(path,resolve,reject);
            }
        });
    });
}

// waitForAsyncProcess allows the simulator to wait for things to load; unneeded for saving
function waitForAsyncProcess(func,desc,...args){  // add .then() callbacks inside of func before returning the promise, but add .catch() to the returned promise of waitForAsyncProcess
    waitingFor++;
    if(waitingFor<2)
        waitingTCSymbolSHem = random()<0.5;
    let descIndex = waitingDescs.lowestAvailable;
    if(descIndex > waitingDescs.maxIndex)
        waitingDescs.maxIndex = descIndex;
    for(let i=descIndex+1;i<=waitingDescs.maxIndex+1;i++){
        if(!waitingDescs[i]){
            waitingDescs.lowestAvailable = i;
            break;
        }
    }
    waitingDescs[descIndex] = desc;
    let endWait = ()=>{
        waitingFor--;
        waitingDescs[descIndex] = undefined;
        if(descIndex < waitingDescs.lowestAvailable)
            waitingDescs.lowestAvailable = descIndex;
        if(descIndex >= waitingDescs.maxIndex){
            for(let i=descIndex;i>=-1;i--){
                if(i<0 || waitingDescs[i]){
                    waitingDescs.maxIndex = i;
                    break;
                }
            }
        }
    };
    let p = func(...args);
    if(p instanceof Promise || p instanceof Dexie.Promise){
        return p.then(v=>{
            endWait();
            return v;
        }).catch(e=>{
            endWait();
            throw e;
        });
    }
    endWait();
    return Promise.resolve(p);
}

function makeAsyncProcess(func,...args){
    return new Promise((resolve,reject)=>{
        setTimeout(()=>{
            try{
                resolve(func(...args));
            }catch(err){
                reject(err);
            }
        });
    });
}

function upgradeLegacySaves(){
    return waitForAsyncProcess(()=>{
        return makeAsyncProcess(()=>{
            // Rename saved basin keys for save slot 0 from versions v20190217a and prior

            let oldPrefix = LOCALSTORAGE_KEY_PREFIX + '0-';
            let newPrefix = LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SAVEDBASIN + '0-';
            let f = LOCALSTORAGE_KEY_FORMAT;
            let b = LOCALSTORAGE_KEY_BASIN;
            let n = LOCALSTORAGE_KEY_NAMES;
            if(localStorage.getItem(oldPrefix+f)){
                localStorage.setItem(newPrefix+f,localStorage.getItem(oldPrefix+f));
                localStorage.removeItem(oldPrefix+f);
                localStorage.setItem(newPrefix+b,localStorage.getItem(oldPrefix+b));
                localStorage.removeItem(oldPrefix+b);
                localStorage.setItem(newPrefix+n,localStorage.getItem(oldPrefix+n));
                localStorage.removeItem(oldPrefix+n);
            }
        }).then(()=>{
            // Transfer localStorage saves to indexedDB

            return db.transaction('rw',db.saves,db.seasons,()=>{
                for(let i=0;i<localStorage.length;i++){
                    let k = localStorage.key(i);
                    if(k.startsWith(LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SAVEDBASIN)){
                        let s = k.slice((LOCALSTORAGE_KEY_PREFIX+LOCALSTORAGE_KEY_SAVEDBASIN).length);
                        s = s.split('-');
                        let name = parseInt(s[0]);
                        if(name===0) name = AUTOSAVE_SAVE_NAME;
                        else name = LEGACY_SAVE_NAME_PREFIX + name;
                        let pre = LOCALSTORAGE_KEY_PREFIX+LOCALSTORAGE_KEY_SAVEDBASIN+s[0]+'-';
                        if(s[1]===LOCALSTORAGE_KEY_FORMAT){
                            let obj = {};
                            obj.format = parseInt(localStorage.getItem(k),SAVING_RADIX);
                            obj.value = {};
                            obj.value.str = localStorage.getItem(pre+LOCALSTORAGE_KEY_BASIN);
                            obj.value.names = localStorage.getItem(pre+LOCALSTORAGE_KEY_NAMES);
                            db.saves.where(':id').equals(name).count().then(c=>{
                                if(c<1) db.saves.put(obj,name);
                            });
                        }else if(s[1]+'-'===LOCALSTORAGE_KEY_SEASON){
                            let y;
                            if(s[2]==='') y = -parseInt(s[3]);
                            else y = parseInt(s[2]);
                            let obj = {};
                            obj.format = FORMAT_WITH_SAVED_SEASONS;
                            obj.saveName = name;
                            obj.season = y;
                            obj.value = localStorage.getItem(k);
                            db.seasons.where('[saveName+season]').equals([name,y]).count().then(c=>{
                                if(c<1) db.seasons.put(obj);
                            });
                        }
                    }
                }
            }).then(()=>{
                for(let i=localStorage.length-1;i>=0;i--){
                    let k = localStorage.key(i);
                    if(k.startsWith(LOCALSTORAGE_KEY_PREFIX + LOCALSTORAGE_KEY_SAVEDBASIN)) localStorage.removeItem(k);
                }
            });
        });
    },'正在升级...').catch(e=>{
        console.error(e);
    });
}

document.onfullscreenchange = function(){
    if(document.fullscreenElement===null){
        scaler = 1;
        rescaleCanvases(scaler);
        if(UI.viewBasin){
            refreshTracks(true);
            UI.viewBasin.env.displayLayer();
        }
    }
};