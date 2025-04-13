function geid(id){return document.getElementById(id);}
function curTimeMs(){return Date.now();}
const api = "assets/";
const mapName = "norn_stage";
const spriteCanvas = geid("sprite");
const ctx = spriteCanvas.getContext('2d');
const MB = geid('mainbox');
const mapBox = geid("mapBox");
const mapImg = geid("damap");
const initX = 282; const initY = 857;
var charNames = ['angela', 'athena', 'bunnymaid', 'clive_rebirth', 'elin', 'eva', 'eva_rebirth', 'fred', 'fred_rebirth', 'hayate', 'hayate_rebirth', 'joan', 'joan_rebirth', 'kanako', 'king', 'kana', 'princess', 'chan\'ge', 'silvia', 'louis', 'magellan', 'monkey_rebirth', 'niss', 'niss_rebirth', 'qlaya', 'roca', 'roca_rebirth', 'rosa', 'sam', 'shasha', 'shasha_rebirth', 'snowgirl', 'venus', 'venus_rebirth', 'victoria', 'victoria_rebirth', 'xaolan', 'xaolan_rebirth', 'noa_ch'];
const dirs = ["N","NE","E","SE","S","SW","W","NW"];
var MapPathData = null;
var drawTimer = null; var stopDraw = false;
const imageFolders = ["base","hairs","head","body","hand","arm","shoes","special","effects"];
const catsOrderN = ["base","arm","shoes","body","hairs","head","special","hand","effects"];
const catsOrderS = ["hand","base","arm","shoes","body","hairs","head","special","effects"];
var PlayersDict = {};
var MainPlayer;
var isMobileView = false;
var lastPostedCharWardrobe = "";
const audioElem = geid("backMusic");
const myColorWorker = new Worker("data/colorWorker.js");

function handleImgError(err,imgN)
{
    console.log('imgerror:',err.target); 
    //imgN.src = "assets/transparent.png";
}
function loadImagesInSequence(images) 
{
    if (!images.length) return;
    let topImgPair = images.shift();
    let img = topImgPair[0];
    if(topImgPair.length==3) 
        img.onload = function(){
            //[p.effectsImgs[n-1],          api+"player/effects/"+value+"/"+n+".png", [name,'effects',  n-1,        colorValue]]
            //[p.av_spriteImgs[param][key], defSrc,                                   [name,'av_sprite',[param,key],colorValue]]
            let c = topImgPair[2];
            setColor(c[0],c[1],c[2],this,c[3]); //setColor(name,dictName,dictIndex,defImg,colorValue)
            loadImagesInSequence(images);
        };
    else img.onload = function(){loadImagesInSequence(images);};
    img.src = topImgPair[1];
}
function saveCache(key,val){localStorage[key] = val;}
function getCache(key){return localStorage[key];}
function hasCache(key){let v=getCache(key); return v && v!=null && v!='null' && v!='undefined';}

