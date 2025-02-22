const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

canvas.width = document.body.offsetWidth;
canvas.height = document.body.offsetHeight;

/** @type {HTMLCanvasElement} */
const uiCanvas = document.querySelector('canvas#UI_canvas');
const uiCtx = uiCanvas.getContext('2d');

uiCanvas.width = canvas.width;
uiCanvas.height = canvas.height;

document.addEventListener("dragover", (e)=> {
    e.preventDefault();
});

let isMouseDown = false;

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

document.addEventListener('mousedown', () => {
    isMouseDown = true;
});

document.addEventListener('mouseup', () => {
    isMouseDown = false;
});

let currentDisplayedData = {};

document.addEventListener('mousemove', (e) => {
    if (isMouseDown){
        uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
        let posX = e.clientX;
        let x = e.clientX - marginLeft;
        let xProcentage = clamp((x / (canvas.width - marginRight)), 0, 1);    

        if (currentLoadedBounds){
            let d = currentLoadedBounds;
            let currDataSize = d.finish - d.start;
            let currIndex = Math.floor(currDataSize * xProcentage);
            let update = currLoadedData.frameData[currIndex];
    
            uiCtx.fillStyle = 'white';
            
            uiCtx.fillText(update.currentTool || update.name, posX, 320); 
            uiCtx.fillRect(posX, 320, 1, 220);
            
            
            let dataToDisplay = getThingsAroundIndex(currIndex, 5);

            let windowX = 16;
            let windowY = 750;

            uiCtx.beginPath();
            uiCtx.fillStyle = 'gray';
            uiCtx.strokeStyle = 'red';

            uiCtx.rect(windowX, windowY, 200, 200);
            uiCtx.fill();
            uiCtx.stroke();
            uiCtx.closePath();

            uiCtx.fillStyle = 'black';
            uiCtx.font = '16px Arial';

            let distFromTop = 24;

            uiCtx.fillText(update.currentTool || update.name, windowX + 4, windowY + 16);
            uiCtx.fillRect(windowX, windowY + 24, 200, 2);
            if (dataToDisplay.selectionData){
                distFromTop += 16;
                uiCtx.fillText('selection data: ', windowX + 4, windowY + distFromTop);
                distFromTop += 16;
                uiCtx.fillText(`start: x ${dataToDisplay.selectionData.start.x} y ${dataToDisplay.selectionData.start.y}` , windowX + 4, windowY + distFromTop);
                distFromTop += 16;
                uiCtx.fillText(`size: x ${dataToDisplay.selectionData.size.x} y ${dataToDisplay.selectionData.size.y}` , windowX + 4, windowY + distFromTop);
                distFromTop += 16;
                uiCtx.fillText(`offset: x ${dataToDisplay.selectionData.offset.x} y ${dataToDisplay.selectionData.offset.y}` , windowX + 4, windowY + distFromTop);
            }
            for (let i = 0; i < dataToDisplay.errs.length; i++){
                console.log(dataToDisplay.errs[i]);                                
            }

            currentDisplayedData = update;
        }
    }
});

// gets the element as one object getting as much data as possible from all of them
function getThingsAroundIndex(index, amm){
    let data = {errs: [], ums: []};
    for (let i = index-amm; i < index+amm; i++){
        let f = currLoadedData.frameData[i];
        if (f){
            if (!data.selectionData) data.selectionData = f.selectionData;
            if (f.name == 'undoManager') data.ums.push({
                action: f.action,
                toolName: f.toolName
            });
            if (f.name == 'error') data.errs.push(f.err_message); 
        };
    }
    return data;
}

let firstStartTime = 0;
let firstStartData;
document.addEventListener('drop', (e)=>{
    e.preventDefault();
    const reader = new FileReader();
    if (e.dataTransfer.items){
        //console.log(e.dataTransfer.files);
        [...e.dataTransfer.items].forEach((item, i) => {
            // If dropped items aren't files, reject them
            if (item.kind === 'file') {
                const file = item.getAsFile();
                reader.readAsText(file);
                // console.log();
                reader.addEventListener('load', ()=> {
                    let droppedData = JSON.parse(reader.result);
                    firstStartData = {systemInfo: droppedData.systemInfo, frameData: droppedData.frameData};
                    firstStartTime = getStartTime(droppedData.frameData);
                    handleData(droppedData);
                }, false);
            }
          });
    }
});
let avgFps;
let currentLoadedBounds;

