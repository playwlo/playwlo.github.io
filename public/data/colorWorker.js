onmessage = (e) => {
    changeColor(e.data[0],e.data[1],e.data[2],e.data[3],e.data[4],e.data[5],e.data[6]);
};


function changeColor(userName,dictName,dictIndex,defBitmap,dWidth,dHeight,savedC)
{
    let colorCV = new OffscreenCanvas(dWidth,dHeight);
    let ctx = colorCV.getContext('2d');
    ctx.drawImage(defBitmap,0,0,dWidth,dHeight);
    let imageData = ctx.getImageData(0, 0, colorCV.width, colorCV.height);
    let data = imageData.data;
    let cary = savedC.split(',');
    let dR=cary[0], dG=cary[1], dB=cary[2];
    for (let i=0; i<data.length; i+=4) 
    {
        let newR = data[i]+(data[i]*(dR/100));
        if(newR<0) newR=0; else if(newR>255) newR=255;
        data[i] = newR;
        let newG = data[i+1]+(data[i+1]*(dG/100));
        if(newG<0) newG=0; else if(newG>255) newG=255;
        data[i+1] = newG;
        let newB = data[i+2]+(data[i+2]*(dB/100));
        if(newB<0) newB=0; else if(newB>255) newB=255;
        data[i+2] = newB;
    }
    ctx.putImageData(imageData, 0, 0);
    postMessage([userName,dictName,dictIndex,colorCV.transferToImageBitmap()]); //return the new colored transferable img bitmap
}