class Player 
{
    curNPCname=""; spriteImgs = null; av_spriteImgs = null; av_synced = {}; effectsImgs = [];
    curX=initX; curY=initY; curTargetX=0; curTargetY=0;targetDir="";
    curSpriteName="Static_S_1"; curDirection="S"; lastChangedSprite; nextDirection; curEffectNum=1;
    walkTimer = null; standTimer = null;
    playerMode = false;
    currentMsg = ""; lastMsgShown = 0; msgTimer = null;
    nameWidth = 0;
    currentAction = ""; actionTimer = null;
    curWardrobeRes = "";
    effectsImgSrcAry = []; av_spriteImgSrcAry = [];
    constructor(name, x0, y0, dir0) 
    {
        this.name = name;   
        this.curX = parseInt(x0); this.curY = parseInt(y0);
        this.curDirection = dir0;
        this.nameWidth = ctx.measureText(name).width;
        PlayersDict[name] = this;
    }
    setMsg(m)
    {
        this.currentMsg = m; 
        this.lastMsgShown = curTimeMs();
        if(this.msgTimer!=null) clearTimeout(this.msgTimer);
        let thisP = this;
        this.msgTimer = setTimeout(function(){thisP.currentMsg="";},15000); //15s max show chatbox
    }
    wave()
    {
        if(!this.playerMode || this.currentAction == "wave") return false;
        clearAllPoseTimers(this);
        this.currentAction = "wave"; 
        let p = this;
        this.actionTimer = setInterval(function(){if(document.visibilityState=="visible") animatePose(p,"Wave",2);}, 250);
        return true;
    }
    sit()
    {
        if(this.currentAction!="sit") {clearAllPoseTimers(this);this.currentAction = "sit";}
        let sitDir = this.curDirection;
        if(sitDir.length==1 && !this.playerMode)
        {
            if(sitDir=="N"||sitDir=="S")sitDir+="E";
            else sitDir="S"+sitDir;    
        }
        this.curDirection = sitDir;
        let newName = "Sit_"+sitDir;
        if(newName!=this.curSpriteName)
            this.curSpriteName = newName;
    }
    animateStand()
    {
        clearAllPoseTimers(this);
        this.currentAction = "stand";
        let p = this;
        this.actionTimer = setInterval(function(){if(document.visibilityState=="visible") animatePose(p,"Static",4);}, 250);
    }
    startLoadImages() //load defaults effectsImgSrcAry, av_spriteImgSrcAry, then color it if needed
    {
        loadImagesInSequence(this.effectsImgSrcAry);
        loadImagesInSequence(this.av_spriteImgSrcAry);
    }
}

function deletePlayer(name)
{
    let p = PlayersDict[name];
    clearAllPoseTimers(p);
    if(p.msgTimer!=null) clearInterval(p.msgTimer);
    delete PlayersDict[name];
}

function drawImg(ctx,img,x,y)
{
    try{ctx.drawImage(img,x,y);}
    catch{}
}

function redrawCanvas()
{
    ctx.clearRect(0, 0, spriteCanvas.width, spriteCanvas.height);
    mapBox.scrollTo(MainPlayer.curX-200, MainPlayer.curY-200);
    for(let name in PlayersDict) drawAPlayer(name);
}
function drawAPlayer(n)
{
    let p = PlayersDict[n]; if(!p || p==null) return;
    let curX = p.curX, curY = p.curY;
    let xc = curX-64; let yc = curY-100;//sprite png leg at point 64,100
    if(p.playerMode) 
    {
        let catsOrder = catsOrderN;
        if(p.curDirection.includes("S")) catsOrder = catsOrderS;
        for(let cat of catsOrder)
        {
            if(cat=='effects' && p.effectsImgs.length>0) 
            {
            let yce; if(p.curSpriteName.startsWith('Sit')) yce=yc; else yce=yc-30;
            drawImg(ctx,p.effectsImgs[p.curEffectNum-1],xc,yce); 
            continue;
            }
            if(!p.av_spriteImgs.hasOwnProperty(cat)) continue;
            let imageToDraw = p.av_spriteImgs[cat][p.curSpriteName];
            if(!imageToDraw || imageToDraw==null) continue;
            let drawX=xc, drawY=yc;
            if(cat=="hand"){drawX=curX-128; drawY=curY-164;}
            drawImg(ctx,imageToDraw,drawX,drawY);
        } 
    }
    else if(p.spriteImgs != null)
    {
        let imageToDraw = p.spriteImgs[p.curSpriteName];
        if(imageToDraw && imageToDraw!=null)
            drawImg(ctx,imageToDraw,xc,yc);
    }
    
    //draw name
    ctx.fillText(n, curX-(p.nameWidth/2), curY+20);
    //draw chatbox
    if(p.currentMsg!="")
    {
    let words = p.currentMsg.split(' '); let line='', lines=[], maxWidth=80, lineHeight=12;
    for(let n=0; n<words.length; n++) 
    {
        let testLine = line + words[n] + ' ';
        let testWidth = ctx.measureText(testLine).width;
        if (testWidth>maxWidth && n>0) {lines.push(line);line = words[n] + ' ';}
        else line = testLine;
    }
    lines.push(line); let allTextHeight = lineHeight*lines.length, textY = yc+20-allTextHeight;
    ctx.fillStyle='white';ctx.fillRect(curX-(maxWidth/2)-5,yc+20-allTextHeight-lineHeight,maxWidth+5,allTextHeight+5);//fillRect
    ctx.fillStyle='black'; for(let l of lines) {ctx.fillText(l, curX-(maxWidth/2), textY); textY+=lineHeight;}
    
    }
    
}