function getStartTime(frameData){
    for (let i = 0; i < frameData.length; i++){
        if (frameData[i].name){
            return frameData[i].time;
        }
    }
}

let testParts = {};

let marginRight = 30;
let marginLeft = 20;
/** @type {Array} */
let currLoadedData;
document.addEventListener('wheel', (e) => {
    let x = e.clientX - marginLeft;
    let xProcentage = clamp((x / (canvas.width - marginRight)), 0, 1);
    let dir = Math.sign(e.deltaY) * -1; // -1 zoom in, 1 zoom out

    if (currentLoadedBounds) {
        let d = currentLoadedBounds;
        let currDataSize = d.finish - d.start;
        let zoomMoveAmm = Math.floor(currDataSize * 0.1); // 10% zoom

        let currentZoomPos = d.start + Math.floor(currDataSize * xProcentage);

        let newStart = currentZoomPos - ((currentZoomPos - d.start) / currDataSize) * (currDataSize - dir * zoomMoveAmm);
        let newFinish = currentZoomPos + ((d.finish - currentZoomPos) / currDataSize) * (currDataSize - dir * zoomMoveAmm);

        // Ensure bounds don't go out of range
        newStart = Math.max(newStart, 0);
        newFinish = Math.min(newFinish, firstStartData.frameData.length);

        let newData = { ...currLoadedData };
        newData.frameData = firstStartData.frameData.slice(Math.floor(newStart), Math.floor(newFinish));

        currentLoadedBounds = {
            start: Math.floor(newStart),
            finish: Math.floor(newFinish)
        };

        handleData(newData);
    }
});

