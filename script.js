const fileInput = document.getElementById("file-input");
const img = document.getElementById("pic");
const brightnessInput = document.getElementById("brightness-input");
const origPic = document.getElementById("orig-pic");
const historyDiv = document.getElementById("history");
const brushContainer = document.getElementById("brush-container");
const brushButton = document.getElementById("brush-button");
const undoButton = document.getElementById("undo-btn");
const redoButton = document.getElementById("redo-btn");
const cropButton = document.getElementById("crop-btn");
const cropInfo = document.getElementById("crop-info");
const selectButton = document.getElementById("select-btn");
const selectInfo = document.getElementById("select-info");

let history = [];
let historyData = [];
let redoData = [];
let redoHistory = [];
let isBrushOn = false;
let isCropOn = false;
let isSelectOn = false;
let cropPoints = [];
let selectPoints = [];

let brushCanvas = document.querySelector("#brush-canvas");
let brushCtx;

let isDrawing = false;
let lastX = 0;
let lastY = 0;

const curvesCanvases = {
  R: document.getElementById("curves-r"),
  G: document.getElementById("curves-g"),
  B: document.getElementById("curves-b"),
};
const curvesCtxs = {
  R: curvesCanvases.R.getContext("2d"),
  G: curvesCanvases.G.getContext("2d"),
  B: curvesCanvases.B.getContext("2d"),
};
let curvesPoints = { R: { x: 0, y: 0 }, G: { x: 0, y: 0 }, B: { x: 0, y: 0 } };
let curveBuckets;

for (const [color, ctx] of Object.entries(curvesCtxs)) {
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(0, 100);
  ctx.lineTo(255, 0);
  ctx.stroke();
}

brightnessInput.addEventListener("input", e => {
  const span = document.getElementById("brightness-val");
  span.innerHTML = parseFloat(e.target.value).toFixed(2);

  let value =
    ((e.target.value - e.target.min) / (e.target.max - e.target.min)) * 100;
  e.target.style.background =
    "linear-gradient(to right, #82CFD0 0%, #82CFD0 " +
    value +
    "%, #fff " +
    value +
    "%, white 100%)";
});

brightnessInput.addEventListener("change", e => {
  applyEffect("brightness");
});

function generateBucketsByColor(data, numOfBuckets) {
  let range = Math.floor(255 / numOfBuckets);
  let buckets = { R: {}, G: {}, B: {} };

  for (let i = 0; i < numOfBuckets; i++) {
    buckets["R"][i] = 0;
    buckets["G"][i] = 0;
    buckets["B"][i] = 0;
  }

  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) {
      continue;
    } // preskoci alfa kanal

    let bucket = Math.floor(data[i] / range);
    if (bucket >= numOfBuckets) bucket = numOfBuckets - 1;

    if ((i + 1) % 4 == 1) {
      // R
      buckets["R"][bucket]++;
    } else if ((i + 1) % 4 == 2) {
      // G
      buckets["G"][bucket]++;
    } else if ((i + 1) % 4 == 3) {
      // B
      buckets["B"][bucket]++;
    }
  }

  let chartBuckets = { R: [], G: [], B: [] };

  for (const [color, tmpBuckets] of Object.entries(buckets)) {
    for (const [bucket, amount] of Object.entries(tmpBuckets)) {
      const startVal = bucket === 0 ? range * bucket : range * bucket + 1;
      const endVal = startVal + range - 1;

      chartBuckets[color].push({
        label: `${startVal}-${endVal}`,
        y: amount,
        // x: startVal,
      });
    }
  }

  return chartBuckets;
}

fileInput.addEventListener("change", e => {
  const img = document.getElementById("pic");
  img.src = URL.createObjectURL(e.target.files[0]);
  origPic.src = img.src;

  if (img.src === "") return;

  setTimeout(() => {
    const tmpCanvas = document.createElement("canvas");
    const tmpCtx = tmpCanvas.getContext("2d");

    tmpCanvas.height = img.naturalHeight;
    tmpCanvas.width = img.naturalWidth;

    tmpCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

    const imgData = tmpCtx.getImageData(
      0,
      0,
      img.naturalWidth,
      img.naturalHeight
    ); //podatki o sliki

    tmpCtx.putImageData(imgData, 0, 0);

    let image = new Image();
    image.id = "pic2";
    image.src = tmpCanvas.toDataURL();

    makeHistogram(imgData.data);
    curveBuckets = generateBucketsByColor(imgData.data, 255);
    drawCurveHistogram("R");
    drawCurveHistogram("G");
    drawCurveHistogram("B");
    history = [];
    historyData = [img.src];
    redoData = [];
    redoHistory = [];
    buildHistory();
  }, 100);
});