function clearAllPoseTimers(p)
{
    if(p.walkTimer!=null) clearInterval(p.walkTimer);
    if(p.standTimer!=null) clearInterval(p.standTimer);
    if(p.actionTimer!=null) clearInterval(p.actionTimer);
}

function animatePose(p,actionName,maxFrame)
{
    let curPngName = p.curSpriteName;
    if(curPngName.startsWith(actionName))
    {
    let sn = curPngName;
    let curNum = parseInt(sn.substring(sn.length-1));
    let nextNum; if(curNum==maxFrame) nextNum=1; else nextNum = curNum+1;
    p.curSpriteName = actionName+"_"+p.curDirection+"_"+nextNum;
    }
    else p.curSpriteName = actionName+"_"+p.curDirection+"_1"; //first action frame
    //update effects next frame
    if(p.curEffectNum==10) p.curEffectNum=1;
    else p.curEffectNum++;
}

function setColor(name,dictName,dictIndex,defImg,colorValue)
{
    let dHeight = defImg.height;
    let dWidth = defImg.width;
    if(dWidth==0) return;
    Promise.all([createImageBitmap(defImg,0,0,dWidth,dHeight)]).then((defBitmap) => {
        myColorWorker.postMessage([name,dictName,dictIndex,defBitmap[0],dWidth,dHeight,colorValue]);
    });
}

myColorWorker.onmessage = (e) => {
    let userName=e.data[0], dictName=e.data[1], dictIndex=e.data[2], newImgBitmap=e.data[3];
    let player = PlayersDict[userName];
    if(player==undefined || player==null || !player) return;
    if(dictName=='av_sprite') player.av_spriteImgs[dictIndex[0]][dictIndex[1]] = newImgBitmap;
    else if(dictName=='effects') player.effectsImgs[dictIndex] = newImgBitmap;
};

