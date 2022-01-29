import { html, svg } from "lit-html";
import { Turtle } from "../libs/gram-js.js";
import "code-mirror";
import { files } from "./neil-components-names.js";

export function view(state) {
	return html`
		<div class="top-menu">
			<div class="left">
				 <div class="dropdown-container">
				 	import
				 	<div class="dropdown-content">
				 		${ files.map(x => x.slice(10)).map( x => html`
								<div class="import-item" @mousedown=${async (e) => {
						 			const res = await fetch(`/neil-components/${x}`);
						 			const text = await res.text();
						 			dispatch("ADD_IMPORT", { text, name: e.target.innerText.split("/")[1].split(".")[0] });
						 		}}>${x}</div>
				 			`)
				 		}
				 		
				 	</div>
				 </div>
			</div>
			<div class="right">
				<div class="dropdown-container">
					drawing
					<div class="dropdown-content dropdown-content-right">
						<button class="download-button">download</button>
						<button class="center-button">center</button>
						<div>
							<span>handles</span>
							<input 
								type="checkbox" 
								checked=${state.viewHandles}
								@change=${(e) => { 
									state.viewHandles = e.target.checked; 
									dispatch("RENDER"); 
								}}
								class="handles-checkbox">
							</input>
						</div>
						<div>
							<span>grid size:</span>
							<input 
								type="number" 
								step="0.005" 
								min="0"
								value=${state.gridSize}
								@change=${e => {
									state.gridSize = Number(e.target.value);
									dispatch("RENDER");
								}}>
							</input>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div style="display: flex; height: 100%; min-height: 100%; max-height: 100%;">
			<code-mirror id="code-editor" style="overflow: scroll;"></code-mirror>
			<div class="right-side">
				${svgViewer(state)}
				<div class="footprint-toolbox">${state.footprints.map(renderFootprint)}</div>
			</div>
		</div>
		<div id="vertical-bar"></div>
	`
}


const renderFootprint = ([name, footprint], i) => {
			// <svg width="30" height="30">
			// 	<circle cx="15" cy="15" r="10" stroke="grey" stroke-width="4" fill="yellow" />
			// </svg>
	return html`
		<div class="footprint-item">
			<div class="footprint-item-icon" data-index=${i} ></div>
			<span>${name}</span>
		</div>
	`
}

const drawPath = ({ d, color, groupId = ""}) => {


const mapColors = arr => arr.length === 4
	? `rgba(${arr.map((n,i) => i < 3 ? Math.round(n*255) : n).join(",")})`
	: arr.length === 3 ? `hsl(${arr[0]}, ${arr[1]}%, ${arr[2]}%)`
	: "rgba(255, 255, 255, 1)"

const drawPath = (d, color) => svg`
	<path 
		d="${d}" 
		fill-rule="nonzero"
		fill="${mapColors(color)}"/>
`

const ptsToD = pts => pts.reduce((acc, cur, i) => `${acc} ${i === 0 ? "M" : "L"} ${cur.join(",")}`, "");


const drawGrid = (corners, gridSize) => {
	
	const middX = [
		[corners.lt.x, (corners.lt.y + corners.lb.y)/2],
		[corners.rt.x, (corners.rt.y + corners.rb.y)/2],
	]

	const middY = [
		[(corners.lt.x + corners.rt.x)/2, corners.lt.y],
		[(corners.lb.x + corners.rb.x)/2, corners.lb.y],
	]

	const originX = [
		[corners.lt.x, 0],
		[corners.rt.x, 0],
	]

	const originY = [
		[0, corners.lt.y],
		[0, corners.lb.y],
	] 

	const xLimits = [corners.lt.x, corners.rt.x];
	const xRange = Math.abs(xLimits[1] - xLimits[0]);
	const yLimits = [corners.lb.y, corners.lt.y];
	const yRange = Math.abs(yLimits[1] - yLimits[0]);

	function getBaseLog(x, y) {
	  return Math.log(y) / Math.log(x);
	}

	const order = Math.round(getBaseLog(5, Math.max(xRange, yRange)));
	// const stepSize = (5**(order-1))/5;
	const stepSize = gridSize;

	const getMarkVals = (limits, stepSize) => {
		let marks = [];
		let current = stepSize*Math.ceil(limits[0]/stepSize) - stepSize;
		while (current < limits[1] + stepSize) {
			current = current + stepSize;
			marks.push(current);
		}
		
		return marks
	}

	const valToLineH = val => [
		[corners.lt.x, val],
		[corners.rt.x, val]
	];

	const valToLineV = val => [
		[val, corners.lt.y],
		[val, corners.lb.y],
	];

	const lineToMark = width => line => svg`<path stroke="black" vector-effect="non-scaling-stroke" stroke-width="${width}" d="${ptsToD(line)}"/>`

	const hMarks = getMarkVals(yLimits, stepSize).map(valToLineH).map(lineToMark(0.2))
	const vMarks = getMarkVals(xLimits, stepSize).map(valToLineV).map(lineToMark(0.2))

	// console.log(getMarkVals(yLimits, stepSize));

	return svg`
		<g class="grid no-download">
			${lineToMark(.6)(originX)}
			${lineToMark(.6)(originY)}
			${hMarks}
			${vMarks}
		</g>
	`
}

const svgViewer = (state) => {
	const shapes = state.shapes.map(p => Array.isArray(p.d) 
		? p.d.map(d => drawPath(d, p.color)) 
		: drawPath(p.d, p.color)
	).flat();

	const corners = state.panZoomParams?.corners();


	return svg`
		<svg id="viewer" style="width: 100%; height: 100%; transform: scale(1, -1);">
			<g class="transform-group">
			      ${ state.selectBox.start && state.selectBox.end ? svg`
			      	<path 
				        class="selectBox"
				        d="
				          M ${state.selectBox.start.x} ${state.selectBox.start.y} 
				          L ${state.selectBox.end.x} ${state.selectBox.start.y} 
				          L ${state.selectBox.end.x} ${state.selectBox.end.y}     
				          L ${state.selectBox.start.x} ${state.selectBox.end.y}
				        "
			      	/>` : ""
			      }
				${shapes}
				${state.panZoomParams && state.gridSize > 0 ? drawGrid(state.panZoomParams.corners(), state.gridSize) : ""}
				<rect 
					class="limits no-download" 
					width="${state.limits.x[1] - state.limits.x[0]}"
					height="${state.limits.y[1] - state.limits.y[0]}"
					stroke="black" fill="transparent" stroke-width="1"
					vector-effect="non-scaling-stroke"
					transform="translate(${state.limits.x[0]}, ${state.limits.y[0]})"/>
				${state.storedPCB && state.viewHandles ? drawHandles(state.storedPCB) : ""}
			</g>
		
		</svg>
	`
}

// <circle class="no-download" cx="0" cy="0" r="0.1" vector-effect="non-scaling-stroke"/>

const drawHandles = (pcb) => pcb.components.map((comp, i) => svg`
	<circle 
		class="no-download translate-handle" 
		cx="${comp.posX}" 
		cy="${comp.posY}" 
		data-index=${i}
		r="0.02" 
		vector-effect="non-scaling-stroke"
		/>
`)
