function applyEffect(effect) {
  const tmpCanvas = document.createElement("canvas");
  const tmpCtx = tmpCanvas.getContext("2d");

  tmpCanvas.height = img.naturalHeight;
  tmpCanvas.width = img.naturalWidth;

  tmpCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

  let imgData;
  if (selectPoints.length < 2) {
    imgData = tmpCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight); //podatki o sliki
  } else {
    let x = selectPoints[0][0];
    let y = selectPoints[0][1];
    let w = selectPoints[1][0] - x;
    let h = selectPoints[1][1] - y;

    imgData = tmpCtx.getImageData(x, y, w, h); //podatki o sliki
  }
  let data = imgData.data; //pridobimo array pikslov

  // if (effect == "threshold") {
  // let val = document.getElementById("threshold-val").innerText;
  // if (isNaN(val) || val < 0 || val > 255) val = 125;
  // history.push(["threshold", val]);
  // } else if (effect != "brightness") history.push(effect);
  history.push(effect);

  buildHistory();

  // history.forEach(el => {
  //   if (Array.isArray(el) && el[0] == "threshold") {
  //     setTreshold(data, el[1]);
  //     return;
  //   }

  switch (effect) {
    case "grayscale":
      setGrayscale(data);
      break;
    case "brightness":
      setBrightness(data, brightnessInput.value);
      break;
    case "threshold":
      let val = document.getElementById("threshold-val").innerText;
      if (isNaN(val) || val < 0 || val > 255) val = 125;
      setTreshold(data, val);
      break;
    case "rc-red":
    case "rc-green":
    case "rc-blue":
      removeColorChannels(data, {
        red: effect.split("-")[1] === "red" ? true : false,
        green: effect.split("-")[1] === "green" ? true : false,
        blue: effect.split("-")[1] === "blue" ? true : false,
      });
      break;
    case "ec-red":
    case "ec-green":
    case "ec-blue":
      enhanceColorChannel(data, {
        red: effect.split("-")[1] === "red" ? true : false,
        green: effect.split("-")[1] === "green" ? true : false,
        blue: effect.split("-")[1] === "blue" ? true : false,
      });
      break;

    case "box-blur":
      kernelFunc(
        data,
        img.naturalWidth,
        img.naturalHeight,
        [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
        ],
        9
      );
      break;

    case "g-blur":
      kernelFunc(
        data,
        img.naturalWidth,
        img.naturalHeight,
        [
          [1, 2, 1],
          [2, 4, 2],
          [1, 2, 1],
        ],
        16
      );
      break;
    case "laplace":
      kernelFunc(
        data,
        img.naturalWidth,
        img.naturalHeight,
        [
          [0, 1, 0],
          [1, -4, 1],
          [0, 1, 0],
        ],
        1
      );
      break;
    case "sobel":
      let tmpData1 = data.slice();

      let tmpData2 = data.slice();
      kernelFunc(
        tmpData1,
        img.naturalWidth,
        img.naturalHeight,
        // sobel navpicno
        [
          [1, 0, -1],
          [2, 0, -2],
          [1, 0, -1],
        ],
        1
      );

      kernelFunc(
        tmpData2,
        img.naturalWidth,
        img.naturalHeight,
        // sobel vodoravno
        [
          [1, 2, 1],
          [0, 0, 0],
          [-1, -2, -1],
        ],
        1
      );

      joinSobel(tmpData1, tmpData2, data);
      break;
    case "sharpening":
      let robovi = data.slice();

      kernelFunc(
        robovi,
        img.naturalWidth,
        img.naturalHeight,
        [
          [0, 1, 0],
          [1, -4, 1],
          [0, 1, 0],
        ],
        1
      );

      for (let i = 0; i < data.length; i++) {
        if ((i + 1) % 4 === 0) {
          continue;
        } // preskoci alfa kanal
        data[i] = data[i] - robovi[i];
        if (data[i] > 255) data[i] = 255;
        if (data[i] < 0) data[i] = 0;
      }
      break;
    case "unsharp-masking":
      const blur = data.slice();

      kernelFunc(
        blur,
        img.naturalWidth,
        img.naturalHeight,
        // box blur
        [
          [1, 1, 1],
          [1, 1, 1],
          [1, 1, 1],
        ],
        9
      );

      const origMinusBlur = data.slice();

      // odstej blur od originala
      for (let i = 0; i < data.length; i++) {
        // preskoci alfa kanal
        if ((i + 1) % 4 === 0) {
          origMinusBlur[i] = data[i];
          continue;
        }

        if (data[i] - blur[i] >= 0) origMinusBlur[i] = data[i] - blur[i];
        else origMinusBlur[i] = 0;
      }

      // originalu pristej origMinusBlur
      for (let i = 0; i < data.length; i++) {
        if ((i + 1) % 4 === 0) {
          continue;
        } // preskoci alfa kanal
        data[i] = data[i] + origMinusBlur[i];
        if (data[i] > 255) data[i] = 255;
      }

      break;
    case "custom-kernel":
      const inputs = document.getElementsByClassName("kernel-input-el");
      const size = Math.sqrt(inputs.length);
      const vals = [];

      for (let i = 0; i < size; i++) {
        vals.push([]);
        for (let j = 0; j < size; j++) {
          let val = inputs[i * size + j].innerText;
          if (isNaN(val)) val = 1;
          vals[i].push(val);
        }
      }

      let div = document.getElementById("divisor").innerText;
      if (isNaN(div)) div = 1;

      kernelFunc(data, img.naturalWidth, img.naturalHeight, vals, div);
      break;
    case "curves-r":
      applyCurve(data, "R");
      break;
    case "curves-g":
      applyCurve(data, "G");
      break;
    case "curves-b":
      applyCurve(data, "B");
      break;
  }
  // });

  // setBrightness(data, brightnessInput.value);

  if (selectPoints.length < 2) {
    tmpCtx.putImageData(imgData, 0, 0);
  } else {
    let x = Math.min(selectPoints[0][0], selectPoints[1][0]);
    let y = Math.min(selectPoints[0][1], selectPoints[1][1]);
    tmpCtx.putImageData(imgData, x, y);
  }

  // let image = new Image();
  // image.id = "pic2";
  // image.src = tmpCanvas.toDataURL();

  img.src = tmpCanvas.toDataURL();

  historyData.push(tmpCanvas.toDataURL());
  redoData = [];
  redoHistory = [];
  redoButton.disabled = true;

  makeHistogram(data);
  curveBuckets = generateBucketsByColor(imgData.data, 255);
  drawCurveHistogram("R");
  drawCurveHistogram("G");
  drawCurveHistogram("B");
}