function initAvSprite(name)
{
    let p = PlayersDict[name];
    p.playerMode = true;
    let baseType; 
    if(name==MainPlayer.name) {baseType=getCache("base");}
    else baseType = p.av_synced["base"];
    if(!baseType || baseType==null || baseType=="undefined" || baseType=="null") return;
    if(!p.av_spriteImgs || p.av_spriteImgs==null)
    {
        p.av_spriteImgs = {}; p.effectsImgs = [];
        for(let folderName of imageFolders)
        {
            let param = folderName;
            if(param=="effects"){
                for(let n=1; n<=10; n++) p.effectsImgs.push(new Image()); 
                for(let imgE of p.effectsImgs) {
                    imgE.onerror = function(e){handleImgError(e,this);}; 
                    imgE.crossOrigin = 'Anonymous';
                }
                continue;
            }
            p.av_spriteImgs[param] = {};
            for(let dir of dirs){
                for(let i=1; i<=4; i++) p.av_spriteImgs[param]["Static_"+dir+"_"+i] = new Image();
                for(let i=1; i<=4; i++) p.av_spriteImgs[param]["Walk_"+dir+"_"+i] = new Image();
                p.av_spriteImgs[param]["Sit_"+dir] = new Image();
                for(let i=1; i<=2; i++) p.av_spriteImgs[param]["Wave_"+dir+"_"+i] = new Image();
            }
            for(let key in p.av_spriteImgs[param]) {
                let img=p.av_spriteImgs[param][key]; 
                img.onerror = function(e){handleImgError(e,this);}; 
                img.crossOrigin = 'Anonymous';
            }
        }
    }
    p.effectsImgSrcAry = []; p.av_spriteImgSrcAry = [];
    for(let folderName of imageFolders)
    {
        let param = folderName, value, colorValue;
        let colorparam = param=='base'? 'av_base':param;
        if(name==MainPlayer.name) 
        {
            value = getCache(param); 
            colorValue = getCache('color-'+colorparam);
        }
        else 
        {
            value = p.av_synced[param]; 
            colorValue = p.av_synced['color-'+colorparam];
        }
        if(param=="effects")
        {
            if(value && value!=null && value!='null') 
            {
                if(p.effectsImgs.length==0) for(let n=1; n<=10; n++) p.effectsImgs.push(new Image());
                if(colorValue && colorValue!=null && colorValue!='null')  //have color, dont put defsrc
                    for(let n=1; n<=10; n++) p.effectsImgSrcAry.push([p.effectsImgs[n-1], api+"player/effects/"+value+"/"+n+".png", [name,'effects',n-1,colorValue]]);
                else for(let n=1; n<=10; n++) p.effectsImgSrcAry.push([p.effectsImgs[n-1], api+"player/effects/"+value+"/"+n+".png"]); //no recolor, use defsrc
            }
            else p.effectsImgs = [];
            continue;
        }
        let imgpath;
        if(!value || value==null || value=="undefined" || value=="null") imgpath = undefined; //not assigned this category
        else{
            let folder = "/"+param+"/"+value+"/"; if(param=="base") folder = "/base/";
            imgpath =  api+"player/"+baseType+folder;
        }
        
        for(let key in p.av_spriteImgs[param])
        {
            let defSrc = imgpath? imgpath+key+".png" : 'assets/transparent.png'; 
            if(colorValue && colorValue!=null && colorValue!='null') //have color, dont put defsrc
                p.av_spriteImgSrcAry.push([p.av_spriteImgs[param][key], defSrc, [name,'av_sprite',[param,key],colorValue]]);
                //setColor(name,'av_sprite',[param,key],defSrc,colorValue);//(p.av_spriteImgs[param][key], colorValue);
            else p.av_spriteImgSrcAry.push([p.av_spriteImgs[param][key], defSrc]);
            //p.av_spriteImgs[param][key].src = defSrc;//no recolor, use defsrc
        }
    }
    if(name==MainPlayer.name) postWardrobe();
    p.startLoadImages();
}

function changeChar()
{
    let selectedSprite = geid("char").value;
    saveCache("char",selectedSprite);
    initSprite(MainPlayer.name,selectedSprite);
    if(!MainPlayer.playerMode)
    {
        if(MainPlayer.currentAction=="wave") {MainPlayer.animateStand();} //npc does not have wave actions
        if(MainPlayer.currentAction=="sit") MainPlayer.sit(); //reprocess sit for npc
    }
}

function wave(){if(MainPlayer.wave()) postWalk(MainPlayer.curX,MainPlayer.curY);}
function sit(){MainPlayer.sit(); postWalk(MainPlayer.curX,MainPlayer.curY);}

function initSprite(name,selectedSprite)
{
    if(!name || name=="") return;
    let p = PlayersDict[name]; if(!p) return;
    p.lastChangedSprite = curTimeMs();
    if(selectedSprite=="player") {initAvSprite(name);return;}
    p.playerMode = false;
    if(!p.spriteImgs || p.spriteImgs==null)
    {
        p.spriteImgs = {};
        for(let dir of dirs) {
            for(let i=1; i<=4; i++) p.spriteImgs["Static_"+dir+"_"+i] = new Image();
            for(let i=1; i<=4; i++) p.spriteImgs["Walk_"+dir+"_"+i] = new Image();
            if(dir.length!=1) p.spriteImgs["Sit_"+dir] = new Image(); //npc has no N,S,E,W sits
        }
        for(let key in p.spriteImgs) {
            let img=p.spriteImgs[key];
            img.onerror = function(e){handleImgError(e,this);};
            img.crossOrigin = 'Anonymous';
        }
    }
    if(p.curNPCname != selectedSprite) //change sprite NPC
    {
        for(let key in p.spriteImgs) p.spriteImgs[key].src = api+"sprite/"+selectedSprite+"/"+key+".png";
        p.curNPCname = selectedSprite;
        if(lastPostedCharWardrobe!=selectedSprite && name==MainPlayer.name) postWardrobe();
    }
}