function handleData(data){
    if (!data) return;
    currLoadedData = data;
    if (!currentLoadedBounds) currentLoadedBounds = {
        start: 0,
        finish: data.frameData.length
    };    
    // console.log(data);
    testParts = {
        errors: {arr: []}
    };

    let avgData = getAvgFps(data);
    avgFps = avgData.avgFps;
    let sampleCount = avgData.fpsAmm; 
    let testTime = avgData.testTime;
    let fpsTopMargin = 100;
    let avgFpsArr = avgData.avgFpsArray;
    let fpsBottom = fpsTopMargin+avgFps;
    let timeDiffFromStart = Math.floor((avgData.testTimeStart - firstStartTime) / 1000); // turn it to seconds
    // console.log(timeDiffFromStart);

    console.log('Sample time:', Math.floor(avgData.testTime / 1000) + ' sec');

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    // draw fps lines
    let jump = avgFps < 1 ? 5 : 10;
    let lines = Math.ceil(fpsBottom / jump);
    for (let i = 0; i < lines; i++){
        ctx.fillStyle = '#000000';
        ctx.fillRect(marginLeft,  fpsBottom - i * jump, canvas.width-marginRight, 2);
        ctx.fillStyle = '#ccc';
        // draw fps number
        ctx.font = '10px Arial';
        ctx.fillText((i * jump).toString(), 1, fpsBottom - i * jump+4)            
    }
    
    // ctx.fillStyle = '#ff0000';
    // ctx.fillRect(0,  fpsBottom + 10, canvas.width, 2);
    let fpsAroundAvg = 0;
    let fpsAroundAvgMargin = avgFps * 0.11; //can be x lower or higher

    let dist = (canvas.width-marginRight) / data.frameData.length; 
    let highestFps = 0;
    for (let i = 0; i < data.frameData.length; i++){
        let frame = data.frameData[i];
        let dotPos = dist * i + marginLeft;
        if (frame.name == 'error'){
            testParts.errors.arr.push({
                start: dotPos,
                finish: dotPos + 4,
                data: frame
            })
        }
        if (frame.name == 'update'){    
            ctx.fillStyle = '#00ffff99';
            ctx.fillRect(dotPos, fpsBottom - frame.fps, 3, 3);
            if (highestFps < frame.fps) highestFps = frame.fps;
            construstParts(dotPos, frame, ['isDrawing', 'isPreviewOn', 'currentTool', 'spriteSize', 'isSelected'], i == data.frameData.length-1);
            
            if (frame.fps > avgFps - fpsAroundAvgMargin && frame.fps < avgFps + fpsAroundAvgMargin) fpsAroundAvg++;
        }
        if (frame.name == 'undoManager'){
            construstUndoData(dotPos, frame, i == data.frameData.length-1);
        }
    }   
    // draw hz line
    let monitorHz = data.systemInfo.monitorHz || 0;
    
    if (monitorHz){
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(marginLeft, fpsBottom - monitorHz, canvas.width-marginRight, 2);
    }
    // draw fps avg array lines
    if (avgFpsArr.length){
        let fpsGaps = (canvas.width-marginRight) / (avgFpsArr.length - 1); 
        for (let i = 0; i < avgFpsArr.length; i++){
            let fps = avgFpsArr[i];
            if (i == 0 && fps == 0) fps = avgFpsArr[i+1] || 0;
            ctx.beginPath();
            ctx.fillStyle = '#ff9a00';
            ctx.strokeStyle = '#ff9a00';
            ctx.lineWidth = 2;
            ctx.arc((fpsGaps) * i + marginLeft, Math.ceil(fpsBottom - fps), 4, 0, 360, false);
            ctx.lineTo(fpsGaps * (i+1) + marginLeft, Math.ceil(fpsBottom-avgFpsArr[i+1]));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }

    // draw timeline
    let timeLineTop = 30;
    ctx.fillStyle = '#aa4c00';
    ctx.fillRect(marginLeft, fpsBottom + timeLineTop, canvas.width-marginRight, 2);
    // draw timeLine 
    let timeLineSeconds = Math.round(testTime / 1000);
    let timeMarkGap = (canvas.width - marginRight) / (timeLineSeconds * 2);
    for (let i = 0; i < timeLineSeconds*2+1; i++){
        let lineHeight = 20;

        if (i % 2 == 1) lineHeight = 12;

        ctx.fillRect(marginLeft + timeMarkGap * i, fpsBottom + timeLineTop - lineHeight/2 + 1, 2, lineHeight);
        
        let textWidth = ctx.measureText(i*0.5).width;
        ctx.fillText((i+timeDiffFromStart*2)*0.5, marginLeft + timeMarkGap * i - textWidth/2, fpsBottom + timeLineTop - lineHeight/2 - 2);
    }

    
    // draw fps info
   
    const fpsStability = Math.round(fpsAroundAvg / sampleCount * 100) 
    
    ctx.fillStyle = 'white';
    ctx.font = '15px Arial';
    ctx.fillText(`Samples: ${sampleCount}, Average FPS: ${avgFps}, Monitor Hz: ${monitorHz}, FPS Stability ${fpsStability}%`, 10, fpsBottom + 60);


    let toolColors = {
        rectangle: '#9000ff',
        pensil: '#ff5050',
        select: '#0050ff',
        ellipse: '#547525',
        eraser: '#cccccc',
        color_picker: '#1d1d1d',
        line: 'purple',
        handTool: 'green'
    };

    let sections = Object.keys(testParts);
    let colors = ['#ff0000', '#0000ff', '#00ffff', '#000000', '#000000', '#54eb24'];
    // make nice sections
    for (let index = 0; index < sections.length+1; index++){
        let sect = sections[index];
        ctx.fillStyle = '#000000';
        let barHeight = 30;
        let lineThic = 2;
        let x = fpsBottom + index*barHeight;
        let marginTop = 80;
        ctx.fillRect(marginLeft, marginTop+x, canvas.width-marginRight, lineThic);
        
        if (sect){
            // if (testParts[sect].start !== undefined && testParts[sect].finish === undefined){
            //     testParts[sect].arr.push({start: testParts[sect].start, finish:})
            // }
            let spriteSizeColors = ['#7b8100', '#cb3981', '#746eae'];
            let spriteSizeColorIndex =  0;
            for (let part of testParts[sect].arr){
                // console.log(part, sect);
                if (!part.finish) part.finish = canvas.width;
                let width = part.finish - part.start;
                let color = part.color || colors[index];
                if (sect == 'spriteSize'){
                    color = spriteSizeColors[spriteSizeColorIndex];
                    spriteSizeColorIndex++;
                    spriteSizeColorIndex = spriteSizeColorIndex % spriteSizeColors.length;
                }
                if (sect == 'currentTool' && toolColors[part.data]) color = toolColors[part.data];  
                ctx.fillStyle = color;
                ctx.fillRect(part.start, marginTop+lineThic+x, width, barHeight - lineThic);
                if (sect == 'currentTool'){
                    ctx.fillStyle = 'white';
                    let textWidth = ctx.measureText(part.data).width;
                    ctx.fillText(part.data, part.start+width/2 - textWidth/2, marginTop+lineThic+x+20) 
                }
                if (sect == 'spriteSize'){
                    ctx.fillStyle = 'white';
                    let text = part.data.x + ' x '+part.data.y;
                    let textWidth = ctx.measureText(text).width;
                    ctx.fillText(text, part.start+width/2 - textWidth/2, marginTop+lineThic+x+20) 
                }
            }
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, marginTop-7+x, 70, 15);
            ctx.font= '12px Arial';
            ctx.fillStyle = 'white';
            ctx.fillText(sect, 5, marginTop+4+x)
        }
    }
    // draw isDrawing section

}
function construstParts(dotPos, frame, valuesToCheck = [], isLast){
    for (let i = 0; i < valuesToCheck.length; i++){
        let val = valuesToCheck[i];
        if (!testParts[val]) testParts[val] = {
            arr: [],
        }
        let testP = testParts[val];
        if (frame[val] && testP.start === undefined){
            testP.start = dotPos;
            testP.lastValue = frame[val];
        }
        if (testP.start !== undefined && (compareValues(frame[val],testP.lastValue) == false || isLast)) {
            testP.finish = dotPos;
            testP.arr.push({start: Math.round(testP.start), finish: Math.ceil(testP.finish), data: testP.lastValue});
            delete testP.start;
            delete testP.finish;
            delete testP.lastValue;
        }
    }
}
function construstUndoData(dotPos, frame, isLast){
    if (!testParts['undo/redo']) testParts['undo/redo'] = { arr: []};
    let s = testParts['undo/redo'];
    console.log(frame);
    s.arr.push({
        start: dotPos,
        finish: dotPos+4,
        action: frame.action,
        tool: frame.toolName,
        color: frame.action == 'undo' ? '#5a90ff' : '#50ff90'
    });
}
function getAvgFps(data){
    let fpsSum = 0;
    let fpsAmm = 0;
    let testTimeStart = 0;
    let testTime = 0;
    let avgFpsArray = [];
    let lastTimeShownFps;
    let lastFrame;
    for (let i = 0; i < data.frameData.length; i++){
        let frame = data.frameData[i];
        if (frame.name == 'update' && frame.fps){
            if (!testTimeStart) testTimeStart = frame.time;
            testTime = frame.time - testTimeStart;
            fpsSum += frame.fps; 
            fpsAmm++;
            lastFrame = frame;
            if (lastTimeShownFps === undefined || frame.time - lastTimeShownFps > 1000){
                frame.wasPushed = true;
                lastTimeShownFps = frame.time;
                avgFpsArray.push(frame.avgFps);
            }
        }
    }
    if (!lastFrame.wasPushed){
        avgFpsArray.push(lastFrame.avgFps);
    }
    let avgFps = Math.ceil(fpsSum / fpsAmm); 
    return { avgFps, fpsAmm, testTime, avgFpsArray, testTimeStart};
}

function compareValues(a, b){
    if (typeof a == 'object' && typeof b == 'object'){
        let keys = Object.keys(a);
        let same = true;
        for (let k of keys){
            if (a[k] !== b[k]) same = false;
        }
        return same;
    }else{
        return a == b;
    }
}

if (testData){
    firstStartTime = getStartTime(testData.frameData);
    firstStartData = {systemInfo: testData.systemInfo, frameData: testData.frameData};
    handleData(testData);
}


function clamp(value, min, max){
    return Math.max(Math.min(value, max), min);
}