function buildHistory() {
  historyDiv.innerHTML = "";

  history.forEach((el, index) => {
    const historyEl = document.createElement("div");
    historyEl.classList.add("history-el");

    historyEl.innerHTML = index + 1 + " - " + el;
    historyDiv.appendChild(historyEl);
  });

  if (history.length > 0) undoButton.disabled = false;
}

function clearHistory() {
  img.src = historyData[0];
  history = [];
  historyData = [];
  redoData = [];
  redoHistory = [];
  buildHistory();

  undoButton.disabled = true;
  redoButton.disabled = true;
}

function undo() {
  img.src = historyData[historyData.length - 2];
  redoHistory.push(history.pop());
  redoData.push(historyData.pop());

  redoButton.disabled = false;

  if (history.length == 0) undoButton.disabled = true;

  buildHistory();

  // posodobi histograme
  const tmpCanvas = document.createElement("canvas");
  const tmpCtx = tmpCanvas.getContext("2d");
  tmpCanvas.height = img.naturalHeight;
  tmpCanvas.width = img.naturalWidth;
  tmpCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  const imgData = tmpCtx.getImageData(
    0,
    0,
    img.naturalWidth,
    img.naturalHeight
  ); //podatki o sliki
  const data = imgData.data; //pridobimo array pikslov
  makeHistogram(data);
  curveBuckets = generateBucketsByColor(data, 255);
  drawCurveHistogram("R");
  drawCurveHistogram("G");
  drawCurveHistogram("B");
}

