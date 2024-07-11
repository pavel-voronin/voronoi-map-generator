const canvas = document.getElementById("voronoiCanvas");
const ctx = canvas.getContext("2d");
let points = [],
  draggingPointIndex = null;
let minRadius = 60,
  scaleY = 0.31,
  delta = 20;
let minCalculatedRedRadius = Infinity,
  minCalculatedBlueRadius = Infinity;

const voronoi = new Voronoi();
const bbox = { xl: 0, xr: canvas.width, yt: 0, yb: canvas.height };

const UI = {
  scaleSlider: document.getElementById("scaleSlider"),
  radiusSlider: document.getElementById("radiusSlider"),
  deltaSlider: document.getElementById("deltaSlider"),
  showCircumcenterCircles: document.getElementById("showCircumcenterCircles"),
  showInscribedCircles: document.getElementById("showInscribedCircles"),
  showCenters: document.getElementById("showCenters"),
  minRedRadiusValue: document.getElementById("minRedRadiusValue"),
  minBlueRadiusValue: document.getElementById("minBlueRadiusValue"),
};

function updateUI() {
  document.getElementById("scaleValue").innerText = scaleY.toFixed(2);
  document.getElementById("radiusValue").innerText = minRadius.toFixed(0);
  document.getElementById("deltaValue").innerText = delta.toFixed(0);
  UI.minRedRadiusValue.innerText = minCalculatedRedRadius.toFixed(2);
  UI.minBlueRadiusValue.innerText = minCalculatedBlueRadius.toFixed(2);
}

function drawVoronoi() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const diagram = voronoi.compute(points, bbox);
  minCalculatedRedRadius = Infinity;
  minCalculatedBlueRadius = Infinity;

  diagram.cells.forEach((cell) => {
    if (!isCellOnEdge(cell, bbox) && cell.halfedges.length === 6) {
      drawCell(cell);
      const redRadius = drawInscribedCircle(cell);
      const blueRadius = drawIncenterCircle(cell);
      minCalculatedRedRadius = Math.min(minCalculatedRedRadius, redRadius);
      minCalculatedBlueRadius = Math.min(minCalculatedBlueRadius, blueRadius);
      drawRadiusText(cell.site, redRadius, blueRadius);
    }
  });

  if (UI.showCenters.checked) {
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = "black";
      ctx.fill();
    });
  }

  updateUI();
}

function drawCell(cell) {
  if (!cell.halfedges[0]) return;
  ctx.beginPath();
  ctx.moveTo(
    cell.halfedges[0].getStartpoint().x,
    cell.halfedges[0].getStartpoint().y
  );
  cell.halfedges.forEach((edge) => {
    const endPoint = edge.getEndpoint();
    ctx.lineTo(endPoint.x, endPoint.y);
  });
  ctx.closePath();
  ctx.strokeStyle = "black";
  ctx.stroke();
  ctx.fillStyle = "rgba(200, 200, 200, 0.3)";
  ctx.fill();
}

function drawInscribedCircle(cell) {
  const center = cell.site;
  const minDist = Math.min(
    ...cell.halfedges.map((edge) =>
      pointToLineDistance(center, edge.getStartpoint(), edge.getEndpoint())
    )
  );

  if (UI.showCircumcenterCircles.checked) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, minDist, 0, Math.PI * 2);
    ctx.strokeStyle = "red";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "red";
    ctx.fill();
  }

  return minDist;
}