function clickedMap(e)
{
    let x = e.offsetX;
    let y = e.offsetY;
    walk(MainPlayer.name,x,y);
}

function getFaceDir(dx,dy)
{
    let faceDir;
    if(dx==0 && dy<0) faceDir="N";
    else if(dx>0 && dy<0) faceDir="NE";
    else if(dx<0 && dy<0) faceDir="NW";
    else if(dx==0 && dy>0) faceDir="S";
    else if(dx>0 && dy>0) faceDir="SE";
    else if(dx<0 && dy>0) faceDir="SW";
    else if(dx>0 && dy==0) faceDir="E";
    else if(dx<0 && dy==0) faceDir="W";
    else faceDir = '';
    return faceDir;
}

function processWalk(name)
{
    let p = PlayersDict[name];
    let curX=p.curX; let curY=p.curY;
    //get the direction to targetXY
    let faceDir = "N";
    let dx = p.curTargetX-curX;
    let dy = p.curTargetY-curY;
    faceDir = getFaceDir(dx,dy);
    if(faceDir=='') faceDir=p.curDirection;
    //get nextXY
    let Nx,Ny,NEx,NEy,Ex,Ey,SEx,SEy,Sx,Sy,SWx,SWy,Wx,Wy,NWx,NWy;
    Nx=curX; Ny=curY-1;
    NEx=curX+1; NEy=curY-1;
    NWx=curX-1; NWy=curY-1;
    Sx=curX; Sy=curY+1;
    SEx=curX+1; SEy=curY+1;
    SWx=curX-1; SWy=curY+1;
    Ex=curX+1; Ey=curY;
    Wx=curX-1; Wy=curY;
    let nextX, nextY;
    switch(faceDir)
    {
    case "N":nextX=Nx;nextY=Ny; break;
    case "NE":nextX=NEx;nextY=NEy; break;
    case "NW":nextX=NWx;nextY=NWy; break;
    case "S":nextX=Sx;nextY=Sy; break;
    case "SE":nextX=SEx;nextY=SEy; break;
    case "SW":nextX=SWx;nextY=SWy; break;
    case "E":nextX=Ex;nextY=Ey; break;
    case "W":nextX=Wx;nextY=Wy; break;
    }
    p.nextDirection = faceDir;
    let reachedTarget = false, reachedDeadEnd = false;
    if(isPath(nextX,nextY)) {p.curX = nextX; p.curY = nextY;}
    else reachedDeadEnd=true;
    //get next sprite name
    if((p.curX==p.curTargetX && p.curY==p.curTargetY) || reachedDeadEnd) //reached target or dead end
    {
        //p.curSpriteName = "Static_"+p.nextDirection; //stop the walk
    p.lastChangedSprite = curTimeMs();
    reachedTarget = true;
    }
    else if(p.curDirection!=p.nextDirection) //change direction, must change sprite
    {
    p.curSpriteName = "Walk_"+p.nextDirection+"_1";
    p.lastChangedSprite = curTimeMs();
    }
    else if((curTimeMs()-p.lastChangedSprite) > 250)
    {
    if(p.curSpriteName.startsWith("Walk") && p.curDirection==p.nextDirection) //same dir, next frame
    {
        let sn= p.curSpriteName;
        let curNum = parseInt(sn.substring(sn.length-1));
        let nextNum;
        if(curNum==4) nextNum=1;
        else nextNum = curNum+1;
        p.curSpriteName=sn.substring(0,sn.lastIndexOf("_")+1)+nextNum;
    }
    else p.curSpriteName = "Walk_"+p.nextDirection+"_1"; //change direction
    p.lastChangedSprite = curTimeMs();
    
    //update effects next frame
    if(p.curEffectNum==10) p.curEffectNum=1;
    else p.curEffectNum++;
    }     
    //else no change to sprite name
    p.curDirection = p.nextDirection;
    if(reachedTarget) 
    {
    p.animateStand();
    if(p.name==MainPlayer.name)
    {
        if(reachedDeadEnd) postWalk(curX,curY);
        else postWalk(p.curTargetX,p.curTargetY);
    }
    else //other player
    {
        if(p.targetDir!="") p.curDirection = p.targetDir;
        if(reachedDeadEnd)//jump to that target if stucked
        {
        p.curX = p.curTargetX;
        p.curY = p.curTargetY;
        }
    }
    clearInterval(p.walkTimer);
    p.walkTimer=null;
    }
}