function redo() {
  img.src = redoData[redoData.length - 1];
  history.push(redoHistory.pop());
  historyData.push(redoData.pop());

  undoButton.disabled = false;

  if (redoHistory.length == 0) redoButton.disabled = true;

  buildHistory();

  // posodobi histograme
  const tmpCanvas = document.createElement("canvas");
  const tmpCtx = tmpCanvas.getContext("2d");
  tmpCanvas.height = img.naturalHeight;
  tmpCanvas.width = img.naturalWidth;
  tmpCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  const imgData = tmpCtx.getImageData(
    0,
    0,
    img.naturalWidth,
    img.naturalHeight
  ); //podatki o sliki
  const data = imgData.data; //pridobimo array pikslov
  makeHistogram(data);
  curveBuckets = generateBucketsByColor(data, 255);
  drawCurveHistogram("R");
  drawCurveHistogram("G");
  drawCurveHistogram("B");
}

function setGrayscale(data) {
  for (let i = 0; i < data.length; i = i + 4) {
    const val = 0.299 * data[i] + 0.587 * data[i] + 0.114 * data[i];
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    continue;
  }
}

function setBrightness(data, brightness) {
  for (let i = 0; i < data.length; i++) {
    // for (let i = 0; i < data.length; i += 4) {
    if ((i + 1) % 4 === 0) continue;

    // let [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    // if (l == 1) console.log(l);
    // l = Math.pow(l, brightness);

    // [data[i], data[i + 1], data[i + 2]] = hslToRgb(h, s, l);

    data[i] = data[i] * Math.sqrt(brightness);
  }
}

function removeColorChannels(data, colorObject) {
  const arr = ["red", "green", "blue"];
  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) continue; // preskoci alfa kanal

    data[i] = colorObject[arr[i % 4]] ? 0 : data[i];
  }
}

function enhanceColorChannel(data, colorObject) {
  const arr = ["red", "green", "blue"];
  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) continue;

    data[i] = colorObject[arr[i % 4]] ? 255 : data[i];
  }
}

function setTreshold(data, threshold) {
  for (let i = 0; i < data.length; i = i + 4) {
    let val = 0.299 * data[i] + 0.587 * data[i] + 0.114 * data[i];
    val = val > threshold ? 255 : 0;
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    continue;
  }
}

function joinSobel(data1, data2, data) {
  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) continue; // preskoci alfa kanal
    data[i] = data1[i] + data2[i];
  }
}

function kernelFunc(data, width, height, kernel, div) {
  const realWidth = 4 * width;
  const edgeOffset = (kernel.length - 1) / 2;

  // temporary table da ne unicis originala
  let res = [];

  for (let i = 0; i < data.length; i++) {
    if ((i + 1) % 4 === 0) {
      res[i] = data[i];
      continue;
    } // preskoci alfa kanal

    const x = Math.floor(i / 4) % width;
    const y = Math.floor(i / realWidth);

    const orig = [];
    // const orig = [
    //   [data[i - 4 - realWidth], data[i - realWidth], data[i + 4 - realWidth]],
    //   [data[i - 4], data[i], data[i + 4]],
    //   [data[i - 4 + realWidth], data[i + realWidth], data[i + 4 + realWidth]],
    // ];

    for (let a = -edgeOffset; a <= edgeOffset; a++) {
      orig.push([]);
      for (let b = -edgeOffset; b <= edgeOffset; b++) {
        orig[orig.length - 1].push(data[i + a * realWidth + b * 4]);
      }
    }

    if (
      x + edgeOffset >= width ||
      x < edgeOffset ||
      y + edgeOffset >= height ||
      y < edgeOffset
    ) {
      res[i] = data[i];
    }

    if (!res[i]) res[i] = mulConvWPic(kernel, orig) / div;
  }

  // save new data
  for (let i = 0; i < res.length; i++) {
    data[i] = res[i];
  }
}

