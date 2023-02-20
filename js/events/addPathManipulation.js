import { dispatch } from "../dispatch.js";
import { getFileSection } from "../getFileSection.js";
import { ensureSyntaxTree } from "@codemirror/language";
import { astAnalysis } from "../astAnalysis.js";
import { global_state } from "../global_state.js";
import { snapToGrid } from "../snapToGrid.js";
import { snapToPad } from "../snapToPad.js";

const sigFigs = num => num.includes(".")
  ? num.split(".")[1].length
  : num.length;

const step = (num, stepSize) => Math.round(num/stepSize)*stepSize;
const round = (num, sigFigs) => Math.round(num*10**sigFigs)/(10**sigFigs);
const isDigit = (ch) => /[0-9]/i.test(ch) || ch === ".";

export function addPathManipulation(state, svgListener) {
  let clickedPoint = null;

  // setInterval(() => updateSelectedPath(state), 300);

  const svg = document.querySelector("svg");
  const svgPoint = svg.panZoomParams.svgPoint;

  svgListener("mousedown", "", e => {
    const isPt = e.composedPath().some(el => el.classList?.contains("draggable-pt"));
    if (isPt || state.selectedPath === null) return;

    
    clickedPoint = {x: e.offsetX, y: e.offsetY };
    
  })

  svgListener("mouseup", "", e => {
    const currentPoint = { x: e.offsetX, y: e.offsetY };
    if (clickedPoint === null 
        || clickedPoint.x !== currentPoint.x 
        || clickedPoint.y !== currentPoint.y ) {
      clickedPoint = null;
      return null;
    }

    const targetPoint = svgPoint(clickedPoint);

    // Make this mutable so we can use other filters later
    let pt = {
      x: snapToGrid(targetPoint.x),
      y: snapToGrid(targetPoint.y)
    }

    // BEGIN: Snap to pad
    const components = state.pcb.components;
    for (const comp in components) {
      const pads = components[comp].pads;
      for (const pad in pads) {
        const p = pads[pad];
        const dx = Math.abs(targetPoint.x - p[0]);
        const dy = Math.abs(targetPoint.y - p[1]);
        if (dx < 0.05 && dy < 0.05) {
          // console.log(`Nearby pad ${pad}`);
          pt.x = snapToPad(p[0], pt.x);
          pt.y = snapToPad(p[1], pt.y);
          break;
        }
      }
    }
    // END: Snap to pad

    const doc = state.codemirror.view.state.doc;
    const string = doc.toString();

    let start = state.selectedPath.pathEnd-2;
    const chs = [" ", "\t", "\n"];
    let ch = " ";
    while (start > 0) {
      ch = string[start];
      if (!chs.includes(ch)) break;
      start--;
    }

    const text = `${(ch === "," || ch === "(") ? "" : ","}\n  pt(${pt.x}, ${pt.y}),`

    state.codemirror.view.dispatch({
      changes: {
        from: start+1, 
        // to: startIndex, 
        insert: text
      }
    });

    // console.log(
    //   state.selectedPath, 
    //   text, 
    //   text.length, 
    //   state.selectedPath.target.dataset.pathStart, 
    //   state.selectedPath.target.dataset.pathEnd
    // );

    // state.selectedPath.pathStart = Number(state.selectedPath.target.dataset.pathStart);
    // state.selectedPath.pathEnd = Number(state.selectedPath.target.dataset.pathEnd);
    // console.log(string.slice(state.selectedPath.pathStart, state.selectedPath.pathEnd))
    
    state.selectedPath.pathEnd += text.length;

    dispatch("RUN");
  })
}









