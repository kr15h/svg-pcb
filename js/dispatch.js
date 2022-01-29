import { view } from "./view.js";
import { render } from "https://cdn.skypack.dev/lit-html";

import { addEvents } from "./events.js";
import { test } from "./test.js";

import { PCB as real_PCB } from "./pcb.js";
import { kicadToObj } from "./ki_cad_parser.js"
import { Turtle } from "./Turtle.js";
import { getFootprints } from "./getFootprints.js";

import { parse2 } from "./parser.js";
import esprima from 'https://cdn.skypack.dev/esprima';
import acorn from 'https://cdn.skypack.dev/acorn';
import { generate } from 'https://cdn.skypack.dev/astring';
import { walk } from 'https://cdn.skypack.dev/esprima-walk';


const STATE = {
	codemirror: undefined,
	storedPCB: undefined,
	transforming: false,
	transformUpdate: () => {},
	selectBox: {},
	footprints: [],
	shapes: [],
	limits: {
		x: [0, 1],
		y: [0, 1]
	},
	mm_per_unit: 25.4,
	gridSize: 0.05,
	viewHandles: true,
	panZoomParams: undefined,
}

class PCB extends real_PCB {
	constructor() {
		super();
		STATE.storedPCB = this;
	}
}

const included = {
	kicadToObj,
	PCB,
	via,
	Turtle,
	renderPCB,
	renderShapes,
	document: null,
	window: null,
	localStorage: null,
	Function: null,
	eval: null,
	// "import": null,
}

async function urlToCode(file_url, state) {
	const file = await fetch(file_url,  {mode: 'cors'});
	const txt = await file.text();      

    state.codemirror.view.dispatch({
	  changes: {from: 0, insert: txt}
	});

    // fold imports
	const anotherComp = l => l.includes("return kicadToObj(");

	const doc = state.codemirror.view.state.doc;
	const lines = doc.toString().split("\n");
	let i = 0;
	let count = 0;
	while (true) {
		const line = lines[i];
		if (!line) break;
		count += line.length;
		if (i > lines.length) break;
		if (lines[i] === "`)})()" && !anotherComp(lines[i+1])) break;
		i++;
	};

	state.codemirror.foldRange(0, count+i);

    dispatch("RUN");
    document.querySelector(".center-button").click();
}

const ACTIONS = {
	INIT(args, state) {
		dispatch("RENDER");
		state.codemirror = document.querySelector("#code-editor");
		addEvents(state);

		const url = new URL(window.location.href);

	    const search = window.location.search;
	    const code = new URLSearchParams(search).get("code");
	    const file = new URLSearchParams(search).get("file");

	    if (code) {

	    } else if (file) {
          let file_url = file;
          if (!file.startsWith("http")) file_url = `examples/${file}`;

          urlToCode(file_url, state);
	    } else {
		    state.codemirror.view.dispatch({
			  changes: {from: 0, insert: test}
			});
			dispatch("RUN");
	    }
	},
	RUN(args, state) {
		const string = state.codemirror.view.state.doc.toString();
		// const result = JSON.parse(string); // if json

		let footprints = [];
		try {
			footprints = getFootprints(string);
		} catch (err) {}

		state.footprints = footprints;


		// need to sanitize text

		const BLACK_LISTED_WORDS = ["import"]; // "document", "window", "localStorage"
		BLACK_LISTED_WORDS.forEach(word => {
			if (string.includes(word))
				throw `"${word}" is not permitted due to security concerns.`;
		});

		const f = new Function(...Object.keys(included), string)
		const result = f(...Object.values(included));

		let { shapes, limits, mm_per_unit } = typeof result === "string" ? JSON.parse(result) : result;

		state.shapes = shapes;
		state.limits = limits;
		state.mm_per_unit = mm_per_unit;
		// console.log(state.storedPCB);
		dispatch("RENDER");
	},
	UPLOAD_COMP({ text, name }, state) {
		text = text.replaceAll("$", "");
		text = `const ${name} = (() => { return kicadToObj(\n\`${text}\`)})()\n`
		state.codemirror.view.dispatch({
		  changes: {from: 0, insert: text}
		});

		state.codemirror.foldRange(0, text.length);
		dispatch("RENDER");
	},
	ADD_IMPORT({ text, name }, state) {
		text = `const ${name} = ${text}\n`
		state.codemirror.view.dispatch({
		  changes: {from: 0, insert: text}
		});

		dispatch("RUN");
	},
	TRANSLATE({ x, y, index }, state) {
		state.transformUpdate(x, y);
		dispatch("RUN");
	},
	RENDER() {
		render(view(STATE), document.getElementById("root"));
	}
}

export function dispatch(action, args = {}) {
	const trigger = ACTIONS[action];
	if (trigger) trigger(args, STATE);
	else console.log("Action not recongnized:", action);
}