function walk(name, targetX, targetY)
{
    let p = PlayersDict[name]; if(!p || p==null) return;
    if(p.curX==targetX && p.curY==targetY) return;
    clearAllPoseTimers(p);
    p.curTargetX=targetX;
    p.curTargetY=targetY;
    p.currentAction = "stand";
    p.walkTimer = setInterval(function() {processWalk(name);}, 10); // executed every 10 milliseconds = 100 pixel per second (speed)
}

function sitFacing(e)
{
    let targetX = e.offsetX;
    let targetY = e.offsetY;
    if(!MainPlayer.curSpriteName.startsWith('Sit') && !MainPlayer.curSpriteName.startsWith('Wave')) return;
    let dx = targetX-MainPlayer.curX;
    let dy = targetY-MainPlayer.curY;
    let faceDir = getFaceDir(dx,dy);
    if(faceDir!='') MainPlayer.curDirection = faceDir;
    if(MainPlayer.curSpriteName.startsWith('Sit')) MainPlayer.sit();
    else if(MainPlayer.curSpriteName.startsWith('Wave')) MainPlayer.wave();
    postWalk(MainPlayer.curX, MainPlayer.curY);
}

function initMapPath()
{
    let image = new Image();
    image.onload = function() {
        let canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        let context = canvas.getContext('2d');
        drawImg(context,image, 0, 0);
        MapPathData = context.getImageData(0, 0, canvas.width, canvas.height);
    };
    image.crossOrigin = "Anonymous";
    image.src = api+"path/"+mapName+"_path.png";
}
function initMapColliders()
{
    let cImg = geid("colliders");
    cImg.onerror = function(e){handleImgError(e,this);};
    cImg.src = api+"colliders/"+mapName+"_colliders.png";
}
function isPath(x,y)
{
    if(MapPathData==null) return true;
    let index = (y*MapPathData.width + x) * 4;
    //let r = MapPathData.data[index];let g = MapPathData.data[index+1];let b = MapPathData.data[index+2];
    let alpha = MapPathData.data[index + 3];
    return (alpha==255);
}

function goToWardrobe(){window.open("https://playwlo.blogspot.com/p/wardrobe.html");}

function getTime(){return new Date().toLocaleString();}
function cooldown(yes) {geid("chatinput").disabled=yes; if(!yes && !isMobileView) geid("chatinput").focus();}
function getApi(method)
{
    let xhr = new XMLHttpRequest();
    xhr.open("POST", "https://immpythan.pythonanywhere.com/"+method);
    return xhr;
}
function hasUserName(){let userName=MainPlayer.name; return (userName && userName!=null && userName!="");}