function mulConvWPic(conv, pic) {
  let res = 0;
  for (let i = 0; i < conv.length; i++) {
    for (let j = 0; j < conv[i].length; j++) {
      if (pic[i][j] == -1) continue; // edges

      res += conv[i][j] * pic[i][j];
    }
  }

  return res;
}

function download() {
  const link = document.createElement("a");
  link.href = img.src;
  link.download = "Untitled";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function makeHistogram(data) {
  const buckets = generateBucketsByColor(data, 5);

  let chart = new CanvasJS.Chart("chartContainer", {
    animationEnabled: true,
    theme: "dark2",
    title: {
      text: "Histogram",
    },
    axisX: {
      title: "Buckets",
    },
    axisY: {
      title: "No. of pixels",
    },
    data: [
      {
        type: "column",
        name: "red",
        legendText: "red",
        color: "red",
        showInLegend: true,
        dataPoints: buckets["R"],
      },
      {
        type: "column",
        name: "green",
        legendText: "green",
        color: "green",
        showInLegend: true,
        dataPoints: buckets["G"],
      },
      {
        type: "column",
        name: "blue",
        legendText: "blue",
        color: "blue",
        showInLegend: true,
        dataPoints: buckets["B"],
      },
    ],
  });

  chart.render();
}

function toggleBrush() {
  isBrushOn = !isBrushOn;

  if (isBrushOn) {
    img.classList.add("hidden");
    brushCanvas.classList.remove("hidden");
    brushButton.classList.add("active");
    brushButton.innerText = "Stop Brush";

    createCanvas("brush");
  } else {
    brushButton.classList.remove("active");
    brushButton.innerText = "Start Brush";

    const imgData = brushCtx.getImageData(
      0,
      0,
      img.naturalWidth,
      img.naturalHeight
    ); //podatki o sliki
    let data = imgData.data; //pridobimo array pikslov

    img.src = brushCanvas.toDataURL();

    makeHistogram(data);
    curveBuckets = generateBucketsByColor(imgData.data, 255);
    drawCurveHistogram("R");
    drawCurveHistogram("G");
    drawCurveHistogram("B");

    img.classList.remove("hidden");
    brushCanvas.classList.add("hidden");

    history.push("paint");
    historyData.push(brushCanvas.toDataURL());
    redoData = [];
    redoHistory = [];
    redoButton.disabled = true;
    buildHistory();
  }
}

function draw(e) {
  if (!isDrawing) return; //Stops the fn from running when not moused down
  brushCtx.beginPath();
  brushCtx.moveTo(lastX, lastY);
  brushCtx.lineTo(e.offsetX, e.offsetY);
  brushCtx.stroke();
  [lastX, lastY] = [e.offsetX, e.offsetY];
}

function createCanvas(type) {
  brushCanvas.remove();

  const can = document.createElement("canvas");
  can.width = img.naturalWidth;
  can.height = img.naturalHeight;
  can.id = "brush-canvas";
  brushContainer.appendChild(can);

  brushCanvas = document.getElementById("brush-canvas");
  brushCtx = brushCanvas.getContext("2d");
  brushCtx.strokeStyle = "#fff";
  brushCtx.lineJoin = "round";
  brushCtx.lineCap = "round";
  brushCtx.lineWidth = 30;
  // brushCtx.globalCompositeOperation = "multiply";

  brushCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

  if (type == "brush") {
    brushCanvas.addEventListener("mousedown", e => {
      isDrawing = true;
      // color
      brushCtx.strokeStyle = document.getElementById("colorInput").value;

      // width
      let val = document.getElementById("brush-width").innerText;
      if (isNaN(val) || val < 0 || val > 255) val = 125;
      brushCtx.lineWidth = val;

      brushCtx.globalCompositeOperation =
        document.getElementById("blend-input").value;

      [lastX, lastY] = [e.offsetX, e.offsetY];
    });
    brushCanvas.addEventListener("mousemove", draw);
    brushCanvas.addEventListener("mouseup", () => (isDrawing = false));
    brushCanvas.addEventListener("mousout", () => (isDrawing = false));
  } else if (type == "crop") {
    brushCtx.lineWidth = 3;
    brushCtx.strokeStyle = "#000";
    brushCanvas.addEventListener("mousedown", e => crop(e));
  } else if (type == "select") {
    brushCtx.lineWidth = 3;
    brushCtx.strokeStyle = "#000";
    brushCanvas.addEventListener("mousedown", e => select(e));
  }
}

function crop(e) {
  if (cropPoints.length == 2) {
    cropPoints = [];
    brushCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  }

  cropPoints.push([e.offsetX, e.offsetY]);

  if (cropPoints.length == 2) {
    let x = cropPoints[0][0];
    let y = cropPoints[0][1];
    let w = cropPoints[1][0] - x;
    let h = cropPoints[1][1] - y;
    brushCtx.beginPath();
    brushCtx.rect(x, y, w, h);
    brushCtx.stroke();
    cropInfo.innerText = "Stop crop to apply";
  } else {
    cropInfo.innerText = "Select second point";
  }
}

function select(e) {
  if (selectPoints.length == 2) {
    selectPoints = [];
    brushCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);
  }

  selectPoints.push([e.offsetX, e.offsetY]);

  if (selectPoints.length == 2) {
    let x = selectPoints[0][0];
    let y = selectPoints[0][1];
    let w = selectPoints[1][0] - x;
    let h = selectPoints[1][1] - y;
    brushCtx.beginPath();
    brushCtx.rect(x, y, w, h);
    brushCtx.stroke();
    selectInfo.innerText = "Stop select to apply";
  } else {
    selectInfo.innerText = "Select second point";
  }
}