function drawIncenterCircle(cell) {
  const { center, radius } = findIncenterAndRadius(cell);

  if (UI.showInscribedCircles.checked && center) {
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "blue";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(center.x, center.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "blue";
    ctx.fill();
  }

  return radius;
}

function drawRadiusText(site, redRadius, blueRadius) {
  ctx.font = "12px Arial";
  if (UI.showCircumcenterCircles.checked) {
    ctx.fillStyle = "red";
    ctx.fillText(redRadius.toFixed(2), site.x + 5, site.y - 5);
  }
  if (UI.showInscribedCircles.checked) {
    ctx.fillStyle = "blue";
    ctx.fillText(blueRadius.toFixed(2), site.x + 5, site.y + 15);
  }
}

function findIncenterAndRadius(cell) {
  const vertices = cell.halfedges.map((edge) => edge.getStartpoint());
  let bestCenter = cell.site;
  let bestRadius = 0;

  const isValidCenter = (center) =>
    cell.halfedges.every(
      (edge) =>
        pointToLineDistance(center, edge.getStartpoint(), edge.getEndpoint()) >=
        0
    );

  const stepSize = 1;
  const maxIterations = 100;
  let currentCenter = { ...cell.site };

  for (let i = 0; i < maxIterations; i++) {
    let improved = false;
    for (let dx = -stepSize; dx <= stepSize; dx += stepSize) {
      for (let dy = -stepSize; dy <= stepSize; dy += stepSize) {
        const newCenter = {
          x: currentCenter.x + dx,
          y: currentCenter.y + dy,
        };
        if (isValidCenter(newCenter)) {
          const radius = Math.min(
            ...cell.halfedges.map((edge) =>
              pointToLineDistance(
                newCenter,
                edge.getStartpoint(),
                edge.getEndpoint()
              )
            )
          );
          if (radius > bestRadius) {
            bestCenter = newCenter;
            bestRadius = radius;
            improved = true;
          }
        }
      }
    }
    if (!improved) break;
    currentCenter = { ...bestCenter };
  }

  return { center: bestCenter, radius: bestRadius };
}

function pointToLineDistance(point, start, end) {
  const A = point.x - start.x;
  const B = point.y - start.y;
  const C = end.x - start.x;
  const D = end.y - start.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  const param = lenSq !== 0 ? dot / lenSq : -1;

  let x, y;
  if (param < 0) {
    x = start.x;
    y = start.y;
  } else if (param > 1) {
    x = end.x;
    y = end.y;
  } else {
    x = start.x + param * C;
    y = start.y + param * D;
  }

  const dx = point.x - x;
  const dy = point.y - y;
  return Math.sqrt(dx * dx + dy * dy);
}

function isCellOnEdge(cell, bbox) {
  return cell.halfedges.some((edge) => {
    const { x: sx, y: sy } = edge.getStartpoint();
    const { x: ex, y: ey } = edge.getEndpoint();
    return (
      sx === bbox.xl ||
      sx === bbox.xr ||
      sy === bbox.yt ||
      sy === bbox.yb ||
      ex === bbox.xl ||
      ex === bbox.xr ||
      ey === bbox.yt ||
      ey === bbox.yb
    );
  });
}

function hexPoints(radius, scaleY, delta) {
  points = [];
  const hexRadius = radius / Math.cos(Math.PI / 6);
  const hexHeight = Math.sqrt(3) * hexRadius;
  const cols = Math.floor(canvas.width / (hexHeight * 0.75));
  const rows = 120;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = hexHeight * col + (row % 2 === 0 ? hexHeight / 2 : 0);
      const y = (hexRadius * 1.5 * row + hexRadius) * scaleY;
      const offsetX = (Math.random() - 0.5) * delta;
      const offsetY = (Math.random() - 0.5) * delta;
      points.push({ x: x + offsetX, y: y + offsetY });
    }
  }
  drawVoronoi();
}

document.querySelectorAll(".scale-btn").forEach((button) => {
  button.addEventListener("click", function () {
    scaleY = parseFloat(this.dataset.value);
    UI.scaleSlider.value = scaleY;
    hexPoints(minRadius, scaleY, delta);
  });
});

UI.scaleSlider.addEventListener("input", (e) => {
  scaleY = parseFloat(e.target.value);
  hexPoints(minRadius, scaleY, delta);
});

UI.radiusSlider.addEventListener("input", (e) => {
  minRadius = parseFloat(e.target.value);
  hexPoints(minRadius, scaleY, delta);
});

UI.deltaSlider.addEventListener("input", (e) => {
  delta = parseFloat(e.target.value);
  hexPoints(minRadius, scaleY, delta);
});

UI.showCircumcenterCircles.addEventListener("change", drawVoronoi);
UI.showInscribedCircles.addEventListener("change", drawVoronoi);
UI.showCenters.addEventListener("change", drawVoronoi);

canvas.addEventListener("mousedown", (e) => {
  const { offsetX, offsetY } = e;
  draggingPointIndex = points.findIndex(
    (p) => Math.hypot(p.x - offsetX, p.y - offsetY) < 5
  );
  if (draggingPointIndex === -1) {
    points.push({ x: offsetX, y: offsetY });
    drawVoronoi();
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (draggingPointIndex !== null) {
    points[draggingPointIndex] = { x: e.offsetX, y: e.offsetY };
    drawVoronoi();
  }
});

canvas.addEventListener("mouseup", () => (draggingPointIndex = null));

// Initialize
hexPoints(minRadius, scaleY, delta);