function syncOnlineData()
{
    if(!hasUserName()) return;
    let xhr = getApi("fetchWloDatas");
    let formData = new FormData();
    formData.append("id", MainPlayer.name);
    formData.append("map", mapName);
    formData.append("lastseen", new Date());
    formData.append("lastFetchedChat", LastRetrievedChatTime);
    xhr.onload = function()
    {
    let resJson = JSON.parse(xhr.responseText);
    //load chats
    let chatsAry = resJson.chatsAry; //may include own msg
    for(let aChat of chatsAry)
    {
        if(aChat.id==MainPlayer.name) continue; //already set locally
        if(aChat.id in PlayersDict) PlayersDict[aChat.id].setMsg(aChat.msg);
    }
    LastRetrievedChatTime = resJson.fetchTime;
    //load other sprites walk
    let xyAry = resJson.xyAry;
    let onlineNames = [];
    for(let a of xyAry)
    {
        let p; let name = a.id; onlineNames.push(name); let dir=a.direction;
        if(!(name in PlayersDict)) {p = new Player(name,a.posX,a.posY,dir);}
        else 
        { //existing player
        p = PlayersDict[name];
        let pX = parseInt(a.posX), pY = parseInt(a.posY);
        let act=a.action;
        if(act=="wave"){p.curX=pX;p.curY=pY;if(dir)p.curDirection=dir;p.wave();}
        else if(act=="sit") {p.curX=pX;p.curY=pY;if(dir)p.curDirection=dir;p.sit();}
        else if(p.curTargetX!=pX || p.curTargetY!=pY) {if(dir)p.targetDir=dir;walk(name, pX, pY);}
        }
    }
    //delete names that not exist in xyAry
    for(let n in PlayersDict) if(n!=MainPlayer.name && !onlineNames.includes(n)) deletePlayer(n);
    //load other sprites wardrobe 
    let wardrobeAry = resJson.wardrobeAry;
    for(let aW of wardrobeAry)
    { 
        if(!(aW.id in PlayersDict)) continue;
        let nameW = aW.id;
        let pW = PlayersDict[aW.id];
        //check if current wardrobe same
        if(JSON.stringify(pW.curWardrobeRes)===JSON.stringify(aW)) continue; //no need to initplayer that is same wardrobe
        for(let param of imageFolders) 
        {
        if(aW.hasOwnProperty(param)) pW.av_synced[param] = aW[param]; 
        else pW.av_synced[param]=null;
        if(aW.hasOwnProperty('color-'+param)) pW.av_synced['color-'+param] = aW['color-'+param];
        }
        if(aW.hasOwnProperty('color-av_base')) pW.av_synced['color-av_base'] = aW['color-av_base']; 
        initSprite(nameW,aW.char);
        pW.curWardrobeRes = aW; console.log('inited '+aW.id);
    }
    };
    xhr.send(formData);
}
function postWalk(x,y)
{
    if(!hasUserName()) return;
    let xhr = getApi("saveWloData");
    let formData = new FormData();
    formData.append("id", MainPlayer.name);
    formData.append("folder", "walkData");
    formData.append("map", mapName);
    formData.append("posX", x); formData.append("posY", y);
    formData.append("action", MainPlayer.currentAction);
    formData.append("direction", MainPlayer.curDirection);
    xhr.send(formData);
}
function postWardrobe() 
{
    if(!hasUserName()) return;
    let xhr = getApi("saveWloData");
    let formData = new FormData();
    formData.append("id", MainPlayer.name);
    formData.append("folder", "wardrobeData");
    let curChar = geid("char").value; 
    formData.append("char", curChar);
    if(curChar=="player") 
    {
    for(let param in MainPlayer.av_spriteImgs) 
    {
        formData.append(param, getCache(param));
        if(hasCache('color-'+param)) {formData.append('color-'+param, getCache('color-'+param));}
    }
    if(MainPlayer.effectsImgs.length>0) formData.append('effects', getCache('effects'));
    if(hasCache('color-effects')) formData.append('color-effects', getCache('color-effects'));
    if(hasCache('color-av_base')) formData.append('color-av_base', getCache('color-av_base'));
    }
    xhr.send(formData); lastPostedCharWardrobe = curChar;
}
function postChat(chatmsg) 
{
    if(!hasUserName()){
    alert("To post chats, enter your name in the textfield below map then try to enter chat again :)");
    return;
    }
    cooldown(true);
    MainPlayer.setMsg(chatmsg);
    let xhr = getApi("saveWloData");
    let formData = new FormData();
    formData.append("id", MainPlayer.name);
    formData.append("folder", "chatsData");
    formData.append("map", mapName);
    formData.append("msg", chatmsg);
    xhr.send(formData);
    setTimeout(function() {cooldown(false);geid("chatinput").value = ""; }, 3000); //enable input after 3s
    if(isMobileView) window.scrollTo(0, 0);
}