function toggleCrop() {
  isCropOn = !isCropOn;

  if (isCropOn) {
    img.classList.add("hidden");
    brushCanvas.classList.remove("hidden");
    cropButton.classList.add("active");
    cropButton.innerText = "Stop Crop";
    cropInfo.innerText = "Select first point";

    createCanvas("crop");
  } else {
    if (cropPoints.length == 2) {
      applyCrop();
    }
    img.classList.remove("hidden");
    brushCanvas.classList.add("hidden");
    cropButton.classList.remove("active");
    cropButton.innerText = "Crop";
    cropInfo.innerText = "";

    cropPoints = [];
  }
}

function applyCrop() {
  let x = cropPoints[0][0];
  let y = cropPoints[0][1];
  let w = cropPoints[1][0] - x;
  let h = cropPoints[1][1] - y;

  const tmpCanvas = document.createElement("canvas");
  const tmpCtx = tmpCanvas.getContext("2d");

  tmpCanvas.height = img.naturalHeight;
  tmpCanvas.width = img.naturalWidth;

  tmpCtx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

  const imgData = tmpCtx.getImageData(x, y, w, h);

  brushCanvas.width = w;
  brushCanvas.height = h;
  brushCtx.putImageData(imgData, 0, 0);
  img.src = brushCanvas.toDataURL();

  makeHistogram(imgData.data);
  curveBuckets = generateBucketsByColor(imgData.data, 255);
  drawCurveHistogram("R");
  drawCurveHistogram("G");
  drawCurveHistogram("B");

  img.classList.remove("hidden");
  brushCanvas.classList.add("hidden");

  history.push("crop");
  historyData.push(brushCanvas.toDataURL());
  redoData = [];
  redoHistory = [];
  redoButton.disabled = true;
  buildHistory();
}

document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.key === "z") {
    if (historyData.length > 1) undo();
  }

  if (e.ctrlKey && e.key === "Z") {
    if (redoData.length > 0) redo();
  }
});

function toggleSelect() {
  isSelectOn = !isSelectOn;

  if (isSelectOn) {
    img.classList.add("hidden");
    brushCanvas.classList.remove("hidden");
    selectButton.classList.add("active");
    selectButton.innerText = "Stop Select";
    selectInfo.innerText = "Select first point";

    selectPoints = [];

    createCanvas("select");
  } else {
    img.classList.remove("hidden");
    brushCanvas.classList.add("hidden");
    selectButton.classList.remove("active");
    selectButton.innerText = "Rectangular Select";
    selectInfo.innerText = "";

    console.log(selectPoints);
  }
}