function initSpriteDropDown()
{
    let dropdown = geid("char");
    charNames.sort();
    for(let v of charNames)
    {
    let option = document.createElement("option");
    option.value = v;
    let labelText = v.charAt(0).toUpperCase() + v.slice(1);
    labelText = labelText.replace("_rebirth"," (R)");
    option.text = labelText;
    dropdown.add(option);
    }
    let savedBase = getCache("base");
    if(savedBase && savedBase!==null && savedBase!="null") 
    {
    let option = document.createElement("option");
    option.value = "player";
    option.text = "Player";
    dropdown.add(option, dropdown[0]);
    dropdown.value = "player";
    }
    else
    { 
    let savedC = getCache("char");
    if(savedC && charNames.includes(savedC)) dropdown.value = savedC;
    else dropdown.value = "bunnymaid";
    }
}
function refreshMainboxSize(){MB.style.height = (window.innerHeight - MB.getBoundingClientRect().top -10) +'px';}
function startDrawTimer(){drawTimer = setInterval(function(){if(document.visibilityState=="visible") redrawCanvas();}, 20);} //draw 30 frames per second}
function SetName()
{
    saveCache("name", geid("nameInput").value);
    geid('enterNameDialog').close();
    initView();
}
function initView()
{
    let userName = getCache("name"); 
    if(!userName || userName==null || userName=="") 
    {
    geid('enterNameDialog').showModal();
    return;
    }
    geid("name").value = userName;
    let urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has("char")) saveCache("char", urlParams.get("char")); //site is from wardrobe -> override saved cache
    if(urlParams.has("m")) isMobileView = true;
    MainPlayer = new Player(userName, initX, initY,"S"); postWalk(initX,initY);
    
    mapImg.onload = function()
    {
        mapImg.scrollTo(initX-200,initY-200);
        spriteCanvas.height = mapImg.height;
        spriteCanvas.width = mapImg.width;
        mapBox.style.maxHeight = mapImg.height +'px';
        geid("clickable").height = mapImg.height;
        geid("clickable").width = mapImg.width;
        initSpriteDropDown(); 
        ctx.font = `12px Verdana`;
        initSprite(MainPlayer.name,geid("char").value);
        startDrawTimer();
    };
    mapImg.src = api+"map/"+mapName+".jpg";
    //map clicks
    let clickableCanvas = geid("clickable");
    clickableCanvas.addEventListener("click",clickedMap); //left click/touch
    clickableCanvas.oncontextmenu = (e) => {sitFacing(e);}; //right click
    
    initMapPath(); //initMapColliders();
    
    setInterval(function(){if(document.visibilityState=="visible") syncOnlineData();}, 2000); // sync online every 2 seconds if(document.hasFocus())
    
    geid("chatinput").addEventListener("keyup", ({key}) => {if (key==="Enter") {postChat(geid("chatinput").value);} });
    document.oncontextmenu=function(){return false;};
}
var LastRetrievedChatTime = new Date().getTime() / 1000; //init to time now
window.onresize = function(){refreshMainboxSize(); mapBox.scrollTo(MainPlayer.curX-200, MainPlayer.curY-200);}; refreshMainboxSize();
initView();