function removeSelect() {
  selectPoints = [];
}

document.getElementById("add-row").addEventListener("click", () => {
  for (let a = 0; a < 2; a++) {
    const inputs = document.getElementsByClassName("kernel-input-el");
    const inputParent = document.getElementById("custom-kernel-input");
    const size = Math.sqrt(inputs.length);

    for (let i = 0; i < inputParent.children.length; i++) {
      let newInput = document.createElement("td");
      newInput.classList.add("input", "kernel-input-el");
      newInput.contentEditable = true;
      newInput.innerText = "1";
      inputParent.children[i].appendChild(newInput);
    }

    let tr = document.createElement("tr");
    for (let i = 0; i < size + 1; i++) {
      let newInput = document.createElement("td");
      newInput.classList.add("input", "kernel-input-el");
      newInput.contentEditable = true;
      newInput.innerText = "1";
      tr.appendChild(newInput);
    }

    inputParent.appendChild(tr);
  }
});

document.getElementById("remove-row").addEventListener("click", () => {
  for (let a = 0; a < 2; a++) {
    const inputs = document.getElementsByClassName("kernel-input-el");
    const inputParent = document.getElementById("custom-kernel-input");

    const size = Math.sqrt(inputs.length);
    for (let i = size - 1; i < inputs.length; i += size) {
      inputs[i].remove();
      i--;
    }

    inputParent.children[size - 1].remove();
  }
});

function drawCurveHistogram(color) {
  curvesCtxs[color].clearRect(0, 0, 255, 100);
  // draw line
  curvesCtxs[color].beginPath();
  curvesCtxs[color].moveTo(0, 100);
  curvesCtxs[color].lineTo(curvesPoints[color].x, 100 - curvesPoints[color].y);
  curvesCtxs[color].stroke();
  curvesCtxs[color].beginPath();
  curvesCtxs[color].moveTo(curvesPoints[color].x, 100 - curvesPoints[color].y);
  curvesCtxs[color].lineTo(255, 0);
  curvesCtxs[color].stroke();

  // draw histogram
  curvesCtxs[color].strokeStyle =
    color === "R" ? "red" : color === "G" ? "green" : "blue";

  curveBuckets[color].forEach((el, i) => {
    let perc = (el.y / (img.naturalWidth * img.naturalHeight)) * 100;

    curvesCtxs[color].beginPath();
    curvesCtxs[color].moveTo(i, 100);
    curvesCtxs[color].lineTo(i, 100 - perc * 100);
    curvesCtxs[color].stroke();
  });

  curvesCtxs[color].strokeStyle = "#fff";
}

function applyCurve(data, color) {
  let k = (100 - curvesPoints[color].y) / (255 - curvesPoints[color].x);
  let n = 100 - k * 255;

  let i;
  if (color === "R") i = 0;
  else if (color === "G") i = 1;
  else i = 2;

  for (; i < data.length; i += 4) {
    let x = data[i];
    let fx;

    if (curvesPoints[color].x == 0) {
      fx = curvesPoints[color].y; // to prevent division with zero
    } else if (x <= curvesPoints[color].x) {
      fx = (curvesPoints[color].y / curvesPoints[color].x) * x; // first part
    } else {
      fx = k * x + n; // second part
    }

    // convert y from 0-100 to 0-255
    fx = (fx / 100) * 255;

    data[i] = fx;
  }

  makeHistogram(data);
}

for (const [color, canvas] of Object.entries(curvesCanvases)) {
  canvas.addEventListener("mousedown", e => {
    curvesPoints[color] = { x: e.offsetX, y: 100 - e.offsetY };
    curvesCtxs[color].clearRect(0, 0, 255, 100);

    drawCurveHistogram(color);

    curvesCtxs[color].beginPath();
    curvesCtxs[color].moveTo(0, 100);
    curvesCtxs[color].lineTo(e.offsetX, e.offsetY);
    curvesCtxs[color].stroke();

    curvesCtxs[color].beginPath();
    curvesCtxs[color].moveTo(e.offsetX, e.offsetY);
    curvesCtxs[color].lineTo(255, 0);
    curvesCtxs[color].stroke();

    applyEffect("curves-" + color.toLowerCase());
  });
}
